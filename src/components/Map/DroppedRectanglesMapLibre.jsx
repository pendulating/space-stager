// components/Map/DroppedRectanglesMapLibre.jsx
// MapLibre-based rectangle rendering for proper z-ordering with dropped objects
import { useEffect, useRef, useCallback, useState, useMemo } from 'react';

const DEBUG = false;
const shouldDebug = () => DEBUG || Boolean(typeof window !== 'undefined' && window.__RECT_DEBUG__);

const SOURCE_ID = 'dropped-rectangles';
const FILL_LAYER_ID = 'dropped-rectangles-fill';
const LINE_LAYER_ID = 'dropped-rectangles-line';
const HANDLES_LAYER_ID = 'dropped-rectangles-handles';
const HANDLES_SOURCE_ID = 'dropped-rectangles-handles';
const LABELS_LAYER_ID = 'dropped-rectangles-labels';
const LABELS_SOURCE_ID = 'dropped-rectangles-labels';
const PATTERN_LAYER_ID = 'dropped-rectangles-pattern';

/**
 * Renders dropped rectangular objects as MapLibre GeoJSON layers
 * This allows proper z-ordering with other map layers
 */
const DroppedRectanglesMapLibre = ({
  objects = [],
  placeableObjects = [],
  map,
  objectUpdateTrigger,
  selectedId,
  onSelectRect,
  onResizeRect,
  onMoveRect,
  isPlacementActive = false
}) => {
  const [layersInitialized, setLayersInitialized] = useState(false);
  const [dragging, setDragging] = useState(null); // { rectId, handleIndex, startLngLat }
  const [moving, setMoving] = useState(null); // { rectId, startLngLat, offset }
  const dataRef = useRef({ fc: null }); // Cache for direct data manipulation during drag
  const rectsRef = useRef([]); // Stable reference for drag handlers
  
  // Filter rectangles from objects
  const rects = useMemo(() => {
    return objects.filter(obj => {
      const type = placeableObjects.find(p => p.id === obj.type);
      const isRect = type && type.geometryType === 'rect';
      const hasValidGeometry = obj?.geometry?.coordinates?.[0]?.length >= 4;
      return isRect && hasValidGeometry;
    });
  }, [objects, placeableObjects, objectUpdateTrigger]);

  useEffect(() => {
    if (!shouldDebug()) return;
    try {
      console.info('[DroppedRectangles overlay] features', rects.length, rects.map(r => r.id));
    } catch (_) {}
  }, [rects]);
  
  // Keep rectsRef up-to-date for drag handlers
  useEffect(() => {
    rectsRef.current = rects;
  }, [rects]);
  

  // Load texture images for patterns using styleimagemissing event (best practice per Context7)
  useEffect(() => {
    if (!map) return;
    
    // Build texture map from placeable objects
    const textureMap = {};
    for (const obj of placeableObjects) {
      if (obj.geometryType === 'rect' && obj.texture?.url) {
        textureMap[obj.id] = obj.texture.url;
      }
    }
    
    const handleStyleImageMissing = (e) => {
      const id = e.id;
      
      // Check if this is one of our texture patterns
      if (!textureMap[id]) return;
      
      const path = textureMap[id];
      
      console.log(`[DroppedRectanglesMapLibre] Loading missing texture ${id} from:`, path);
      
      // Use Image element to load SVG
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          if (!map.hasImage(id)) {
            map.addImage(id, img, { pixelRatio: 2 });
            console.log(`[DroppedRectanglesMapLibre] Successfully added texture ${id}`);
          }
        } catch (err) {
          console.error(`[DroppedRectanglesMapLibre] Error adding texture ${id}:`, err);
        }
      };
      
      img.onerror = (err) => {
        console.error(`[DroppedRectanglesMapLibre] Failed to load texture ${id}:`, err);
      };
      
      img.src = path;
    };
    
    map.on('styleimagemissing', handleStyleImageMissing);
    
    return () => {
      map.off('styleimagemissing', handleStyleImageMissing);
    };
  }, [map, placeableObjects]);

  // Proactively (re)register pattern images on style load to ensure fill-pattern resolves without races
  useEffect(() => {
    if (!map) return;
    const textures = (placeableObjects || []).filter((o) => o && o.geometryType === 'rect' && o.texture && o.texture.url);
    if (textures.length === 0) return;

    const registerAll = async () => {
      for (let i = 0; i < textures.length; i++) {
        const t = textures[i];
        const id = String(t.id);
        try {
          let has = false;
          try { has = map.hasImage && map.hasImage(id); } catch (_) { has = false; }
          if (has) continue;
          // Skip SVG textures for rectangle fills per PNG-only policy
          const url = String(t.texture.url || '');
          if (url.toLowerCase().endsWith('.svg')) continue;
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve) => {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
          });
          if (!map.hasImage(id)) {
            map.addImage(id, img, { pixelRatio: 2 });
            if (shouldDebug()) { try { console.info('[DroppedRectangles] added pattern image', id); } catch (_) {} }
          }
        } catch (e) {
          try { console.warn('[DroppedRectangles] failed to register texture', id, e); } catch (_) {}
        }
      }
    };

    const onStyleLoad = () => { registerAll(); };
    const ready = typeof map.isStyleLoaded === 'function' ? map.isStyleLoaded() : true;
    if (ready) { registerAll(); }
    try { map.on('style.load', onStyleLoad); } catch (_) {}
    return () => { try { map.off('style.load', onStyleLoad); } catch (_) {} };
  }, [map, placeableObjects]);

  // Initialize layers (gated on style readiness) and reinitialize on style reloads
  const initLayers = useCallback(() => {
    if (!map) return;
    if (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) return;
    try {
      // Add sources
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }

      if (!map.getSource(HANDLES_SOURCE_ID)) {
        map.addSource(HANDLES_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }

      if (!map.getSource(LABELS_SOURCE_ID)) {
        map.addSource(LABELS_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }

      // Find insertion point: prefer to insert below dropped point symbols
      const style = map.getStyle && map.getStyle();
      const layers = (style && style.layers) ? style.layers : [];
      let beforeId;
      try {
        const prefer = layers.find(l => l && l.id === 'dropped-objects-symbol');
        if (prefer) beforeId = prefer.id; else {
          const anyDropped = layers.find(l => l && typeof l.id === 'string' && l.id.includes('dropped-objects'));
          beforeId = anyDropped ? anyDropped.id : undefined;
        }
      } catch (_) { beforeId = undefined; }

      // Resolve a safe insertion point only if the target layer currently exists
      const safeBeforeId = (id) => {
        try { return id && map.getLayer && map.getLayer(id) ? id : undefined; } catch (_) { return undefined; }
      };
      const insertBeforeId = safeBeforeId(beforeId);

      // Add fill layer with pattern support (use outline for visibility even when pattern is used)
      if (!map.getLayer(FILL_LAYER_ID)) {
        const layerDef = {
          id: FILL_LAYER_ID,
          type: 'fill',
          source: SOURCE_ID,
          paint: {
            'fill-color': ['get', 'fillColor'],
            // Keep an outline for contrast even if the separate line layer is temporarily missing
            'fill-outline-color': ['coalesce', ['get', 'strokeColor'], '#111827'],
            // When a texture pattern is present, let the pattern layer render the fill; keep only outline here
            'fill-opacity': [
              'case',
              ['has', 'fillPattern'],
              0,
              0.45
            ]
          }
        };
        if (insertBeforeId) map.addLayer(layerDef, insertBeforeId); else map.addLayer(layerDef);
        try { map.setLayoutProperty(FILL_LAYER_ID, 'visibility', 'visible'); } catch (_) {}
      }

      // Add separate pattern layer for textured rectangles only
      if (!map.getLayer(PATTERN_LAYER_ID)) {
        const layerDef = {
          id: PATTERN_LAYER_ID,
          type: 'fill',
          source: SOURCE_ID,
          paint: {
            'fill-pattern': ['get', 'fillPattern']
          },
          filter: ['has', 'fillPattern']
        };
        if (insertBeforeId) map.addLayer(layerDef, insertBeforeId); else map.addLayer(layerDef);
        try { map.setLayoutProperty(PATTERN_LAYER_ID, 'visibility', 'visible'); } catch (_) {}
      }

      // Add line layer for borders (selection emphasized)
      if (!map.getLayer(LINE_LAYER_ID)) {
        const layerDef = {
          id: LINE_LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          paint: {
            'line-color': [
              'case',
              ['boolean', ['get', 'selected'], false],
              '#2563eb',
              ['coalesce', ['get', 'strokeColor'], '#111827']
            ],
            'line-width': [
              'case',
              ['boolean', ['get', 'selected'], false],
              3,
              2
            ],
            'line-dasharray': [
              'case',
              ['boolean', ['get', 'selected'], false],
              ['literal', [4, 2]],
              ['literal', [1, 0]]
            ]
          }
        };
        if (insertBeforeId) map.addLayer(layerDef, insertBeforeId); else map.addLayer(layerDef);
        try { map.setLayoutProperty(LINE_LAYER_ID, 'visibility', 'visible'); } catch (_) {}
      }

      // Add resize handles layer (circles at corners)
      if (!map.getLayer(HANDLES_LAYER_ID)) {
        const layerDef = {
          id: HANDLES_LAYER_ID,
          type: 'circle',
          source: HANDLES_SOURCE_ID,
          paint: {
            'circle-radius': 6,
            'circle-color': '#2563eb',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          },
          filter: ['==', ['get', 'visible'], true]
        };
        if (insertBeforeId) map.addLayer(layerDef, insertBeforeId); else map.addLayer(layerDef);
      }

      // Add labels layer (dimension text)
      if (!map.getLayer(LABELS_LAYER_ID)) {
        const layerDef = {
          id: LABELS_LAYER_ID,
          type: 'symbol',
          source: LABELS_SOURCE_ID,
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 12,
            'text-anchor': 'center',
            'text-allow-overlap': true,
            'text-ignore-placement': true
          },
          paint: {
            'text-color': '#111827',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2
          }
        };
        if (insertBeforeId) map.addLayer(layerDef, insertBeforeId); else map.addLayer(layerDef);
      }

      // Mark as initialized if core layers exist
      if (map.getLayer(FILL_LAYER_ID)) {
        setLayersInitialized(true);
      }
    } catch (err) {
      console.error('[DroppedRectanglesMapLibre] Failed to initialize layers:', err);
    }
  }, [map]);

  // Watchdog: if layers disappear (e.g., after style changes), re-initialize
  useEffect(() => {
    if (!map) return;
    const check = () => {
      try {
        const have = map.getLayer && map.getLayer(FILL_LAYER_ID);
        if (!have) {
          if (shouldDebug()) { try { console.warn('[Rects] layers missing → reinitializing'); } catch (_) {} }
          if (layersInitialized) { try { setLayersInitialized(false); } catch (_) {} }
          initLayers();
        } else {
          if (!layersInitialized) {
            try { setLayersInitialized(true); } catch (_) {}
          }
        }
      } catch (_) {}
    };
    check();
    try { map.on('styledata', check); } catch (_) {}
    try { map.on('idle', check); } catch (_) {}
    return () => {
      try { map.off('styledata', check); } catch (_) {}
      try { map.off('idle', check); } catch (_) {}
    };
  }, [map, layersInitialized, initLayers]);

  useEffect(() => {
    if (!map || typeof map.getSource !== 'function') return;
    // Try immediate init if style is ready
    initLayers();
    // Re-initialize on style reloads
    const onStyleLoad = () => {
      try { setLayersInitialized(false); } catch (_) {}
      initLayers();
    };
    try { map.on('style.load', onStyleLoad); } catch (_) {}
    return () => {
      try { map.off('style.load', onStyleLoad); } catch (_) {}
      // Cleanup only on unmount/map change
      try {
        if (map.getLayer(LABELS_LAYER_ID)) map.removeLayer(LABELS_LAYER_ID);
        if (map.getLayer(HANDLES_LAYER_ID)) map.removeLayer(HANDLES_LAYER_ID);
        if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
        if (map.getLayer(PATTERN_LAYER_ID)) map.removeLayer(PATTERN_LAYER_ID);
        if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
        if (map.getSource(LABELS_SOURCE_ID)) map.removeSource(LABELS_SOURCE_ID);
        if (map.getSource(HANDLES_SOURCE_ID)) map.removeSource(HANDLES_SOURCE_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch (_) {}
      try { setLayersInitialized(false); } catch (_) {}
    };
  }, [map]);

  // Keep rectangle layers above basemap and below dropped-objects symbols
  useEffect(() => {
    if (!map || !layersInitialized) return;
    const reorder = () => {
      try {
        const style = map.getStyle && map.getStyle();
        const layers = (style && style.layers) ? style.layers : [];
        if (shouldDebug()) {
          try {
            const ids = layers.map(l => l && l.id).filter(Boolean);
            console.info('[Rects] current layer order', ids);
          } catch (_) {}
        }
        let beforeId;
        try {
          const preferSelected = layers.find(l => l && l.id === 'dropped-objects-selected');
          const preferSymbol = layers.find(l => l && l.id === 'dropped-objects-symbol');
          const prefer = preferSelected || preferSymbol;
          const idxSelected = layers.findIndex(l => l && l.id === 'dropped-objects-selected');
          const idxSymbol = layers.findIndex(l => l && l.id === 'dropped-objects-symbol');
          const minDroppedIdx = [idxSelected, idxSymbol].filter(i => i >= 0).reduce((a,b)=>Math.min(a,b), Number.POSITIVE_INFINITY);
          const maxPermitIdx = layers.reduce((acc, l, i) => {
            if (l && typeof l.id === 'string' && (l.id.startsWith('permit-areas') || l.id.startsWith('permitAreas'))) {
              return Math.max(acc, i);
            }
            return acc;
          }, -1);
          if (prefer) beforeId = prefer.id; else {
            const anyDropped = layers.find(l => l && typeof l.id === 'string' && l.id.includes('dropped-objects'));
            beforeId = anyDropped ? anyDropped.id : undefined;
          }
          // If any permit-areas layer is above dropped objects, push rectangles to top (no beforeId)
          if (maxPermitIdx >= 0 && maxPermitIdx >= minDroppedIdx) {
            beforeId = undefined;
          }
        } catch (_) { beforeId = undefined; }
        if (map.getLayer(FILL_LAYER_ID)) map.moveLayer(FILL_LAYER_ID, beforeId);
        if (map.getLayer(PATTERN_LAYER_ID)) map.moveLayer(PATTERN_LAYER_ID, beforeId);
        if (map.getLayer(LINE_LAYER_ID)) map.moveLayer(LINE_LAYER_ID, beforeId);
        if (map.getLayer(HANDLES_LAYER_ID)) map.moveLayer(HANDLES_LAYER_ID, beforeId);
        if (map.getLayer(LABELS_LAYER_ID)) map.moveLayer(LABELS_LAYER_ID, beforeId);
        if (shouldDebug()) {
          try {
            const idx = (id) => {
              const ls = (map.getStyle && map.getStyle()?.layers) || [];
              return ls.findIndex(l => l && l.id === id);
            };
            console.info('[Rects] z-order indices', {
              fill: idx(FILL_LAYER_ID),
              pattern: idx(PATTERN_LAYER_ID),
              line: idx(LINE_LAYER_ID),
              handles: idx(HANDLES_LAYER_ID),
              labels: idx(LABELS_LAYER_ID),
              beforeId
            });
          } catch (_) {}
        }
      } catch (_) {}
    };
    reorder();
    try { setTimeout(reorder, 60); } catch (_) {}
    try { map.on('style.load', reorder); } catch (_) {}
    try { map.on('styledata', reorder); } catch (_) {}
    try { map.on('idle', reorder); } catch (_) {}
    return () => {
      try { map.off('style.load', reorder); } catch (_) {}
      try { map.off('styledata', reorder); } catch (_) {}
      try { map.off('idle', reorder); } catch (_) {}
    };
  }, [map, layersInitialized]);

  // Update resize handles - defined before data update effect
  const updateHandles = useCallback(() => {
    if (!map || !layersInitialized) return;
    const source = map.getSource(HANDLES_SOURCE_ID);
    if (!source) return;

    if (!selectedId) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const rect = rects.find(r => r.id === selectedId);
    if (!rect || !rect.geometry?.coordinates?.[0]) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const corners = rect.geometry.coordinates[0].slice(0, 4);
    const handleFeatures = corners.map((coord, idx) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: coord
      },
      properties: {
        rectId: rect.id,
        handleIndex: idx,
        visible: true
      }
    }));

    source.setData({
      type: 'FeatureCollection',
      features: handleFeatures
    });
  }, [map, rects, selectedId, layersInitialized]);
  
  // Update labels - defined before data update effect
  const updateLabels = useCallback(() => {
    if (!map || !layersInitialized) return;
    const source = map.getSource(LABELS_SOURCE_ID);
    if (!source) return;

    const labelFeatures = rects.map(rectObj => {
      const type = placeableObjects.find(p => p.id === rectObj.type);
      const dims = rectObj?.properties?.dimensions || rectObj?.properties?.user_dimensions_m || {};
      
      // Generate label text
      let label = type?.name || 'Rectangle';
      try {
        const wM = dims?.width || 0;
        const hM = dims?.height || 0;
        if (type?.units === 'ft') {
          const wFt = Math.round(wM * 3.28084);
          const hFt = Math.round(hM * 3.28084);
          label = `${type.name} ${wFt} ft × ${hFt} ft`;
        } else if (wM > 0 && hM > 0) {
          label = `${type.name} ${wM.toFixed(1)} m × ${hM.toFixed(1)} m`;
        }
      } catch (_) {}
      
      // Calculate centroid from geometry
      const ring = rectObj.geometry?.coordinates?.[0];
      if (!ring || ring.length < 4) return null;
      
      const centroid = [
        (ring[0][0] + ring[2][0]) / 2,
        (ring[0][1] + ring[2][1]) / 2
      ];
      
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: centroid },
        properties: { label, rectId: rectObj.id }
      };
    }).filter(Boolean);
    
    source.setData({
      type: 'FeatureCollection',
      features: labelFeatures
    });
  }, [map, rects, placeableObjects, layersInitialized]);

  // Update GeoJSON data when rectangles change - optimized with shallow comparison
  useEffect(() => {
    if (!map) return;
    let source = map.getSource(SOURCE_ID);
    if (!source) {
      try {
        map.addSource(SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        source = map.getSource(SOURCE_ID);
      } catch (_) {}
    }
    if (!source) return;

    const features = rects.map(obj => {
      const type = placeableObjects.find(p => p.id === obj.type);
      const selected = obj.id === selectedId;
      const hasTexture = type?.texture?.url && !String(type.texture.url).toLowerCase().endsWith('.svg');
      
      // Build properties object, only include fillPattern if texture exists
      const properties = {
        id: obj.id,
        objectType: obj.type,
        selected,
        fillColor: type?.color || '#888888',
        // Prefer a dark, high-contrast outline by default so rectangles are always visible
        strokeColor: '#111827'
      };
      
      // Only add fillPattern property if texture exists (avoid "null" image lookup)
      if (hasTexture) {
        properties.fillPattern = obj.type; // Use object type as pattern ID
      }
      
      return {
        type: 'Feature',
        id: obj.id,
        geometry: obj.geometry,
        properties
      };
    });

    // Batch update using single setData call and cache for direct manipulation
    const fc = {
      type: 'FeatureCollection',
      features
    };
    try { source.setData(fc); } catch (e) {
      try {
        // Recreate source on failure (rare race)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
        map.addSource(SOURCE_ID, { type: 'geojson', data: fc });
      } catch (_) {}
    }
    if (shouldDebug()) {
      try {
        console.info('[DroppedRectangles overlay] setData', fc.features.length, fc.features.map(f => f.properties?.id));
        const style = map.getStyle && map.getStyle();
        const layerIds = (style?.layers || []).map(l => l.id);
        console.info('[DroppedRectangles overlay] style layers snapshot', layerIds);
        console.info('[DroppedRectangles overlay] visibility', {
          fill: map.getLayer(FILL_LAYER_ID) && map.getLayoutProperty(FILL_LAYER_ID, 'visibility'),
          pattern: map.getLayer(PATTERN_LAYER_ID) && map.getLayoutProperty(PATTERN_LAYER_ID, 'visibility'),
          line: map.getLayer(LINE_LAYER_ID) && map.getLayoutProperty(LINE_LAYER_ID, 'visibility'),
          handles: map.getLayer(HANDLES_LAYER_ID) && map.getLayoutProperty(HANDLES_LAYER_ID, 'visibility'),
          labels: map.getLayer(LABELS_LAYER_ID) && map.getLayoutProperty(LABELS_LAYER_ID, 'visibility')
        });
      } catch (_) {}
    }
    dataRef.current.fc = fc; // Cache for direct drag manipulation
  }, [map, rects, selectedId, layersInitialized, placeableObjects]);

  // Separate effect for handles (only updates when selection changes, skip during drag)
  useEffect(() => {
    if (!map || !layersInitialized || dragging || moving) return;
    updateHandles();
  }, [map, layersInitialized, selectedId, rects, updateHandles, dragging, moving]);

  // Separate effect for labels (updates when any rectangle changes, skip during drag for performance)
  useEffect(() => {
    if (!map || !layersInitialized || dragging || moving) return;
    updateLabels();
  }, [map, layersInitialized, rects, placeableObjects, updateLabels, dragging, moving]);

  // Click handlers for selection
  useEffect(() => {
    if (!map || !layersInitialized) return;

    const handleFillClick = (e) => {
      if (isPlacementActive) return;
      
      // Check if there's a dropped POINT object at this location first (not rectangles)
      const droppedFeatures = map.queryRenderedFeatures(e.point, {
        layers: map.getStyle().layers
          .filter(l => l.id && l.id.startsWith('dropped-objects'))
          .map(l => l.id)
      });
      
      if (droppedFeatures.length > 0) {
        return; // Prioritize dropped point objects
      }

      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const rectId = feature.properties?.id || feature.id;
        if (rectId && onSelectRect) {
          // Prevent this click from bubbling to MapContainer's onClick which would clear selection
          e.preventDefault();
          if (e.originalEvent) {
            e.originalEvent.stopPropagation();
          }
          onSelectRect(rectId);
        }
      }
    };

    const handleHandleMouseDown = (e) => {
      if (isPlacementActive || !e.features || e.features.length === 0) return;
      
      const feature = e.features[0];
      const { rectId, handleIndex } = feature.properties;
      
      setDragging({
        rectId,
        handleIndex,
        startLngLat: e.lngLat
      });
      
      e.preventDefault();
      map.getCanvas().style.cursor = 'grabbing';
    };

    map.on('click', FILL_LAYER_ID, handleFillClick);
    map.on('click', PATTERN_LAYER_ID, handleFillClick);
    map.on('mousedown', HANDLES_LAYER_ID, handleHandleMouseDown);

    // Cursor changes
    map.on('mouseenter', FILL_LAYER_ID, () => {
      if (!isPlacementActive) map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', FILL_LAYER_ID, () => {
      if (!dragging && !moving) map.getCanvas().style.cursor = '';
    });
    map.on('mouseenter', PATTERN_LAYER_ID, () => {
      if (!isPlacementActive) map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', PATTERN_LAYER_ID, () => {
      if (!dragging && !moving) map.getCanvas().style.cursor = '';
    });
    map.on('mouseenter', HANDLES_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'grab';
    });
    map.on('mouseleave', HANDLES_LAYER_ID, () => {
      if (!dragging) map.getCanvas().style.cursor = '';
    });

    return () => {
      map.off('click', FILL_LAYER_ID, handleFillClick);
      map.off('click', PATTERN_LAYER_ID, handleFillClick);
      map.off('mousedown', HANDLES_LAYER_ID, handleHandleMouseDown);
      map.off('mouseenter', FILL_LAYER_ID);
      map.off('mouseleave', FILL_LAYER_ID);
      map.off('mouseenter', PATTERN_LAYER_ID);
      map.off('mouseleave', PATTERN_LAYER_ID);
      map.off('mouseenter', HANDLES_LAYER_ID);
      map.off('mouseleave', HANDLES_LAYER_ID);
    };
  }, [map, layersInitialized, isPlacementActive, onSelectRect, dragging, moving]);

  // Helper: build resized geometry
  const buildResizedGeometry = useCallback((rect, handleIndex, mouseLngLat, constrainToSquare = false) => {
    if (!rect?.geometry?.coordinates?.[0]) return null;
    
    try {
      const coords = rect.geometry.coordinates[0];
      const pts = coords.slice(0, 4).map(c => map.project(c));
      
      const c = { x: (pts[0].x + pts[2].x) / 2, y: (pts[0].y + pts[2].y) / 2 };
      const e01 = { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y };
      const e30 = { x: pts[0].x - pts[3].x, y: pts[0].y - pts[3].y };
      const len = (v) => Math.hypot(v.x, v.y) || 1;
      const nu = len(e01);
      const nv = len(e30);
      const u = { x: e01.x / nu, y: e01.y / nu };
      const v = { x: e30.x / nv, y: e30.y / nv };
      
      const sign = (p) => {
        const dx = p.x - c.x, dy = p.y - c.y;
        const du = dx * u.x + dy * u.y;
        const dv = dx * v.x + dy * v.y;
        return { su: Math.sign(du) || 1, sv: Math.sign(dv) || 1 };
      };
      
      const s0 = sign(pts[0]);
      const s1 = sign(pts[1]);
      const s2 = sign(pts[2]);
      const s3 = sign(pts[3]);
      
      const mouse = map.project(mouseLngLat);
      const md = { x: mouse.x - c.x, y: mouse.y - c.y };
      let du = md.x * u.x + md.y * u.y;
      let dv = md.x * v.x + md.y * v.y;
      let nHalfW = Math.max(6, Math.abs(du));
      let nHalfH = Math.max(6, Math.abs(dv));
      
      if (constrainToSquare) {
        const size = Math.max(nHalfW, nHalfH);
        nHalfW = size;
        nHalfH = size;
      }
      
      const corner = (sgn) => [
        c.x + sgn.su * nHalfW * u.x + sgn.sv * nHalfH * v.x,
        c.y + sgn.su * nHalfW * u.y + sgn.sv * nHalfH * v.y
      ];
      
      const p0 = corner(s0);
      const p1 = corner(s1);
      const p2 = corner(s2);
      const p3 = corner(s3);
      
      const toLL = (p) => {
        const ll = map.unproject([p[0], p[1]]);
        return [ll.lng, ll.lat];
      };
      
      const ring = [toLL(p0), toLL(p1), toLL(p2), toLL(p3), toLL(p0)];
      return { type: 'Polygon', coordinates: [ring] };
    } catch (_) {
      return null;
    }
  }, [map]);

  // Helper: build moved geometry
  const buildMovedGeometry = useCallback((rect, startLngLat, endLngLat) => {
    if (!rect?.geometry?.coordinates?.[0]) return null;
    
    try {
      const coords = rect.geometry.coordinates[0];
      const startPt = map.project(startLngLat);
      const endPt = map.project(endLngLat);
      const deltaX = endPt.x - startPt.x;
      const deltaY = endPt.y - startPt.y;
      
      const newRing = coords.map(([lng, lat]) => {
        const screenPt = map.project([lng, lat]);
        const movedPt = { x: screenPt.x + deltaX, y: screenPt.y + deltaY };
        const newLL = map.unproject([movedPt.x, movedPt.y]);
        return [newLL.lng, newLL.lat];
      });
      
      return { type: 'Polygon', coordinates: [newRing] };
    } catch (_) {
      return null;
    }
  }, [map]);

  // Resize drag handlers - direct GeoJSON manipulation for performance
  useEffect(() => {
    if (!map || !dragging) return;

    const handleMouseMove = (e) => {
      const rect = rectsRef.current.find(r => r.id === dragging.rectId);
      if (!rect) return;

      const constrainToSquare = e.originalEvent?.shiftKey || false;
      const newGeom = buildResizedGeometry(rect, dragging.handleIndex, e.lngLat, constrainToSquare);
      
      if (!newGeom) return;
      
      // Direct manipulation of source data for smooth drag (no React re-render)
      const source = map.getSource(SOURCE_ID);
      if (source && dataRef.current.fc) {
        const fc = dataRef.current.fc;
        const featureIndex = fc.features.findIndex(f => f.properties.id === dragging.rectId);
        if (featureIndex !== -1) {
          fc.features[featureIndex] = {
            ...fc.features[featureIndex],
            geometry: newGeom
          };
          source.setData(fc);
        }
      }
    };

    const handleMouseUp = () => {
      // Apply final update through React for state sync (silent mode - no trigger increment)
      const rect = rectsRef.current.find(r => r.id === dragging.rectId);
      if (rect && onResizeRect) {
        const source = map.getSource(SOURCE_ID);
        const fc = source?._data;
        const feature = fc?.features?.find(f => f.properties.id === dragging.rectId);
        if (feature?.geometry) {
          onResizeRect(dragging.rectId, feature.geometry);
        }
      }
      setDragging(null);
      map.getCanvas().style.cursor = '';
      // Handles and labels will update via normal effect cycle when dragging state changes
    };

    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);

    return () => {
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
    };
  }, [map, dragging, onResizeRect, buildResizedGeometry]);

  // Move drag handlers - direct GeoJSON manipulation for performance
  useEffect(() => {
    if (!map || !moving) return;

    const handleMouseMove = (e) => {
      const rect = rectsRef.current.find(r => r.id === moving.rectId);
      if (!rect) return;

      const newGeom = buildMovedGeometry(rect, moving.startLngLat, e.lngLat);
      
      if (!newGeom) return;
      
      // Direct manipulation of source data for smooth drag (no React re-render)
      const source = map.getSource(SOURCE_ID);
      if (source && dataRef.current.fc) {
        const fc = dataRef.current.fc;
        const featureIndex = fc.features.findIndex(f => f.properties.id === moving.rectId);
        if (featureIndex !== -1) {
          fc.features[featureIndex] = {
            ...fc.features[featureIndex],
            geometry: newGeom
          };
          source.setData(fc);
        }
      }
    };

    const handleMouseUp = () => {
      // Apply final update through React for state sync (silent mode - no trigger increment)
      const rect = rectsRef.current.find(r => r.id === moving.rectId);
      if (rect && onMoveRect) {
        const source = map.getSource(SOURCE_ID);
        const fc = source?._data;
        const feature = fc?.features?.find(f => f.properties.id === moving.rectId);
        if (feature?.geometry) {
          onMoveRect(moving.rectId, feature.geometry);
        }
      }
      setMoving(null);
      map.getCanvas().style.cursor = '';
      // Handles and labels will update via normal effect cycle when moving state changes
    };

    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);

    return () => {
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
    };
  }, [map, moving, onMoveRect, buildMovedGeometry]);

  // Move drag initiation (on fill layer, when selected)
  useEffect(() => {
    if (!map || !layersInitialized) return;

    const handleFillMouseDown = (e) => {
      if (isPlacementActive || !e.features || e.features.length === 0) return;
      
      const feature = e.features[0];
      const rectId = feature.properties.id;
      
      // Only allow move if this rectangle is already selected
      if (rectId === selectedId) {
        setMoving({
          rectId,
          startLngLat: e.lngLat
        });
        
        e.preventDefault();
        map.getCanvas().style.cursor = 'move';
      }
    };

    map.on('mousedown', FILL_LAYER_ID, handleFillMouseDown);
    map.on('mousedown', PATTERN_LAYER_ID, handleFillMouseDown);

    return () => {
      map.off('mousedown', FILL_LAYER_ID, handleFillMouseDown);
      map.off('mousedown', PATTERN_LAYER_ID, handleFillMouseDown);
    };
  }, [map, layersInitialized, isPlacementActive, selectedId]);

  return null; // Pure MapLibre layer component, no DOM
};

export default DroppedRectanglesMapLibre;
