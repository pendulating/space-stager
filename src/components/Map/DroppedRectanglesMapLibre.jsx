// components/Map/DroppedRectanglesMapLibre.jsx
// MapLibre-based rectangle rendering for proper z-ordering with dropped objects
import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import * as turf from '@turf/turf';
import { useMapEvents } from '../../hooks/useMapEvents';
import { ensureLayersBetweenPermitAreasAndDroppedObjects } from '../../utils/mapLayerUtils';

const DEBUG = true;
const shouldDebug = () => DEBUG || Boolean(typeof window !== 'undefined' && window.__RECT_DEBUG__);

const SOURCE_ID = 'dropped-rectangles';
const FILL_LAYER_ID = 'dropped-rectangles-fill';
const LINE_LAYER_ID = 'dropped-rectangles-line';
const HANDLES_LAYER_ID = 'dropped-rectangles-handles';
const HANDLES_SOURCE_ID = 'dropped-rectangles-handles';
const LABELS_LAYER_ID = 'dropped-rectangles-labels';
const LABELS_TITLE_LAYER_ID = 'dropped-rectangles-labels-title';
const LABELS_SOURCE_ID = 'dropped-rectangles-labels';
const PATTERN_LAYER_ID = 'dropped-rectangles-pattern';
const MOVE_SOURCE_ID = 'dropped-rectangles-moving';
const MOVE_FILL_LAYER_ID = 'dropped-rectangles-moving-fill';
const MOVE_LINE_LAYER_ID = 'dropped-rectangles-moving-line';

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
  if (shouldDebug()) {
    console.info('[DroppedRectangles] Rendering with objects:', objects.length, 'selectedId:', selectedId);
  }
  const [layersInitialized, setLayersInitialized] = useState(false);
  const [dragging, setDragging] = useState(null); // { rectId, handleIndex, startLngLat }
  const [moving, setMoving] = useState(null); // { rectId, startLngLat, offset }
  const dataRef = useRef({ fc: null }); // Cache for direct data manipulation during drag
  const rectsRef = useRef([]); // Stable reference for drag handlers
  const resizeRafRef = useRef(null);
  const pendingResizeRef = useRef(null);
  const moveRafRef = useRef(null);
  const pendingMoveRef = useRef(null);
  const activeRectIdRef = useRef(null);
  
  // Filter rectangles from objects
  const rects = useMemo(() => {
    const filtered = objects.filter(obj => {
      const type = placeableObjects.find(p => p.id === obj.type);
      const isRect = type && type.geometryType === 'rect';
      const hasValidGeometry = obj?.geometry?.coordinates?.[0]?.length >= 4;
      return isRect && hasValidGeometry;
    });
    if (shouldDebug()) {
      console.info('[DroppedRectangles] Filtered rects:', filtered.length, 'from total objects:', objects.length);
    }
    return filtered;
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
      try { if (String(path).toLowerCase().endsWith('.svg')) return; } catch (_) {}
      
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
    const tileIcons = (placeableObjects || []).filter(o => o && o.tileIcon);
    
    const registerAll = async () => {
      // 1. Register textures
      for (const t of textures) {
        const id = String(t.id);
        try {
          if (map.hasImage && map.hasImage(id)) continue;
          const url = String(t.texture.url || '');
          if (url.toLowerCase().endsWith('.svg')) continue;
          const img = await new Promise((resolve) => {
            const i = new Image();
            i.crossOrigin = 'anonymous';
            i.onload = () => resolve(i);
            i.onerror = () => resolve(null);
            i.src = url;
          });
          if (img && !map.hasImage(id)) {
            map.addImage(id, img, { pixelRatio: 2 });
            if (shouldDebug()) console.log(`[DroppedRectangles] Registered texture: ${id}`);
          }
        } catch (_) {}
      }

      // 2. Register tile icons
      for (const t of tileIcons) {
        const id = t.tileIcon;
        if (map.hasImage && map.hasImage(id)) continue;
        
        // Try multiple paths
        const paths = [
          `/data/icons/dropped-objects/${id}.svg`,
          `/data/icons/layers/${id}.svg`,
          `/data/icons/dropped-objects/SVG/${id}.svg`
        ];

        let loaded = false;
        for (const url of paths) {
          if (loaded) break;
          try {
            const img = await new Promise((resolve) => {
              const i = new Image();
              i.crossOrigin = 'anonymous';
              i.onload = () => resolve(i);
              i.onerror = () => resolve(null);
              i.src = url;
            });
            if (img && !map.hasImage(id)) {
              map.addImage(id, img, { pixelRatio: 2 });
              if (shouldDebug()) console.log(`[DroppedRectangles] Registered tile icon: ${id} from ${url}`);
              loaded = true;
            }
          } catch (_) {}
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
      if (shouldDebug()) console.info('[DroppedRectangles] Starting initLayers');
      // Add sources
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          promoteId: 'id'
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
      if (shouldDebug()) console.info('[DroppedRectangles] insertBeforeId:', insertBeforeId);

      // Add fill layer with pattern support
      if (!map.getLayer(FILL_LAYER_ID)) {
        if (shouldDebug()) console.info('[DroppedRectangles] Adding fill layer');
        const layerDef = {
          id: FILL_LAYER_ID,
          type: 'fill',
          source: SOURCE_ID,
          paint: {
            'fill-color': ['get', 'fillColor'],
            'fill-outline-color': ['coalesce', ['get', 'strokeColor'], '#111827'],
            'fill-opacity': [
              'case',
              ['boolean', ['feature-state', 'hidden'], false], 0,
              ['has', 'fillPattern'], 0,
              0.45
            ]
          }
        };
        if (insertBeforeId) map.addLayer(layerDef, insertBeforeId); else map.addLayer(layerDef);
        try { map.setLayoutProperty(FILL_LAYER_ID, 'visibility', 'visible'); } catch (_) {}
      }

      // Add separate pattern layer
      if (!map.getLayer(PATTERN_LAYER_ID)) {
        if (shouldDebug()) console.info('[DroppedRectangles] Adding pattern layer');
        const layerDef = {
          id: PATTERN_LAYER_ID,
          type: 'fill',
          source: SOURCE_ID,
          paint: {
            'fill-pattern': ['get', 'fillPattern'],
            'fill-opacity': [
              'case',
              ['boolean', ['feature-state', 'hidden'], false], 0,
              1
            ]
          },
          filter: ['has', 'fillPattern']
        };
        if (insertBeforeId) map.addLayer(layerDef, insertBeforeId); else map.addLayer(layerDef);
        try { map.setLayoutProperty(PATTERN_LAYER_ID, 'visibility', 'visible'); } catch (_) {}
      }

      // Add line layer
      if (!map.getLayer(LINE_LAYER_ID)) {
        if (shouldDebug()) console.info('[DroppedRectangles] Adding line layer');
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
              4,
              2
            ],
            'line-opacity': [
              'case',
              ['boolean', ['feature-state', 'hidden'], false], 0,
              1
            ]
          }
        };
        if (insertBeforeId) map.addLayer(layerDef, insertBeforeId); else map.addLayer(layerDef);
        try { map.setLayoutProperty(LINE_LAYER_ID, 'visibility', 'visible'); } catch (_) {}
      }

      // Add moving overlay
      if (!map.getSource(MOVE_SOURCE_ID)) {
        map.addSource(MOVE_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'id' });
      }
      if (!map.getLayer(MOVE_FILL_LAYER_ID)) {
        if (shouldDebug()) console.info('[DroppedRectangles] Adding move-fill layer');
        const def = {
          id: MOVE_FILL_LAYER_ID,
          type: 'fill',
          source: MOVE_SOURCE_ID,
          paint: {
            'fill-color': ['coalesce', ['get', 'fillColor'], '#888888'],
            'fill-outline-color': ['coalesce', ['get', 'strokeColor'], '#111827'],
            'fill-opacity': 0.35
          }
        };
        if (insertBeforeId) map.addLayer(def, insertBeforeId); else map.addLayer(def);
      }
      if (!map.getLayer(MOVE_LINE_LAYER_ID)) {
        if (shouldDebug()) console.info('[DroppedRectangles] Adding move-line layer');
        const def = {
          id: MOVE_LINE_LAYER_ID,
          type: 'line',
          source: MOVE_SOURCE_ID,
          paint: {
            'line-color': ['coalesce', ['get', 'strokeColor'], '#111827'],
            'line-width': 2,
            'line-opacity': 1
          }
        };
        if (insertBeforeId) map.addLayer(def, insertBeforeId); else map.addLayer(def);
      }

      // Add resize handles
      if (!map.getLayer(HANDLES_LAYER_ID)) {
        if (shouldDebug()) console.info('[DroppedRectangles] Adding handles layer');
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

      // Add labels layer
      if (!map.getLayer(LABELS_LAYER_ID)) {
        if (shouldDebug()) console.info('[DroppedRectangles] Adding labels layer');
        const layerDef = {
          id: LABELS_LAYER_ID,
          type: 'symbol',
          source: LABELS_SOURCE_ID,
          layout: {
            'text-field': ['coalesce', ['get', 'label'], ''],
            'text-font': ['Open Sans Regular'],
            'text-size': [
              'interpolate', 
              ['exponential', 2], 
              ['zoom'],
              10, 0.5,
              20, 14
            ],
            'text-anchor': 'top',
            'text-offset': [0, 1.2],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'text-max-width': 8
          },
          paint: {
            'text-color': '#4b5563',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5,
            'text-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              16, 0,
              17, 0.9
            ]
          }
        };
        // Always add labels at the top
        map.addLayer(layerDef);
      }

      // Add labels title layer
      if (!map.getLayer(LABELS_TITLE_LAYER_ID)) {
        if (shouldDebug()) console.info('[DroppedRectangles] Adding labels-title layer');
        const layerDef = {
          id: LABELS_TITLE_LAYER_ID,
          type: 'symbol',
          source: LABELS_SOURCE_ID,
          layout: {
            'text-field': ['coalesce', ['get', 'title'], 'AREA'],
            'text-font': ['Open Sans Bold'], // Most robust bold
            'text-size': [
              'interpolate', 
              ['exponential', 2], 
              ['zoom'],
              10, 1,
              20, 24
            ],
            'text-anchor': 'center',
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'text-transform': 'uppercase',
            'text-letter-spacing': 0.1,
            'text-max-width': 10
          },
          paint: {
            'text-color': '#111827',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
            'text-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15, 0,
              16, 0.8
            ]
          }
        };
        // Always add labels at the top
        map.addLayer(layerDef);
      }

      // Mark as initialized if core layers exist
      const allRequiredLayers = [FILL_LAYER_ID, LINE_LAYER_ID, LABELS_LAYER_ID, LABELS_TITLE_LAYER_ID];
      const allPresent = allRequiredLayers.every(id => !!map.getLayer(id));
      if (allPresent && !layersInitialized) {
        setLayersInitialized(true);
      }
    } catch (err) {
      console.error('[DroppedRectanglesMapLibre] Failed to initialize layers:', err);
    }
  }, [map, layersInitialized]);

  // Watchdog: if layers disappear (e.g., after style changes), re-initialize
  useEffect(() => {
    if (!map) return;
    const check = () => {
      try {
        const required = [FILL_LAYER_ID, LINE_LAYER_ID, LABELS_LAYER_ID, LABELS_TITLE_LAYER_ID];
        const missing = required.filter(id => !map.getLayer(id));
        if (missing.length > 0) {
          if (shouldDebug()) { try { console.warn('[Rects] layers missing → reinitializing', missing); } catch (_) {} }
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
        if (map.getLayer(LABELS_TITLE_LAYER_ID)) map.removeLayer(LABELS_TITLE_LAYER_ID);
        if (map.getLayer(LABELS_LAYER_ID)) map.removeLayer(LABELS_LAYER_ID);
        if (map.getLayer(HANDLES_LAYER_ID)) map.removeLayer(HANDLES_LAYER_ID);
        if (map.getLayer(MOVE_LINE_LAYER_ID)) map.removeLayer(MOVE_LINE_LAYER_ID);
        if (map.getLayer(MOVE_FILL_LAYER_ID)) map.removeLayer(MOVE_FILL_LAYER_ID);
        if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
        if (map.getLayer(PATTERN_LAYER_ID)) map.removeLayer(PATTERN_LAYER_ID);
        if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
        if (map.getSource(MOVE_SOURCE_ID)) map.removeSource(MOVE_SOURCE_ID);
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
    const apply = () => {
      try { ensureLayersBetweenPermitAreasAndDroppedObjects(map, [FILL_LAYER_ID, PATTERN_LAYER_ID, LINE_LAYER_ID, HANDLES_LAYER_ID, LABELS_LAYER_ID, LABELS_TITLE_LAYER_ID]); } catch (_) {}
    };
    apply();
    try { setTimeout(apply, 60); } catch (_) {}
    try { map.on('style.load', apply); } catch (_) {}
    try { map.on('idle', apply); } catch (_) {}
    return () => {
      try { map.off('style.load', apply); } catch (_) {}
      try { map.off('idle', apply); } catch (_) {}
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
      
      const title = (type?.name || 'Area').toUpperCase();

      // Generate label text (dimensions)
      let label = '';
      try {
        const wM = dims?.width || 0;
        const hM = dims?.height || 0;
        if (type?.units === 'ft') {
          const wFt = Math.round(wM * 3.28084);
          const hFt = Math.round(hM * 3.28084);
          label = `${wFt} ft × ${hFt} ft`;
        } else if (wM > 0 && hM > 0) {
          label = `${wM.toFixed(1)} m × ${hM.toFixed(1)} m`;
        }
      } catch (_) {}
      
      // Calculate centroid from geometry
      const ring = rectObj.geometry?.coordinates?.[0];
      if (!ring || ring.length < 4) return null;
      
      let centroid;
      try {
        centroid = turf.centroid(turf.polygon([ring])).geometry.coordinates;
      } catch (err) {
        centroid = [
          (ring[0][0] + ring[2][0]) / 2,
          (ring[0][1] + ring[2][1]) / 2
        ];
      }
      
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: centroid },
        properties: { label, title, rectId: rectObj.id }
      };
    }).filter(Boolean);
    
    if (shouldDebug()) {
      console.info('[DroppedRectangles] Updating labels', labelFeatures.length, labelFeatures);
    }
    
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
          labels: map.getLayer(LABELS_LAYER_ID) && map.getLayoutProperty(LABELS_LAYER_ID, 'visibility'),
          labelsTitle: map.getLayer(LABELS_TITLE_LAYER_ID) && map.getLayoutProperty(LABELS_TITLE_LAYER_ID, 'visibility')
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

  // Centralized handlers used with useMapEvents (must be defined at top-level)
  const handleFillClick = useCallback((e) => {
    if (!map || isPlacementActive) return;
    try {
      const droppedFeatures = map.queryRenderedFeatures(e.point, {
        layers: map.getStyle().layers
          .filter(l => l.id && l.id.startsWith('dropped-objects'))
          .map(l => l.id)
      });
      if (droppedFeatures.length > 0) return;
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const rectId = feature.properties?.id || feature.id;
        if (rectId && onSelectRect) {
          e.preventDefault();
          if (e.originalEvent && typeof e.originalEvent.stopPropagation === 'function') e.originalEvent.stopPropagation();
          onSelectRect(rectId);
        }
      }
    } catch (_) {}
  }, [map, isPlacementActive, onSelectRect]);

  const handleHandleMouseDown = useCallback((e) => {
    if (!map || isPlacementActive || !e.features || e.features.length === 0) return;
    try {
      // Guard: ignore multi-touch to preserve pinch-zoom/rotate
      try {
        const touches = e && e.originalEvent && e.originalEvent.touches;
        if (touches && touches.length !== 1) return;
      } catch (_) {}

      const feature = e.features[0];
      const { rectId, handleIndex } = feature.properties || {};
      if (!rectId && !handleIndex && feature.properties?.id != null) {
        // Fallback: handle features are points with properties
      }
      try { map.setFeatureState({ source: SOURCE_ID, id: rectId }, { hidden: true }); } catch (_) {}
      try {
        const src = map.getSource(SOURCE_ID);
        const fc = src?._data;
        const f = fc?.features?.find(ff => ff.properties?.id === rectId);
        const mv = map.getSource(MOVE_SOURCE_ID);
        if (f && mv && mv.setData) mv.setData({ type: 'FeatureCollection', features: [f] });
      } catch (_) {}
      setDragging({ rectId, handleIndex, startLngLat: e.lngLat });
      e.preventDefault();
      try { map && map.dragPan && map.dragPan.disable && map.dragPan.disable(); } catch (_) {}
      try { map && map.dragRotate && map.dragRotate.disable && map.dragRotate.disable(); } catch (_) {}
      try { map.getCanvas().style.cursor = 'grabbing'; } catch (_) {}
    } catch (_) {}
  }, [map, isPlacementActive]);

  const handleFillMouseDownMove = useCallback((e) => {
    if (!map || !layersInitialized || isPlacementActive || !e.features || e.features.length === 0) return;
    try {
      // Guard: ignore multi-touch to preserve pinch-zoom/rotate
      try {
        const touches = e && e.originalEvent && e.originalEvent.touches;
        if (touches && touches.length !== 1) return;
      } catch (_) {}

      const feature = e.features[0];
      const rectId = feature.properties && feature.properties.id;
      if (rectId === selectedId) {
        try { map.setFeatureState({ source: SOURCE_ID, id: rectId }, { hidden: true }); } catch (_) {}
        try {
          const src = map.getSource(SOURCE_ID);
          const fc = src?._data;
          const f = fc?.features?.find(ff => ff.properties?.id === rectId);
          const mv = map.getSource(MOVE_SOURCE_ID);
          if (f && mv && mv.setData) mv.setData({ type: 'FeatureCollection', features: [f] });
        } catch (_) {}
        setMoving({ rectId, startLngLat: e.lngLat });
        e.preventDefault();
        try { map.getCanvas().style.cursor = 'move'; } catch (_) {}
      }
    } catch (_) {}
  }, [map, layersInitialized, isPlacementActive, selectedId]);

  const onEnterFill = useCallback(() => { try { if (!isPlacementActive) map.getCanvas().style.cursor = 'pointer'; } catch (_) {} }, [map, isPlacementActive]);
  const onLeaveFill = useCallback(() => { try { if (!dragging && !moving) map.getCanvas().style.cursor = ''; } catch (_) {} }, [map, dragging, moving]);
  const onEnterPattern = useCallback(() => { try { if (!isPlacementActive) map.getCanvas().style.cursor = 'pointer'; } catch (_) {} }, [map, isPlacementActive]);
  const onLeavePattern = useCallback(() => { try { if (!dragging && !moving) map.getCanvas().style.cursor = ''; } catch (_) {} }, [map, dragging, moving]);
  const onEnterHandle = useCallback(() => { try { map.getCanvas().style.cursor = 'grab'; } catch (_) {} }, [map]);
  const onLeaveHandle = useCallback(() => { try { if (!dragging) map.getCanvas().style.cursor = ''; } catch (_) {} }, [map, dragging]);

  // Attach events manually to avoid any hook ordering issues during isometric toggles
  useEffect(() => {
    if (!map || !layersInitialized) return;
    try { map.on('click', FILL_LAYER_ID, handleFillClick); } catch (_) {}
    try { map.on('click', PATTERN_LAYER_ID, handleFillClick); } catch (_) {}
    try { map.on('mousedown', HANDLES_LAYER_ID, handleHandleMouseDown); } catch (_) {}
    try { map.on('mousedown', FILL_LAYER_ID, handleFillMouseDownMove); } catch (_) {}
    try { map.on('mousedown', PATTERN_LAYER_ID, handleFillMouseDownMove); } catch (_) {}
    try { map.on('touchstart', HANDLES_LAYER_ID, handleHandleMouseDown); } catch (_) {}
    try { map.on('touchstart', FILL_LAYER_ID, handleFillMouseDownMove); } catch (_) {}
    try { map.on('touchstart', PATTERN_LAYER_ID, handleFillMouseDownMove); } catch (_) {}
    try { map.on('mouseenter', FILL_LAYER_ID, onEnterFill); } catch (_) {}
    try { map.on('mouseleave', FILL_LAYER_ID, onLeaveFill); } catch (_) {}
    try { map.on('mouseenter', PATTERN_LAYER_ID, onEnterPattern); } catch (_) {}
    try { map.on('mouseleave', PATTERN_LAYER_ID, onLeavePattern); } catch (_) {}
    try { map.on('mouseenter', HANDLES_LAYER_ID, onEnterHandle); } catch (_) {}
    try { map.on('mouseleave', HANDLES_LAYER_ID, onLeaveHandle); } catch (_) {}
    return () => {
      try { map.off('click', FILL_LAYER_ID, handleFillClick); } catch (_) {}
      try { map.off('click', PATTERN_LAYER_ID, handleFillClick); } catch (_) {}
      try { map.off('mousedown', HANDLES_LAYER_ID, handleHandleMouseDown); } catch (_) {}
      try { map.off('mousedown', FILL_LAYER_ID, handleFillMouseDownMove); } catch (_) {}
      try { map.off('mousedown', PATTERN_LAYER_ID, handleFillMouseDownMove); } catch (_) {}
      try { map.off('touchstart', HANDLES_LAYER_ID, handleHandleMouseDown); } catch (_) {}
      try { map.off('touchstart', FILL_LAYER_ID, handleFillMouseDownMove); } catch (_) {}
      try { map.off('touchstart', PATTERN_LAYER_ID, handleFillMouseDownMove); } catch (_) {}
      try { map.off('mouseenter', FILL_LAYER_ID, onEnterFill); } catch (_) {}
      try { map.off('mouseleave', FILL_LAYER_ID, onLeaveFill); } catch (_) {}
      try { map.off('mouseenter', PATTERN_LAYER_ID, onEnterPattern); } catch (_) {}
      try { map.off('mouseleave', PATTERN_LAYER_ID, onLeavePattern); } catch (_) {}
      try { map.off('mouseenter', HANDLES_LAYER_ID, onEnterHandle); } catch (_) {}
      try { map.off('mouseleave', HANDLES_LAYER_ID, onLeaveHandle); } catch (_) {}
    };
  }, [map, layersInitialized, handleFillClick, handleHandleMouseDown, handleFillMouseDownMove, onEnterFill, onLeaveFill, onEnterPattern, onLeavePattern, onEnterHandle, onLeaveHandle]);

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

    const tick = () => {
      try {
        const pending = pendingResizeRef.current;
        if (!pending || !dragging) { resizeRafRef.current = null; return; }
        // Update lightweight moving overlay only
        const mv = map.getSource(MOVE_SOURCE_ID);
        if (mv && mv.setData) {
          let baseProps = {};
          try {
            const curFc = dataRef.current.fc;
            const baseF = curFc?.features?.find(ff => ff?.properties?.id === dragging.rectId);
            baseProps = (baseF && baseF.properties) || {};
          } catch (_) {}
          const f = {
            type: 'Feature',
            id: dragging.rectId,
            geometry: pending,
            properties: {
              id: dragging.rectId,
              fillColor: baseProps.fillColor || '#888888',
              strokeColor: baseProps.strokeColor || '#111827'
            }
          };
          mv.setData({ type: 'FeatureCollection', features: [f] });
        }
        // Update handles to match the pending geometry so corner dots move/scale during resize
        try {
          const hs = map.getSource(HANDLES_SOURCE_ID);
          if (hs && typeof hs.setData === 'function') {
            const ring = Array.isArray(pending?.coordinates?.[0]) ? pending.coordinates[0] : [];
            const corners = ring.slice(0, 4);
            const handleFeatures = corners.map((coord, idx) => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: coord },
              properties: { rectId: dragging.rectId, handleIndex: idx, visible: true }
            }));
            hs.setData({ type: 'FeatureCollection', features: handleFeatures });
          }
        } catch (_) {}
        // Update dimension label live to reflect current size during resize
        try {
          const lbl = map.getSource(LABELS_SOURCE_ID);
          if (lbl && typeof lbl.setData === 'function') {
            const ring = Array.isArray(pending?.coordinates?.[0]) ? pending.coordinates[0] : [];
            if (ring.length >= 4) {
              const rect = rectsRef.current.find(r => r.id === dragging.rectId);
              const type = placeableObjects.find(p => p.id === rect?.type);
              const centroid = [
                (ring[0][0] + ring[2][0]) / 2,
                (ring[0][1] + ring[2][1]) / 2
              ];
              // Broadcast centroid for external UI (e.g., Edit / ✕ popup)
              try {
                const pt = map.project(centroid);
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('rect:ui:centroid', { detail: { id: dragging.rectId, x: pt.x, y: pt.y } }));
                }
              } catch (_) {}
              // Great-circle distance helper (meters)
              const dist = (p, q) => {
                const R = 6378137;
                const toRad = (d) => d * Math.PI / 180;
                const dLat = toRad(q[1] - p[1]);
                const dLon = toRad(q[0] - p[0]);
                const lat1 = toRad(p[1]);
                const lat2 = toRad(q[1]);
                const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
                return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
              };
              const wMeters = dist(ring[0], ring[1]);
              const hMeters = dist(ring[1], ring[2]);
              let label = type?.name || 'Rectangle';
              try {
                if (type?.units === 'ft') {
                  const wFt = Math.round(wMeters * 3.28084);
                  const hFt = Math.round(hMeters * 3.28084);
                  label = `${type?.name || 'Rectangle'} ${wFt} ft × ${hFt} ft`;
                } else {
                  label = `${type?.name || 'Rectangle'} ${wMeters.toFixed(1)} m × ${hMeters.toFixed(1)} m`;
                }
              } catch (_) {}
              const newFeat = { type: 'Feature', geometry: { type: 'Point', coordinates: centroid }, properties: { label, rectId: dragging.rectId } };
              const cur = lbl._data;
              let nextFeatures = [];
              if (cur && Array.isArray(cur.features)) {
                nextFeatures = cur.features.filter(f => f && f.properties && f.properties.rectId !== dragging.rectId);
              }
              nextFeatures.push(newFeat);
              lbl.setData({ type: 'FeatureCollection', features: nextFeatures });
            }
          }
        } catch (_) {}
        resizeRafRef.current = requestAnimationFrame(tick);
      } catch (_) { resizeRafRef.current = null; }
    };

    const ensureTick = () => { if (!resizeRafRef.current) resizeRafRef.current = requestAnimationFrame(tick); };

    const handleMouseMove = (e) => {
      const rect = rectsRef.current.find(r => r.id === dragging.rectId);
      if (!rect) return;
      const constrainToSquare = e.originalEvent?.shiftKey || false;
      const newGeom = buildResizedGeometry(rect, dragging.handleIndex, e.lngLat, constrainToSquare);
      if (!newGeom) return;
      // Skip tiny pixel delta updates to reduce churn
      try {
        const cur = dataRef.current.fc?.features?.find(f => f.properties?.id === dragging.rectId)?.geometry;
        const curP = Array.isArray(cur?.coordinates?.[0]) ? cur.coordinates[0][0] : null;
        const newP = Array.isArray(newGeom.coordinates?.[0]) ? newGeom.coordinates[0][0] : null;
        if (curP && newP) {
          const a = map.project(curP);
          const b = map.project(newP);
          const dx = Math.abs(a.x - b.x);
          const dy = Math.abs(a.y - b.y);
          if (dx < 1 && dy < 1) return;
        }
      } catch (_) {}
      pendingResizeRef.current = newGeom;
      ensureTick();
    };

    const handleMouseUp = () => {
      // Apply final update through React for state sync (silent mode - no trigger increment)
      const rect = rectsRef.current.find(r => r.id === dragging.rectId);
      if (rect && onResizeRect) {
        let finalGeom = pendingResizeRef.current || null;
        try {
          if (!finalGeom) {
            // Fall back to the moving overlay source, which reflects the latest geometry
            const mv = map.getSource(MOVE_SOURCE_ID);
            const fcMv = mv?._data;
            const featMv = fcMv?.features?.find(f => (f.id === dragging.rectId) || (f.properties && f.properties.id === dragging.rectId));
            if (featMv && featMv.geometry) finalGeom = featMv.geometry;
          }
        } catch (_) {}
        try {
          if (!finalGeom) {
            // Last resort: compute once more from current mouse position by projecting back to rect center
            // (If no movement occurred, this will be null and we skip update)
          }
        } catch (_) {}
        if (finalGeom) {
          onResizeRect(dragging.rectId, finalGeom);
        }
      }
      // Unhide base feature
      try { map.setFeatureState({ source: SOURCE_ID, id: dragging.rectId }, { hidden: false }); } catch (_) {}
      try { const s = map.getSource(MOVE_SOURCE_ID); if (s && s.setData) s.setData({ type: 'FeatureCollection', features: [] }); } catch (_) {}
      setDragging(null);
      map.getCanvas().style.cursor = '';
      try { if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current); } catch (_) {}
      resizeRafRef.current = null;
      pendingResizeRef.current = null;
      try { map && map.dragPan && map.dragPan.enable && map.dragPan.enable(); } catch (_) {}
      try { map && map.dragRotate && map.dragRotate.enable && map.dragRotate.enable(); } catch (_) {}
      try { map && map.dragPan && map.dragPan.enable && map.dragPan.enable(); } catch (_) {}
      try { map && map.dragRotate && map.dragRotate.enable && map.dragRotate.enable(); } catch (_) {}
      // Handles and labels will update via normal effect cycle when dragging state changes
      try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('rect:ui:centroid-end', { detail: { id: dragging.rectId } })); } catch (_) {}
    };

    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);
    // Touch parity: allow single-finger drag, don't interfere with pinch (multi-touch guarded at start)
    map.on('touchmove', handleMouseMove);
    map.on('touchend', handleMouseUp);

    return () => {
      try { if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current); } catch (_) {}
      resizeRafRef.current = null;
      pendingResizeRef.current = null;
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
      map.off('touchmove', handleMouseMove);
      map.off('touchend', handleMouseUp);
    };
  }, [map, dragging, onResizeRect, buildResizedGeometry]);

  // Move drag handlers - direct GeoJSON manipulation for performance
  useEffect(() => {
    if (!map || !moving) return;

    const tick = () => {
      try {
        const pending = pendingMoveRef.current;
        if (!pending || !moving) { moveRafRef.current = null; return; }
        // Update lightweight moving overlay only
        const mv = map.getSource(MOVE_SOURCE_ID);
        if (mv && mv.setData) {
          let baseProps = {};
          try {
            const curFc = dataRef.current.fc;
            const baseF = curFc?.features?.find(ff => ff?.properties?.id === moving.rectId);
            baseProps = (baseF && baseF.properties) || {};
          } catch (_) {}
          const f = {
            type: 'Feature',
            id: moving.rectId,
            geometry: pending,
            properties: {
              id: moving.rectId,
              fillColor: baseProps.fillColor || '#888888',
              strokeColor: baseProps.strokeColor || '#111827'
            }
          };
          mv.setData({ type: 'FeatureCollection', features: [f] });
        }
        // Update handles to match the pending moved geometry so corner dots follow during move
        try {
          const hs = map.getSource(HANDLES_SOURCE_ID);
          if (hs && typeof hs.setData === 'function') {
            const ring = Array.isArray(pending?.coordinates?.[0]) ? pending.coordinates[0] : [];
            const corners = ring.slice(0, 4);
            const handleFeatures = corners.map((coord, idx) => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: coord },
              properties: { rectId: moving.rectId, handleIndex: idx, visible: true }
            }));
            hs.setData({ type: 'FeatureCollection', features: handleFeatures });
          }
        } catch (_) {}
        // Update label position (centroid) during move, preserving existing text
        try {
          const lbl = map.getSource(LABELS_SOURCE_ID);
          if (lbl && typeof lbl.setData === 'function') {
            const ring = Array.isArray(pending?.coordinates?.[0]) ? pending.coordinates[0] : [];
            if (ring.length >= 4) {
              const centroid = [
                (ring[0][0] + ring[2][0]) / 2,
                (ring[0][1] + ring[2][1]) / 2
              ];
              // Broadcast centroid for external UI (e.g., Edit / ✕ popup)
              try {
                const pt = map.project(centroid);
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('rect:ui:centroid', { detail: { id: moving.rectId, x: pt.x, y: pt.y } }));
                }
              } catch (_) {}
              // Try to reuse existing label text for this rect
              const cur = lbl._data;
              let nextFeatures = [];
              let existingLabel = null;
              if (cur && Array.isArray(cur.features)) {
                nextFeatures = cur.features.filter(f => f && f.properties && f.properties.rectId !== moving.rectId);
                const prev = cur.features.find(f => f && f.properties && f.properties.rectId === moving.rectId);
                existingLabel = prev && prev.properties && prev.properties.label;
              }
              // Fallback to recomputing a simple label if missing
              if (!existingLabel) {
                const rectObj = rectsRef.current.find(r => r.id === moving.rectId);
                const type = placeableObjects.find(p => p.id === rectObj?.type);
                existingLabel = type?.name || 'Rectangle';
              }
              const newFeat = { type: 'Feature', geometry: { type: 'Point', coordinates: centroid }, properties: { label: existingLabel, rectId: moving.rectId } };
              nextFeatures.push(newFeat);
              lbl.setData({ type: 'FeatureCollection', features: nextFeatures });
            }
          }
        } catch (_) {}
        moveRafRef.current = requestAnimationFrame(tick);
      } catch (_) { moveRafRef.current = null; }
    };
    const ensureTick = () => { if (!moveRafRef.current) moveRafRef.current = requestAnimationFrame(tick); };

    const handleMouseMove = (e) => {
      const rect = rectsRef.current.find(r => r.id === moving.rectId);
      if (!rect) return;
      const newGeom = buildMovedGeometry(rect, moving.startLngLat, e.lngLat);
      if (!newGeom) return;
      // Skip tiny pixel delta updates to reduce churn
      try {
        const cur = dataRef.current.fc?.features?.find(f => f.properties?.id === moving.rectId)?.geometry;
        const curP = Array.isArray(cur?.coordinates?.[0]) ? cur.coordinates[0][0] : null;
        const newP = Array.isArray(newGeom.coordinates?.[0]) ? newGeom.coordinates[0][0] : null;
        if (curP && newP) {
          const a = map.project(curP);
          const b = map.project(newP);
          const dx = Math.abs(a.x - b.x);
          const dy = Math.abs(a.y - b.y);
          if (dx < 1 && dy < 1) return;
        }
      } catch (_) {}
      pendingMoveRef.current = newGeom;
      ensureTick();
    };

    const handleMouseUp = () => {
      // Apply final update through React for state sync (silent mode - no trigger increment)
      const rect = rectsRef.current.find(r => r.id === moving.rectId);
      if (rect && onMoveRect) {
        let finalGeom = pendingMoveRef.current || null;
        try {
          if (!finalGeom) {
            const mv = map.getSource(MOVE_SOURCE_ID);
            const fcMv = mv?._data;
            const featMv = fcMv?.features?.find(f => (f.id === moving.rectId) || (f.properties && f.properties.id === moving.rectId));
            if (featMv && featMv.geometry) finalGeom = featMv.geometry;
          }
        } catch (_) {}
        if (finalGeom) {
          onMoveRect(moving.rectId, finalGeom);
        }
      }
      try { map.setFeatureState({ source: SOURCE_ID, id: moving.rectId }, { hidden: false }); } catch (_) {}
      try { const s = map.getSource(MOVE_SOURCE_ID); if (s && s.setData) s.setData({ type: 'FeatureCollection', features: [] }); } catch (_) {}
      setMoving(null);
      map.getCanvas().style.cursor = '';
      try { if (moveRafRef.current) cancelAnimationFrame(moveRafRef.current); } catch (_) {}
      moveRafRef.current = null;
      pendingMoveRef.current = null;
      // Handles and labels will update via normal effect cycle when moving state changes
      try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('rect:ui:centroid-end', { detail: { id: moving.rectId } })); } catch (_) {}
    };

    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);
    // Touch parity for move
    map.on('touchmove', handleMouseMove);
    map.on('touchend', handleMouseUp);

    return () => {
      try { if (moveRafRef.current) cancelAnimationFrame(moveRafRef.current); } catch (_) {}
      moveRafRef.current = null;
      pendingMoveRef.current = null;
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
      map.off('touchmove', handleMouseMove);
      map.off('touchend', handleMouseUp);
    };
  }, [map, moving, onMoveRect, buildMovedGeometry]);

  // During drag/move, simplify rendering for performance
  useEffect(() => {
    if (!map) return;
    const active = !!dragging || !!moving;
    try { if (map.getLayer(PATTERN_LAYER_ID)) map.setLayoutProperty(PATTERN_LAYER_ID, 'visibility', active ? 'none' : 'visible'); } catch (_) {}
    try { if (map.getLayer(FILL_LAYER_ID)) map.setPaintProperty(FILL_LAYER_ID, 'fill-antialias', active ? false : true); } catch (_) {}
    return () => {
      try { if (map.getLayer(PATTERN_LAYER_ID)) map.setLayoutProperty(PATTERN_LAYER_ID, 'visibility', 'visible'); } catch (_) {}
      try { if (map.getLayer(FILL_LAYER_ID)) map.setPaintProperty(FILL_LAYER_ID, 'fill-antialias', true); } catch (_) {}
    };
  }, [map, dragging, moving]);

  // Move drag initiation migrated to useMapEvents via handleFillMouseDownMove

  return null; // Pure MapLibre layer component, no DOM
};

export default DroppedRectanglesMapLibre;
