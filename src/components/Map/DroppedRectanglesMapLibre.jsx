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
  const layersInitializedRef = useRef(false);
  const mapIdRef = useRef(0);
  
  useEffect(() => {
    if (map) {
      mapIdRef.current++;
      if (shouldDebug()) console.info('[Rects] Map instance changed/set, new internal ID:', mapIdRef.current);
      setLayersInitialized(false); // Reset on map change
      layersInitializedRef.current = false;
    }
  }, [map]);


  const [dragging, setDragging] = useState(null); // { rectId, handleIndex, startLngLat }
  const [moving, setMoving] = useState(null); // { rectId, startLngLat, offset }
  const dataRef = useRef({ fc: null }); // Cache for direct data manipulation during drag
  const rectsRef = useRef([]); // Stable reference for drag handlers
  const resizeRafRef = useRef(null);
  const pendingResizeRef = useRef(null);
  const moveRafRef = useRef(null);
  const pendingMoveRef = useRef(null);
  const initializingRef = useRef(false);
  
  // Filter rectangles from objects
  const rects = useMemo(() => {
    const filtered = objects.filter(obj => {
      const type = placeableObjects.find(p => p.id === obj.type);
      const isRect = type && type.geometryType === 'rect';
      const hasValidGeometry = obj?.geometry?.coordinates?.[0]?.length >= 4;
      return isRect && hasValidGeometry;
    });
    return filtered;
  }, [objects, placeableObjects, objectUpdateTrigger]);

  // Keep rectsRef up-to-date for drag handlers
  useEffect(() => {
    rectsRef.current = rects;
  }, [rects]);

  // Load textures
  useEffect(() => {
    if (!map) return;
    
    const textureMap = {};
    for (const obj of placeableObjects) {
      if (obj.geometryType === 'rect' && obj.texture?.url) {
        textureMap[obj.id] = obj.texture.url;
      }
    }
    
    const handleStyleImageMissing = (e) => {
      const id = e.id;
      if (!textureMap[id]) return;
      const path = textureMap[id];
      try { if (String(path).toLowerCase().endsWith('.svg')) return; } catch (_) {}
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          if (!map.hasImage(id)) {
            map.addImage(id, img, { pixelRatio: 2 });
          }
        } catch (_) {}
      };
      img.src = path;
    };
    
    map.on('styleimagemissing', handleStyleImageMissing);
    return () => { map.off('styleimagemissing', handleStyleImageMissing); };
  }, [map, placeableObjects]);

  // Initialize layers helper
  const initLayers = useCallback(() => {
    if (!map || initializingRef.current) return;
    if (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) return;
    
    initializingRef.current = true;
    try {
      if (shouldDebug()) console.info('[DroppedRectangles] Starting initLayers');
      
      // Add sources
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'id' });
      }
      if (!map.getSource(HANDLES_SOURCE_ID)) {
        map.addSource(HANDLES_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      }
      if (!map.getSource(LABELS_SOURCE_ID)) {
        map.addSource(LABELS_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      }
      if (!map.getSource(MOVE_SOURCE_ID)) {
        map.addSource(MOVE_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'id' });
      }

      // Resolve insertion point
      const style = map.getStyle();
      const layers = style?.layers || [];
      const prefer = layers.find(l => l && l.id === 'dropped-objects-symbol');
      const beforeId = prefer ? prefer.id : undefined;

      // Add layers
      if (!map.getLayer(FILL_LAYER_ID)) {
        map.addLayer({
          id: FILL_LAYER_ID, type: 'fill', source: SOURCE_ID,
          paint: {
            'fill-color': ['get', 'fillColor'],
            'fill-outline-color': ['coalesce', ['get', 'strokeColor'], '#111827'],
            'fill-opacity': ['case', ['boolean', ['feature-state', 'hidden'], false], 0, ['has', 'fillPattern'], 0, 0.45]
          }
        }, beforeId);
      }
      if (!map.getLayer(PATTERN_LAYER_ID)) {
        map.addLayer({
          id: PATTERN_LAYER_ID, type: 'fill', source: SOURCE_ID,
          paint: {
            'fill-pattern': ['get', 'fillPattern'],
            'fill-opacity': ['case', ['boolean', ['feature-state', 'hidden'], false], 0, 1]
          },
          filter: ['has', 'fillPattern']
        }, beforeId);
      }
      if (!map.getLayer(LINE_LAYER_ID)) {
        map.addLayer({
          id: LINE_LAYER_ID, type: 'line', source: SOURCE_ID,
          paint: {
            'line-color': ['case', ['boolean', ['get', 'selected'], false], '#2563eb', ['coalesce', ['get', 'strokeColor'], '#111827']],
            'line-width': ['case', ['boolean', ['get', 'selected'], false], 4, 2],
            'line-opacity': ['case', ['boolean', ['feature-state', 'hidden'], false], 0, 1]
          }
        }, beforeId);
      }
      if (!map.getLayer(MOVE_FILL_LAYER_ID)) {
        map.addLayer({
          id: MOVE_FILL_LAYER_ID, type: 'fill', source: MOVE_SOURCE_ID,
          paint: { 'fill-color': ['coalesce', ['get', 'fillColor'], '#888888'], 'fill-outline-color': ['coalesce', ['get', 'strokeColor'], '#2563eb'], 'fill-opacity': 0.5 }
        }, beforeId);
      }
      if (!map.getLayer(MOVE_LINE_LAYER_ID)) {
        map.addLayer({
          id: MOVE_LINE_LAYER_ID, type: 'line', source: MOVE_SOURCE_ID,
          paint: { 'line-color': '#2563eb', 'line-width': 3, 'line-dasharray': [2, 2], 'line-opacity': 1 }
        }, beforeId);
      }
      if (!map.getLayer(HANDLES_LAYER_ID)) {
        map.addLayer({
          id: HANDLES_LAYER_ID, type: 'circle', source: HANDLES_SOURCE_ID,
          paint: { 'circle-radius': 6, 'circle-color': '#2563eb', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' },
          filter: ['==', ['get', 'visible'], true]
        }, beforeId);
      }
      if (!map.getLayer(LABELS_LAYER_ID)) {
        map.addLayer({
          id: LABELS_LAYER_ID, type: 'symbol', source: LABELS_SOURCE_ID,
          layout: {
            'text-field': ['coalesce', ['get', 'label'], ''], 'text-font': ['Open Sans Regular'], 'text-size': ['interpolate', ['exponential', 2], ['zoom'], 10, 0.5, 20, 14],
            'text-anchor': 'top', 'text-offset': [0, 1.2], 'text-allow-overlap': false, 'text-ignore-placement': false, 'text-max-width': 8
          },
          paint: { 'text-color': '#4b5563', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5, 'text-opacity': ['interpolate', ['linear'], ['zoom'], 16, 0, 17, 0.9] }
        });
      }
      if (!map.getLayer(LABELS_TITLE_LAYER_ID)) {
        map.addLayer({
          id: LABELS_TITLE_LAYER_ID, type: 'symbol', source: LABELS_SOURCE_ID,
          layout: {
            'text-field': ['coalesce', ['get', 'title'], 'AREA'], 'text-font': ['Open Sans Bold'], 'text-size': ['interpolate', ['exponential', 2], ['zoom'], 10, 1, 20, 24],
            'text-anchor': 'center', 'text-allow-overlap': false, 'text-ignore-placement': false, 'text-transform': 'uppercase', 'text-letter-spacing': 0.1, 'text-max-width': 10
          },
          paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 2, 'text-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, 0.8] }
        });
      }
      
              setLayersInitialized(true);
              layersInitializedRef.current = true;
              if (shouldDebug()) console.info('[DroppedRectangles] Layers initialized successfully');

      // Final Z-order check
      try { ensureLayersBetweenPermitAreasAndDroppedObjects(map, [FILL_LAYER_ID, PATTERN_LAYER_ID, LINE_LAYER_ID, HANDLES_LAYER_ID, LABELS_LAYER_ID, LABELS_TITLE_LAYER_ID]); } catch (_) {}
      
    } catch (err) {
      console.error('[DroppedRectanglesMapLibre] initLayers failed:', err);
    } finally {
      initializingRef.current = false;
    }
  }, [map]);

  // Main init effect
  useEffect(() => {
    if (!map) return;
    
    const onStyleLoad = () => { 
      if (shouldDebug()) console.info('[Rects] Style load detected, re-initializing');
      setLayersInitialized(false);
      layersInitializedRef.current = false;
      initLayers(); 
    };
    
    map.on('style.load', onStyleLoad);
    
    // Check if map style is ready - use both isStyleLoaded and check for layers
    const isMapReady = () => {
      try {
        // Check if style is loaded
        if (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) {
          return false;
        }
        // Also check if we can get the style (another indicator of readiness)
        const style = map.getStyle();
        return style && Array.isArray(style.layers);
      } catch (_) {
        return false;
      }
    };
    
    // Check if layers are missing even if style is loaded
    const checkLayers = () => {
      if (!isMapReady()) {
        if (shouldDebug()) console.info('[Rects] Map not ready yet, waiting...');
        return false;
      }
      if (layersInitializedRef.current || initializingRef.current) {
        if (shouldDebug()) console.info('[Rects] Already initialized or initializing, skipping');
        return true;
      }
      
      const anyMissing = !map.getLayer(FILL_LAYER_ID) || !map.getSource(SOURCE_ID);
      if (anyMissing) {
        if (shouldDebug()) console.info('[Rects] Layers missing -> initializing');
        initLayers();
      } else {
        // Layers exist, mark as initialized
        if (shouldDebug()) console.info('[Rects] Layers already exist, marking initialized');
        setLayersInitialized(true);
        layersInitializedRef.current = true;
      }
      return true;
    };

    // Try immediately if map is ready
    if (isMapReady()) {
      checkLayers();
    }
    
    // Also listen for load event (fires when map is fully ready)
    const onLoad = () => {
      if (shouldDebug()) console.info('[Rects] Map load event fired, checking layers');
      checkLayers();
    };
    map.on('load', onLoad);
    
    // Set backup timeouts with increasing delays - the map may already be loaded
    // but isStyleLoaded might return false briefly during re-renders
    const t1 = setTimeout(checkLayers, 100);
    const t2 = setTimeout(checkLayers, 500);
    const t3 = setTimeout(checkLayers, 1000);
    const t4 = setTimeout(checkLayers, 2000);
    
    return () => { 
      map.off('style.load', onStyleLoad);
      map.off('load', onLoad);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [map, initLayers]);

  // Data update effect
  useEffect(() => {
    if (!map || (!layersInitialized && !layersInitializedRef.current)) return;
    const source = map.getSource(SOURCE_ID);
    if (!source) return;

    const features = rects.map(obj => {
      const type = placeableObjects.find(p => p.id === obj.type);
      const selected = obj.id === selectedId;
      const hasTexture = type?.texture?.url && !String(type.texture.url).toLowerCase().endsWith('.svg');
      const properties = {
        id: obj.id, objectType: obj.type, selected, fillColor: type?.color || '#888888', strokeColor: '#111827'
      };
      if (hasTexture) properties.fillPattern = obj.type;
      return { type: 'Feature', id: obj.id, geometry: obj.geometry, properties };
    });

    const fc = { type: 'FeatureCollection', features };
    try { source.setData(fc); } catch (_) {}
    dataRef.current.fc = fc;
  }, [map, rects, selectedId, placeableObjects, layersInitialized]);

  // Handles & Labels update effect
  useEffect(() => {
    if (!map || (!layersInitialized && !layersInitializedRef.current) || dragging || moving) return;
    
    // Handles
    const hSrc = map.getSource(HANDLES_SOURCE_ID);
    if (hSrc) {
      const rect = selectedId ? rects.find(r => r.id === selectedId) : null;
      const corners = rect?.geometry?.coordinates?.[0]?.slice(0, 4) || [];
      const handleFeatures = corners.map((coord, idx) => ({
        type: 'Feature', geometry: { type: 'Point', coordinates: coord },
        properties: { rectId: rect.id, handleIndex: idx, visible: true }
      }));
      try { hSrc.setData({ type: 'FeatureCollection', features: handleFeatures }); } catch (_) {}
    }

    // Labels
    const lSrc = map.getSource(LABELS_SOURCE_ID);
    if (lSrc) {
      const labelFeatures = rects.map(rectObj => {
        const type = placeableObjects.find(p => p.id === rectObj.type);
        const dims = rectObj?.properties?.dimensions || rectObj?.properties?.user_dimensions_m || {};
        const title = (type?.name || 'Area').toUpperCase();
        let label = '';
        try {
          const wM = dims?.width || 0, hM = dims?.height || 0;
          if (type?.units === 'ft') label = `${Math.round(wM * 3.28084)} ft × ${Math.round(hM * 3.28084)} ft`;
          else if (wM > 0 && hM > 0) label = `${wM.toFixed(1)} m × ${hM.toFixed(1)} m`;
        } catch (_) {}
        const ring = rectObj.geometry?.coordinates?.[0];
        if (!ring || ring.length < 4) return null;
        let centroid;
        try { centroid = turf.centroid(turf.polygon([ring])).geometry.coordinates; } catch (_) {
          centroid = [(ring[0][0] + ring[2][0]) / 2, (ring[0][1] + ring[2][1]) / 2];
        }
        return { type: 'Feature', geometry: { type: 'Point', coordinates: centroid }, properties: { label, title, rectId: rectObj.id } };
      }).filter(Boolean);
      try { lSrc.setData({ type: 'FeatureCollection', features: labelFeatures }); } catch (_) {}
    }
  }, [map, rects, selectedId, placeableObjects, dragging, moving, layersInitialized]);

  // Click handlers
  const handleFillClick = useCallback((e) => {
    if (!map || isPlacementActive) return;
    try {
      const rectId = e.features?.[0]?.properties?.id;
      if (rectId && onSelectRect) {
        e.preventDefault();
        onSelectRect(rectId);
      }
    } catch (_) {}
  }, [map, isPlacementActive, onSelectRect]);

  const handleHandleMouseDown = useCallback((e) => {
    if (!map || isPlacementActive || !e.features?.[0]) return;
    const { rectId, handleIndex } = e.features[0].properties;
    setDragging({ rectId, handleIndex, startLngLat: e.lngLat });
    try { map.setFeatureState({ source: SOURCE_ID, id: rectId }, { hidden: true }); } catch (_) {}
    map.dragPan.disable(); map.dragRotate.disable();
    map.getCanvas().style.cursor = 'grabbing';
  }, [map, isPlacementActive]);

  const handleFillMouseDownMove = useCallback((e) => {
    if (!map || isPlacementActive || !e.features?.[0]) return;
    const rectId = e.features[0].properties.id;
    if (rectId === selectedId) {
      setMoving({ rectId, startLngLat: e.lngLat });
      try { map.setFeatureState({ source: SOURCE_ID, id: rectId }, { hidden: true }); } catch (_) {}
      // Disable map panning so the rectangle moves instead of the map
      map.dragPan.disable();
      map.dragRotate.disable();
      map.getCanvas().style.cursor = 'move';
    }
  }, [map, isPlacementActive, selectedId]);

  // Event binding
  useEffect(() => {
    if (!map || (!layersInitialized && !layersInitializedRef.current)) return;
    const bind = (ev, lyr, hdl) => { try { map.on(ev, lyr, hdl); } catch (_) {} };
    const unbind = (ev, lyr, hdl) => { try { map.off(ev, lyr, hdl); } catch (_) {} };
    
    bind('click', FILL_LAYER_ID, handleFillClick);
    bind('click', PATTERN_LAYER_ID, handleFillClick);
    bind('mousedown', HANDLES_LAYER_ID, handleHandleMouseDown);
    bind('mousedown', FILL_LAYER_ID, handleFillMouseDownMove);
    bind('mousedown', PATTERN_LAYER_ID, handleFillMouseDownMove);
    
    const onEnter = (c) => () => { if (!isPlacementActive) map.getCanvas().style.cursor = c; };
    const onLeave = () => { if (!dragging && !moving) map.getCanvas().style.cursor = ''; };
    
    bind('mouseenter', FILL_LAYER_ID, onEnter('pointer'));
    bind('mouseleave', FILL_LAYER_ID, onLeave);
    bind('mouseenter', HANDLES_LAYER_ID, onEnter('grab'));
    bind('mouseleave', HANDLES_LAYER_ID, onLeave);

    return () => {
      unbind('click', FILL_LAYER_ID, handleFillClick); unbind('click', PATTERN_LAYER_ID, handleFillClick);
      unbind('mousedown', HANDLES_LAYER_ID, handleHandleMouseDown); unbind('mousedown', FILL_LAYER_ID, handleFillMouseDownMove);
      unbind('mousedown', PATTERN_LAYER_ID, handleFillMouseDownMove);
    };
  }, [map, handleFillClick, handleHandleMouseDown, handleFillMouseDownMove, isPlacementActive, dragging, moving, layersInitialized]);

  // Drag logic (Simplified helpers)
  const buildResizedGeometry = useCallback((rect, handleIndex, mouseLngLat) => {
    if (!rect?.geometry?.coordinates?.[0]) return null;
    try {
      const coords = rect.geometry.coordinates[0];
      const pts = coords.slice(0, 4).map(c => map.project(c));
      const c = { x: (pts[0].x + pts[2].x) / 2, y: (pts[0].y + pts[2].y) / 2 };
      const e01 = { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y };
      const e30 = { x: pts[0].x - pts[3].x, y: pts[0].y - pts[3].y };
      const len = (v) => Math.hypot(v.x, v.y) || 1;
      const u = { x: e01.x / len(e01), y: e01.y / len(e01) };
      const v = { x: e30.x / len(e30), y: e30.y / len(e30) };
      const mouse = map.project(mouseLngLat);
      const md = { x: mouse.x - c.x, y: mouse.y - c.y };
      const nHalfW = Math.max(6, Math.abs(md.x * u.x + md.y * u.y));
      const nHalfH = Math.max(6, Math.abs(md.x * v.x + md.y * v.y));
      const corner = (su, sv) => {
        const p = { x: c.x + su * nHalfW * u.x + sv * nHalfH * v.x, y: c.y + su * nHalfW * u.y + sv * nHalfH * v.y };
        const ll = map.unproject([p.x, p.y]); return [ll.lng, ll.lat];
      };
      const ring = [corner(-1,-1), corner(1,-1), corner(1,1), corner(-1,1)];
      return { type: 'Polygon', coordinates: [[...ring, ring[0]]] };
    } catch (_) { return null; }
  }, [map]);

  const buildMovedGeometry = useCallback((rect, startLngLat, endLngLat) => {
    if (!rect?.geometry?.coordinates?.[0]) return null;
    try {
      const startPt = map.project(startLngLat), endPt = map.project(endLngLat);
      const dx = endPt.x - startPt.x, dy = endPt.y - startPt.y;
      const newRing = rect.geometry.coordinates[0].map(([lng, lat]) => {
        const pt = map.project([lng, lat]);
        const ll = map.unproject([pt.x + dx, pt.y + dy]);
        return [ll.lng, ll.lat];
      });
      return { type: 'Polygon', coordinates: [newRing] };
    } catch (_) { return null; }
  }, [map]);

  // Unified Drag Effect
  useEffect(() => {
    if (!map || (!dragging && !moving)) return;
    const active = dragging || moving;
    const isResize = !!dragging;

    const handleMove = (e) => {
      const rect = rectsRef.current.find(r => r.id === active.rectId);
      if (!rect) return;
      const newGeom = isResize ? buildResizedGeometry(rect, dragging.handleIndex, e.lngLat) : buildMovedGeometry(rect, moving.startLngLat, e.lngLat);
      if (!newGeom) return;
      pendingResizeRef.current = newGeom; // shared ref for simplicity
      // Get the object type to use proper fill color
      const type = placeableObjects.find(p => p.id === rect.type);
      const fillColor = type?.color || '#888888';
      const mv = map.getSource(MOVE_SOURCE_ID);
      if (mv) mv.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', id: active.rectId, geometry: newGeom, properties: { id: active.rectId, fillColor, strokeColor: '#2563eb' } }] });
    };

    const handleUp = () => {
      const rect = rectsRef.current.find(r => r.id === active.rectId);
      if (rect && pendingResizeRef.current) {
        if (isResize) onResizeRect?.(active.rectId, pendingResizeRef.current);
        else onMoveRect?.(active.rectId, pendingResizeRef.current);
      }
      try { map.setFeatureState({ source: SOURCE_ID, id: active.rectId }, { hidden: false }); } catch (_) {}
      try { map.getSource(MOVE_SOURCE_ID).setData({ type: 'FeatureCollection', features: [] }); } catch (_) {}
      setDragging(null); setMoving(null);
      map.dragPan.enable(); map.dragRotate.enable();
      map.getCanvas().style.cursor = '';
      pendingResizeRef.current = null;
    };

    map.on('mousemove', handleMove); map.on('mouseup', handleUp);
    return () => { map.off('mousemove', handleMove); map.off('mouseup', handleUp); };
  }, [map, dragging, moving, buildResizedGeometry, buildMovedGeometry, onResizeRect, onMoveRect, placeableObjects]);

  return null;
};

export default DroppedRectanglesMapLibre;
