// hooks/useInfrastructure.js
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  loadInfrastructureData, 
  filterFeaturesByType,
  getLayerStyle 
} from '../services/infrastructureService';
import { calculateGeometryBounds, expandBounds } from '../utils/geometryUtils';
import { createInfrastructureTooltipContent, buildInfrastructureHoverContent, buildInfrastructureClickContent } from '../utils/tooltipUtils';
import maplibregl from 'maplibre-gl';
import { addIconsToMap, retryLoadIcons, INFRASTRUCTURE_ICONS } from '../utils/iconUtils';
import { INFRASTRUCTURE_ENDPOINTS } from '../constants/endpoints';
import { addEnhancedSpritesToMap, computeNearestLineBearing, quantizeAngleTo45, quantizeAngleTo90, buildSpriteImageId, getMapViewType, buildSpriteUrl, buildFlatSpriteUrl, computeNearestSegmentClosestPointBearing, computeFeatureSpriteAngle, computeSpriteTransform, extractCameraState, computeCameraBucket, VIEW_TYPES } from '../utils/enhancedRenderingUtils.js';
import { snapBearingRelativeToArea, quantizeBearingForView, normalizeAngle } from '../utils/bearingUtils';
// ensureViewportAlignedSymbols not used - infrastructure icons use 'map' alignment (fixed in world space)
import { parseTrainLines } from '../utils/mtaUtils';
import { addTrainLineIconToMap, preloadCommonTrainLineIcons } from '../utils/mtaIconGenerator';
import { useMapViewState } from './useMapViewState';
import { DISABLED_INFRASTRUCTURE_LAYERS, NON_RECOMMENDED_INFRASTRUCTURE_LAYERS } from '../constants/layers';
const DEBUG_INFRA = false;
import { prefetchView } from '../utils/spriteResolver';

// NOTE: Enhanced infra sprites: use flat /static/{base}/{base|base_TOP} paths for both views
// because our public assets are deployed in flat layout. The spriteResolver handles nested fallbacks.
export const useInfrastructure = (map, focusedArea, layers, setLayers, options = {}) => {
  // Lightweight fetch utilities for robustness in bulk mode
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const raceWithTimeout = (promise, timeoutMs = 15000, label = 'request') => {
    return new Promise((resolve, reject) => {
      let settled = false;
      const t = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`[timeout] ${label} exceeded ${timeoutMs}ms`));
      }, Math.max(1000, timeoutMs));
      promise.then((v) => {
        if (settled) return;
        settled = true;
        clearTimeout(t);
        resolve(v);
      }).catch((e) => {
        if (settled) return;
        settled = true;
        clearTimeout(t);
        reject(e);
      });
    });
  };
  const shouldRetry = (err) => {
    try {
      const msg = (err && err.message ? String(err.message) : '').toLowerCase();
      return msg.includes('429') || msg.includes('rate') || msg.includes('timeout') || msg.includes('network') || msg.includes('503') || msg.includes('504') || msg.includes('failed to fetch');
    } catch (_) { return false; }
  };
  const loadWithRetry = async (layerId, bounds, attempts = 3) => {
    let lastErr = null;
    for (let i = 1; i <= attempts; i++) {
      try {
        return await raceWithTimeout(loadInfrastructureData(layerId, bounds), 15000, `loadInfrastructureData(${layerId})`);
      } catch (e) {
        lastErr = e;
        if (i >= attempts || !shouldRetry(e)) break;
        const backoffMs = Math.min(1500, 400 * Math.pow(2, i - 1));
        try { await delay(backoffMs); } catch (_) {}
      }
    }
    throw lastErr || new Error('Unknown load error');
  };
  const view = useMapViewState(map);
  if (DEBUG_INFRA) console.log('[DEBUG] useInfrastructure hook called with map:', !!map);
  // Removed DEFAULT_ZERO_OFFSET_BY_VIEW; final sprite angle derived from
  // base bearing + camera snapping without static zero-offset calibration.
  
  const [infrastructureData, setInfrastructureData] = useState({
    trees: null,
    hydrants: null,
    busStops: null,
    benches: null,
    trashBaskets: null,
    bikeLanes: null,
    bikeParking: null,
    citibikeStations: null,
    subwayEntrances: null,
    subwayLines: null,
    fireLanes: null,
    specialDisasterRoutes: null,
    pedestrianRamps: null,
    parkingMeters: null,
    linknycKiosks: null,
    publicRestrooms: null,
    drinkingFountains: null,
    sprayShowers: null,
    parksTrails: null,
    parkingLots: null,
    iceLadders: null,
    parksSigns: null,
    sidewalks: null
  });

  // Bulk load queue (for "All Recommended") with limited concurrency
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ total: 0, completed: 0 });
  const loadQueueRef = useRef([]);
  const queuedSetRef = useRef(new Set());
  const activeLoadsRef = useRef(0);
  const maxConcurrentRef = useRef(1);
  const reloadDebounceRef = useRef(null);
  // Request version tokens to invalidate stale/in-flight completions
  const requestVersionRef = useRef(new Map());

  // Use refs to track state and prevent loops
  const prevFocusedAreaIdRef = useRef(null);
  const loadingLayersRef = useRef(new Set());
  const lastCameraBucketRef = useRef({});
  const lastViewTypeRef = useRef({}); // Track viewType per layer to detect view type changes
  // Live layers ref to avoid stale-closure reads inside async callbacks
  const layersRef = useRef(layers);
  useEffect(() => { layersRef.current = layers; }, [layers]);
  // Track previous layer visibility states to avoid unnecessary updates
  const prevLayerVisibilityRef = useRef(new Map());
  
  // Popup refs for infrastructure hover/click tooltips
  const infraHoverPopupRef = useRef(null);
  const infraClickPopupRef = useRef(null);

  // (queue functions declared after loader)

  // Get the focused area ID for comparison
  const focusedAreaId = focusedArea?.id || focusedArea?.properties?.id;

  // Remove infrastructure layer - define early so effects can depend on it safely
  const removeInfrastructureLayer = useCallback((layerId) => {
    if (!map) return;
    // Check if map has a style loaded before trying to access layers
    try {
      if (!map.getStyle()) {
        if (DEBUG_INFRA) console.log(`Infrastructure: Map style not loaded, skipping remove for ${layerId}`);
        return;
      }
    } catch (error) {
      if (DEBUG_INFRA) console.log(`Infrastructure: Error checking map style, skipping remove for ${layerId}:`, error);
      return;
    }
    // Remove all possible layer IDs and sources
    const pointLayerId = `layer-${layerId}-point`;
    const lineLayerId = `layer-${layerId}-line`;
    const polygonLayerId = `layer-${layerId}-polygon`;
    const altLayerId = `${layerId}-layer`;
    const sourceId = layerId;
    const altSourceId = `source-${layerId}`;
    try {
      // Detach saved event handlers for this layer id(s) if present
      try {
        const H = map.__infraHandlers;
        const offFor = (id) => {
          if (!H || !H.has(id)) return;
          const hs = H.get(id);
          try { if (hs?.enter) map.off('mouseenter', id, hs.enter); } catch (_) {}
          try { if (hs?.leave) map.off('mouseleave', id, hs.leave); } catch (_) {}
          try { if (hs?.move) map.off('mousemove', id, hs.move); } catch (_) {}
          try { if (hs?.click) map.off('click', id, hs.click); } catch (_) {}
          try { H.delete(id); } catch (_) {}
        };
        offFor(pointLayerId);
        offFor(lineLayerId);
        offFor(polygonLayerId);
        offFor(altLayerId);
      } catch (_) {}

      if (map.getLayer(pointLayerId)) {
        map.removeLayer(pointLayerId);
      }
      if (map.getLayer(lineLayerId)) {
        map.removeLayer(lineLayerId);
      }
      if (map.getLayer(polygonLayerId)) {
        map.removeLayer(polygonLayerId);
      }
      if (map.getLayer(altLayerId)) {
        map.removeLayer(altLayerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
      if (map.getSource(altSourceId)) {
        map.removeSource(altSourceId);
      }
    } catch (error) {
      console.error(`Error removing ${layerId} layer/source:`, error);
    }
  }, [map]);

  // Debug: Track map changes
  useEffect(() => {
    if (DEBUG_INFRA) console.log('[DEBUG] Map changed:', !!map, 'map.isStyleLoaded():', map?.isStyleLoaded());
  }, [map]);

  // Clear infrastructure when focus changes
  useEffect(() => {
    const prevFocusedAreaId = prevFocusedAreaIdRef.current;
    prevFocusedAreaIdRef.current = focusedAreaId;
    
    // Only run if focus actually changed
    if (prevFocusedAreaId === focusedAreaId) {
      return;
    }

    if (!focusedAreaId) {
      // Clear everything when focus is removed
      if (map) {
        try {
          Object.keys(layersRef.current || {}).forEach((layerId) => {
            if (layerId !== 'permitAreas') removeInfrastructureLayer(layerId);
          });
        } catch (_) {}
      }
      
      // Reset infrastructure data map - only if not already empty
      setInfrastructureData(prev => {
        if (!prev || Object.keys(prev).length === 0) return prev;
        return {};
      });
      
      // Reset all layer states dynamically (also clear requested intent)
      setLayers(prev => {
        let changed = false;
        const next = { ...prev };
        Object.keys(prev || {}).forEach((layerId) => {
          if (layerId === 'permitAreas') return;
          const cfg = prev[layerId];
          if (cfg.visible || cfg.loading || cfg.loaded || cfg.requested || cfg.error) {
            next[layerId] = { ...cfg, visible: false, loading: false, loaded: false, error: null, requested: false };
            changed = true;
          }
        });
        return changed ? next : prev;
      });
      
      loadingLayersRef.current.clear();
    }
  }, [focusedAreaId, map, removeInfrastructureLayer, setLayers]); // Removed layers from dependency array

  // Clear existing layers when focused area changes (guarded during import rehydration)
  useEffect(() => {
    if (!map) return;

    // When focused area changes, clear all infrastructure layers and reset their state
    // Skip during plan rehydration to preserve imported visibility toggles
    if (options?.rehydratingImport) return;
    Object.keys(layers).forEach(layerId => {
      if (layerId !== 'permitAreas') {
        // Thoroughly clear the layer from the map (points, lines, polygons, sources)
        removeInfrastructureLayer(layerId);
        
        // Reset the layer state to not loaded and not visible
        setLayers(prev => ({
          ...prev,
          [layerId]: { 
            ...prev[layerId], 
            visible: false,  // hide until reloaded for new area
            loaded: false, 
            loading: false,
            error: null,
            // preserve requested intent across focus changes so All Recommended remains active
            requested: prev[layerId]?.requested === true
          }
        }));
      }
    });

    // Clear infrastructure data cache so old area data doesn't flash under new area
    setInfrastructureData(prev => {
      if (!prev || Object.keys(prev).length === 0) return prev;
      return {};
    });

    // Clear loading states
    loadingLayersRef.current.clear();
    try { lastCameraBucketRef.current = {}; } catch (_) {}

    // After clearing previous area's layers/state, (re)load any requested layers for the new focus
    try { reloadVisibleLayers(); } catch (_) {}
  }, [focusedAreaId, map, options?.rehydratingImport]);

  // (moved below reloadVisibleLayers declaration)

  // Load infrastructure icons lazily when style is ready
  useEffect(() => {
    if (!map) return;
    const onStyleLoad = () => {
      try {
        setTimeout(() => { try { if (typeof map?.hasImage === 'function') addIconsToMap(map); } catch (_) {} }, 50);
      } catch (_) {}
    };
    // Fire once if style already loaded
    try {
      if (map.isStyleLoaded && map.isStyleLoaded()) {
        setTimeout(() => { try { if (typeof map?.hasImage === 'function') addIconsToMap(map); } catch (_) {} }, 50);
      }
    } catch (_) {}
    try { map.on('style.load', onStyleLoad); } catch (_) {}
    return () => { try { map.off('style.load', onStyleLoad); } catch (_) {} };
  }, [map]);

  // When view type changes (isometric <-> top-down), reload enhanced sprite images in the map sprite registry
  // so on-map instances update to the correct perspective without reloading data.
  // Only reload sprites when viewType changes, NOT when layers change (prevents flicker)
  useEffect(() => {
    if (!map) return;
    const viewType = view?.viewType || getMapViewType(map);
    try {
      Object.entries(layersRef.current || {}).forEach(([layerId, cfg]) => {
        if (!cfg?.requested || !cfg?.enhancedRendering?.enabled) return;
        const base = cfg.enhancedRendering.spriteBase;
        // In top-down (2D) mode, only load 0-degree sprite and use continuous rotation
        // In isometric mode, load all 8 angles to simulate 3D perspective
        const allAngles = cfg.enhancedRendering.angles || [0,45,90,135,180,225,270,315];
        const angles = viewType === 'top-down' ? [0] : allAngles;
        // Replace existing images for this sprite family with the current view variant
        // Use the publicDir from layer config if available, otherwise construct it
        const layerPublicDir = cfg.enhancedRendering.publicDir || `/static/${base}`;
        addEnhancedSpritesToMap(map, {
          baseName: base,
          publicDir: layerPublicDir,
          angles,
          viewType,
          urlBuilder: buildFlatSpriteUrl,
          replaceExisting: false
        });
        // Opportunistic prefetch via DOM for sidebar/other consumers
        try { prefetchView(base, angles, viewType, { map }); } catch (_) {}
      });
      try { if (typeof map.triggerRepaint === 'function') map.triggerRepaint(); } catch (_) {}
    } catch (_) {}
  }, [map, view?.viewType]); // Removed 'layers' dependency to prevent reloading on every layer toggle

  // On-demand image registration for infrastructure icons and enhanced sprites (styleimagemissing)
  useEffect(() => {
    if (!map) return;
    const onMissing = async (e) => {
      try {
        const id = e && e.id;
        if (!id || typeof id !== 'string') return;
        try { if (map.hasImage && map.hasImage(id)) return; } catch (_) {}

        // Enhanced sprite family: id like "fire-hydrant_180" or "tree_maple_TOP_000" (for top-down)
        // Parse by checking for TOP pattern first, then extracting base and angle
        if (id.includes('_')) {
          let base, angle, isTopDown;
          
          // Check if this is a top-down sprite (pattern: base_TOP_000)
          const topDownMatch = id.match(/^(.+)_TOP_(\d+)$/);
          if (topDownMatch) {
            base = topDownMatch[1];
            angle = parseInt(topDownMatch[2], 10);
            isTopDown = true;
          } else {
            // Regular sprite: base_000 (find last underscore before angle)
            const lastUnderscore = id.lastIndexOf('_');
            const beforeLastUnderscore = id.substring(0, lastUnderscore);
            const afterLastUnderscore = id.substring(lastUnderscore + 1);
            base = beforeLastUnderscore;
            try { 
              angle = parseInt(afterLastUnderscore, 10); 
              if (!isFinite(angle)) angle = 0; 
            } catch (_) { 
              angle = 0; 
            }
            isTopDown = false;
          }
          
          const vt = isTopDown ? VIEW_TYPES.TOP_DOWN : (view?.viewType || getMapViewType(map));
          
          // Find the layer config to get the correct publicDir
          const layerConfig = Object.values(layersRef.current || {}).find(l => 
            l?.enhancedRendering?.spriteBase === base
          );
          const layerPublicDir = layerConfig?.enhancedRendering?.publicDir || `/static/${base}`;
          
          try {
            await addEnhancedSpritesToMap(map, {
              baseName: base,
              publicDir: layerPublicDir,
              angles: [angle],
              viewType: vt,
              urlBuilder: buildFlatSpriteUrl,
              replaceExisting: false
            });
            return;
          } catch (_) {}
        }

        // Fallback to basic PNG/SVG infrastructure icons by ID
        try {
          const icon = Object.values(INFRASTRUCTURE_ICONS).find((v) => v && v.id === id);
          if (icon && icon.src) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve) => {
              img.onload = () => { try { map.addImage(id, img); } catch (_) {} resolve(true); };
              img.onerror = () => resolve(false);
              img.src = icon.src;
            });
          }
        } catch (_) {}
      } catch (_) {}
    };
    try { map.on('styleimagemissing', onMissing); } catch (_) {}
    return () => { try { map.off('styleimagemissing', onMissing); } catch (_) {} };
  }, [map, view?.viewType]);

  // Track infrastructure data for rotation updates without triggering re-renders
  const infraDataRef = useRef(infrastructureData);
  useEffect(() => {
    infraDataRef.current = infrastructureData;
  }, [infrastructureData]);

  // NOTE: Infrastructure icons use icon-rotation-alignment: 'map' so they are FIXED in world space,
  // like basemap features. When the camera rotates, icons rotate WITH the map - no JavaScript
  // rotation updates needed. This is the most performant approach.

  // Ref for debouncing sprite updates in isometric mode
  const spriteUpdateTimeoutRef = useRef(null);
  const pendingSpriteUpdateRef = useRef(null);

  // Recompute per-feature icon_image for enhanced infra when bearing/view changes
  // PERFORMANCE: Only runs in isometric mode (top-down uses native MapLibre viewport alignment)
  // Uses coarse camera buckets (45° slices) and debouncing to minimize updates during rotation
  useEffect(() => {
    if (!map) return;
    
    const state = extractCameraState({ map, view });
    const currentViewType = state?.viewType;
    
    // In top-down/2D mode, icons use map-aligned rotation (fixed in world space)
    // No JavaScript updates needed - MapLibre handles rotation natively on the GPU
    if (currentViewType === 'top-down') {
      // Only update if we just switched FROM isometric mode (need to reset sprites)
      const anyPrevIsometric = Object.values(lastViewTypeRef.current || {}).some(v => v === 'isometric');
      if (!anyPrevIsometric) return;
    }
    
    // Function to perform the actual sprite update
    const performSpriteUpdate = () => {
      try {
        Object.entries(layersRef.current || {}).forEach(([layerId, cfg]) => {
          if (!cfg?.requested || !cfg?.enhancedRendering?.enabled) return;
          
          // Use infraDataRef.current instead of infrastructureData to avoid loop
          const data = infraDataRef.current?.[layerId];
          if (!data || !Array.isArray(data.features) || data.features.length === 0) return;

          // Use coarser bucket precision (45° = 8 slices) for fewer updates
          const snappedBucket = computeCameraBucket({ cameraState: state, bucketPrecisionDeg: 45, slices: 8 });
          const prevBucket = lastCameraBucketRef.current[layerId];
          const prevViewType = lastViewTypeRef.current?.[layerId];
          
          // Force update if viewType changed (top-down <-> isometric), even if bucket is same
          const viewTypeChanged = prevViewType !== currentViewType;
          if (!viewTypeChanged && typeof prevBucket === 'number' && prevBucket === snappedBucket) {
            return;
          }
          lastCameraBucketRef.current[layerId] = snappedBucket;
          if (!lastViewTypeRef.current) lastViewTypeRef.current = {};
          lastViewTypeRef.current[layerId] = currentViewType;

          const areaGeom = (() => { try {
            return (focusedArea?.properties?.__subFocus ? focusedArea : null)?.geometry || (focusedArea?.geometry);
          } catch (_) { return null; } })();

          let changed = false;
          const newFeatures = data.features.map((f) => {
            if (!f || f.geometry?.type !== 'Point') return f;
            const p = f.properties || {};
            const spriteBase = cfg?.enhancedRendering?.spriteBase;
            const baseAngle = (typeof p.icon_base_bearing === 'number') ? p.icon_base_bearing : 0;
            const zeroOffset = (cfg?.enhancedRendering?.zeroOffsetDegByView?.[state.viewType])
              ?? (cfg?.enhancedRendering?.zeroOffsetDeg)
              ?? 0;
            const displayAngle = (typeof p.icon_display_bearing === 'number') ? p.icon_display_bearing : undefined;
            const transform = computeSpriteTransform({
              map,
              view,
              cameraState: state,
              spriteBase,
              baseAngleDeg: baseAngle,
              displayAngleDeg: displayAngle,
              zeroOffsetDeg: zeroOffset,
              areaGeom,
              facingMode: cfg?.enhancedRendering?.facingMode,
              side: p.icon_side || null
            });
            const nextImage = transform.imageId || (spriteBase ? `${spriteBase}_000` : p.icon_image);
            const nextRotate = transform.iconRotate || 0;
            const baseRotation = displayAngle !== undefined ? ((displayAngle % 360) + 360) % 360 : nextRotate;
            if (p.icon_image !== nextImage || (p.icon_rotate || 0) !== nextRotate || (p.icon_base_rotation !== baseRotation)) {
              changed = true;
              return { ...f, properties: { ...p, icon_image: nextImage, icon_rotate: nextRotate, icon_base_rotation: baseRotation } };
            }
            return f;
          });

          if (changed) {
            const updated = { ...data, features: newFeatures };
            try {
              const srcId = `source-${layerId}`;
              const src = map && typeof map.getSource === 'function' ? map.getSource(srcId) : null;
              if (src && typeof src.setData === 'function') src.setData(updated);
            } catch (_) {}
            
            // Update ref immediately
            infraDataRef.current = { ...infraDataRef.current, [layerId]: updated };
            
            setInfrastructureData((prev) => ({ ...prev, [layerId]: updated }));
          }
        });
      } catch (_) {}
    };
    
    // In isometric mode, debounce updates to avoid lag during continuous rotation
    // Use 100ms delay to batch rapid bearing changes
    if (currentViewType === 'isometric') {
      if (spriteUpdateTimeoutRef.current) {
        clearTimeout(spriteUpdateTimeoutRef.current);
      }
      pendingSpriteUpdateRef.current = performSpriteUpdate;
      spriteUpdateTimeoutRef.current = setTimeout(() => {
        if (pendingSpriteUpdateRef.current) {
          pendingSpriteUpdateRef.current();
          pendingSpriteUpdateRef.current = null;
        }
        spriteUpdateTimeoutRef.current = null;
      }, 100);
    } else {
      // View type change (e.g., switching from isometric to top-down) - update immediately
      performSpriteUpdate();
    }
    
    return () => {
      if (spriteUpdateTimeoutRef.current) {
        clearTimeout(spriteUpdateTimeoutRef.current);
        spriteUpdateTimeoutRef.current = null;
      }
    };
  }, [map, view?.bearing, view?.viewType, view?.pitch, focusedArea]);

  // Add infrastructure layer to map - move this before loadInfrastructureLayer
  const addInfrastructureLayerToMap = useCallback((layerId, data) => {
    if (!map) return;
    if (DEBUG_INFRA) console.log(`[DEBUG] Adding ${layerId} layer to map with ${data.features.length} features`);
    // Ensure style is ready before manipulating sources/layers
    try {
      if (map.isStyleLoaded && !map.isStyleLoaded()) {
        const run = () => {
          try { addInfrastructureLayerToMap(layerId, data); } catch (_) {}
        };
        try { map.once('style.load', run); } catch (_) { setTimeout(run, 0); }
        return;
      }
    } catch (_) {}
    
    removeInfrastructureLayer(layerId);
    const sourceId = `source-${layerId}`;
    // Lazily add only the icons needed for this specific layer
    try { if (typeof map?.hasImage === 'function') addIconsToMap(map, [layerId]); } catch (_) {}
    
    // Add source
    map.addSource(sourceId, {
      type: 'geojson',
      data: data
    });
    
    const layerStyle = getLayerStyle(layerId, (layersRef.current && layersRef.current[layerId]) || layers[layerId], map);
    if (DEBUG_INFRA) console.log(`[DEBUG] Layer style for ${layerId}:`, layerStyle);
    
    // Try to place infra layers below draw controls if present; otherwise they end up on top
    let beforeId;
    try {
      const style = map.getStyle ? map.getStyle() : null;
      const drawLayer = style && Array.isArray(style.layers)
        ? style.layers.find(l => typeof l.id === 'string' && (l.id.startsWith('mapbox-gl-draw') || l.id.startsWith('gl-draw')))
        : null;
      beforeId = drawLayer ? drawLayer.id : undefined;
    } catch (_) {}
    
    // Check for different geometry types
    const ensureGeometry = (f) => {
      if (!f || !f.geometry) return null;
      const g = f.geometry;
      // Guard invalid empty shells
      if (g.type === 'MultiPolygon' && (!Array.isArray(g.coordinates) || g.coordinates.length === 0)) return null;
      if (g.type === 'Polygon' && (!Array.isArray(g.coordinates) || g.coordinates.length === 0)) return null;
      return g;
    };
    const validFeatures = (data.features || []).filter(f => !!ensureGeometry(f));
    const hasLineString = validFeatures.some(f => f.geometry && (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString'));
    const hasPoint = validFeatures.some(f => f.geometry && f.geometry.type === 'Point');
    const hasPolygon = validFeatures.some(f => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'));
    
    if (DEBUG_INFRA) console.log(`[DEBUG] ${layerId} has LineString: ${hasLineString}, has Point: ${hasPoint}, has Polygon: ${hasPolygon}`);
    if (DEBUG_INFRA) console.log(`[DEBUG] ${layerId} sample features:`, data.features.slice(0, 2).map(f => ({
      hasGeometry: !!f.geometry,
      geometryType: f.geometry?.type,
      hasCoordinates: !!f.geometry?.coordinates
    })));
    if (layerId === 'streetParkingSigns') {
      try {
        const pts = (data.features || []).filter(f => f.geometry?.type === 'Point').map(f => f.geometry.coordinates);
        const lons = pts.map(c => c[0]);
        const lats = pts.map(c => c[1]);
        const stats = pts.length ? {
          count: pts.length,
          minLon: Math.min(...lons), maxLon: Math.max(...lons),
          minLat: Math.min(...lats), maxLat: Math.max(...lats)
        } : { count: 0 };
        if (DEBUG_INFRA) console.log('[DEBUG] streetParkingSigns plotted coords extent:', stats, 'samples:', pts.slice(0, 10));
      } catch (_) {}
    }
    
    if (hasLineString && layerStyle.type === 'line') {
      const lineLayerId = `layer-${layerId}-line`;
      map.addLayer({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        paint: layerStyle.paint
      }, beforeId);
      if (DEBUG_INFRA) console.log(`[DEBUG] Added line layer: ${lineLayerId}`);
      // Optionally add hover/click events for lines here
    }
    
    if (hasPolygon && (layerStyle.type === 'fill' || layerId === 'stationEnvelopes')) {
      const polygonLayerId = `layer-${layerId}-polygon`;
      // Insert above zone fills by default (just below Draw if present)
      const finalBeforeId = beforeId;
      map.addLayer({
        id: polygonLayerId,
        type: 'fill',
        source: sourceId,
        paint: layerId === 'stationEnvelopes' ? {
          'fill-color': '#10b981',
          'fill-opacity': 0.18,
          'fill-outline-color': '#14b8a6'
        } : layerStyle.paint
      }, finalBeforeId);
      if (DEBUG_INFRA) console.log(`[DEBUG] Added polygon layer: ${polygonLayerId}`);
      
      // Add hover and click events for polygons with tracked handlers
      try {
        const H = map.__infraHandlers || (map.__infraHandlers = new Map());
        
        // Initialize popups if not already created
        if (!infraHoverPopupRef.current) {
          infraHoverPopupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 15,
            className: 'infra-hover-popup'
          });
        }
        if (!infraClickPopupRef.current) {
          infraClickPopupRef.current = new maplibregl.Popup({
            closeButton: true,
            closeOnClick: true,
            offset: 15,
            maxWidth: '300px',
            className: 'infra-click-popup'
          });
        }
        
        const onEnter = () => { try { map.getCanvas().style.cursor = 'pointer'; } catch (_) {} };
        const onLeave = () => { 
          try { 
            map.getCanvas().style.cursor = ''; 
            if (infraHoverPopupRef.current) infraHoverPopupRef.current.remove();
          } catch (_) {} 
        };
        const onMove = (e) => {
          try {
            if (!e || !e.features || e.features.length === 0) return;
            // Don't show hover popup if click popup is open
            if (infraClickPopupRef.current?.isOpen()) return;
            const feature = e.features[0];
            const content = buildInfrastructureHoverContent(feature.properties, layerId);
            if (content) {
              infraHoverPopupRef.current
                .setLngLat(e.lngLat)
                .setHTML(content)
                .addTo(map);
            }
          } catch (_) {}
        };
        const onClick = (e) => {
          try {
            if (!e || !e.features || e.features.length === 0) return;
            const feature = e.features[0];
            // Close hover popup
            if (infraHoverPopupRef.current) infraHoverPopupRef.current.remove();
            // Show detailed click popup
            const content = buildInfrastructureClickContent(feature.properties, layerId);
            if (content) {
              infraClickPopupRef.current
                .setLngLat(e.lngLat)
                .setHTML(content)
                .addTo(map);
            }
            if (DEBUG_INFRA) console.log('Infrastructure feature clicked:', layerId);
          } catch (_) {}
        };
        map.on('mouseenter', polygonLayerId, onEnter);
        map.on('mouseleave', polygonLayerId, onLeave);
        map.on('mousemove', polygonLayerId, onMove);
        map.on('click', polygonLayerId, onClick);
        H.set(polygonLayerId, { enter: onEnter, leave: onLeave, move: onMove, click: onClick });
      } catch (_) {}
    }
    
    if (hasPoint && (layerStyle.type === 'symbol' || layerStyle.type === 'circle')) {
      const pointLayerId = `layer-${layerId}-point`;
      
      const layerConfig = {
        id: pointLayerId,
        type: layerStyle.type,
        source: sourceId,
        paint: layerStyle.paint
      };
      
      if (layerStyle.layout) {
        layerConfig.layout = layerStyle.layout;
      }
      // Only apply icon-alignment props for symbol layers
      if (layerConfig.type === 'symbol') {
        try {
          layerConfig.layout = {
            ...(layerConfig.layout || {}),
            'symbol-placement': 'point',
            // 'map' alignment = icons are FIXED in world space, rotate WITH the map (like basemap features)
            // No JavaScript rotation updates needed - MapLibre handles it natively on the GPU
            'icon-rotation-alignment': 'map',
            'icon-pitch-alignment': 'map',
            'icon-rotate': ['coalesce', ['get', 'icon_base_rotation'], ['coalesce', ['get', 'icon_rotate'], 0]],
            'icon-anchor': 'center',
            'icon-offset': [0, 0]
          };
        } catch (_) {}
      }
      
      if (DEBUG_INFRA) console.log(`[DEBUG] Adding point layer: ${pointLayerId} with config:`, layerConfig);
      
      map.addLayer(layerConfig, beforeId);
      
      try {
        const H = map.__infraHandlers || (map.__infraHandlers = new Map());
        
        // Initialize popups if not already created
        if (!infraHoverPopupRef.current) {
          infraHoverPopupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 15,
            className: 'infra-hover-popup'
          });
        }
        if (!infraClickPopupRef.current) {
          infraClickPopupRef.current = new maplibregl.Popup({
            closeButton: true,
            closeOnClick: true,
            offset: 15,
            maxWidth: '300px',
            className: 'infra-click-popup'
          });
        }
        
        const onEnter = () => { try { map.getCanvas().style.cursor = 'pointer'; } catch (_) {} };
        const onLeave = () => { 
          try { 
            map.getCanvas().style.cursor = ''; 
            if (infraHoverPopupRef.current) infraHoverPopupRef.current.remove();
          } catch (_) {} 
        };
        const onMove = (e) => {
          try {
            if (!e || !e.features || e.features.length === 0) return;
            // Don't show hover popup if click popup is open
            if (infraClickPopupRef.current?.isOpen()) return;
            const feature = e.features[0];
            const content = buildInfrastructureHoverContent(feature.properties, layerId);
            if (content) {
              infraHoverPopupRef.current
                .setLngLat(e.lngLat)
                .setHTML(content)
                .addTo(map);
            }
          } catch (_) {}
        };
        const onClick = (e) => {
          try {
            if (!e || !e.features || e.features.length === 0) return;
            const feature = e.features[0];
            // Close hover popup
            if (infraHoverPopupRef.current) infraHoverPopupRef.current.remove();
            // Show detailed click popup
            const content = buildInfrastructureClickContent(feature.properties, layerId);
            if (content) {
              infraClickPopupRef.current
                .setLngLat(e.lngLat)
                .setHTML(content)
                .addTo(map);
            }
            if (DEBUG_INFRA) console.log('Infrastructure feature clicked:', layerId);
          } catch (_) {}
        };
        map.on('mouseenter', pointLayerId, onEnter);
        map.on('mouseleave', pointLayerId, onLeave);
        map.on('mousemove', pointLayerId, onMove);
        map.on('click', pointLayerId, onClick);
        H.set(pointLayerId, { enter: onEnter, leave: onLeave, move: onMove, click: onClick });
      } catch (_) {}
      
      if (DEBUG_INFRA) console.log(`[DEBUG] Successfully added point layer: ${pointLayerId}`);
      // NOTE: We intentionally do NOT call ensureViewportAlignedSymbols here.
      // Infrastructure icons use 'map' alignment so they are FIXED in world space,
      // rotating WITH the map like basemap features. This is handled in the layer config above.
    }
  }, [map, layers, view?.viewType]);

  // (removed duplicate definition further below)

  // Load infrastructure layer - now addInfrastructureLayerToMap is defined
  const loadInfrastructureLayer = useCallback(async (layerId) => {
    if (DEBUG_INFRA) console.log(`[infra] loadInfrastructureLayer called for ${layerId}, map:`, !!map, 'focusedArea:', !!focusedArea, 'alreadyLoading:', loadingLayersRef.current.has(layerId));
    
    if (!map || !focusedArea || loadingLayersRef.current.has(layerId)) {
      if (DEBUG_INFRA) console.log(`[infra] loadInfrastructureLayer skipping ${layerId}: no map/focusedArea or already loading`);
      return;
    }
    const cfg = layersRef.current?.[layerId];
    if (cfg?.disabled || DISABLED_INFRASTRUCTURE_LAYERS.has(layerId)) {
      if (DEBUG_INFRA) console.log(`[infra] loadInfrastructureLayer skipping ${layerId}: disabled`);
      return;
    }
    
    if (DEBUG_INFRA) console.log(`[infra] Loading ${layerId} for area:`, focusedArea.properties?.name || focusedArea.id);
    
    // Mark as loading
    loadingLayersRef.current.add(layerId);
    
    setLayers(prev => ({
      ...prev,
      [layerId]: { ...prev[layerId], loading: true, error: false }
    }));
    
    try {
      // Capture version at start
      const startVersion = (requestVersionRef.current.get(layerId) || 0);
      const bounds = calculateGeometryBounds(focusedArea.geometry);
      if (!bounds) throw new Error('Invalid geometry bounds');
      
      // Use robust fetch with timeout + limited retries to avoid indefinite loading
      const data = await loadWithRetry(layerId, bounds, 3);
      
      let filteredFeatures = data.features;
      if (layerId !== 'hydrants' && layerId !== 'busStops') {
        filteredFeatures = filterFeaturesByType(data.features, layerId);
      }
      
      let filteredData = {
        type: 'FeatureCollection',
        features: filteredFeatures,
        crs: data.crs || { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } }
      };

      // Special handling for subway entrances: generate MTA train line icons
      if (layerId === 'subwayEntrances') {
        try {
          // Preload common train line icons
          preloadCommonTrainLineIcons(map);
          
          // Annotate each feature with train lines and custom icon
          filteredData = {
            ...filteredData,
            features: filteredData.features.map((f) => {
              const props = f.properties || {};
              const lines = parseTrainLines(
                props.daytime_routes || props.routes || props.line || props.lines
              );
              
              // Generate and add icon to map
              const iconId = addTrainLineIconToMap(map, lines);
              
              return {
                ...f,
                properties: {
                  ...props,
                  train_lines: lines,
                  icon_image: iconId || 'subway-generic'
                }
              };
            })
          };
        } catch (error) {
          console.warn('Error generating subway entrance icons:', error);
        }
      }

      // Enhanced rendering: annotate features for angle-specific sprite IDs when enabled
      try {
        const cfg = layers[layerId];
        if (cfg?.enhancedRendering?.enabled) {
          // Ensure sprites are loaded for variants BEFORE adding layer to map
          try {
            const viewType = view?.viewType || getMapViewType(map);
            const spriteBase = cfg.enhancedRendering.spriteBase;
            const layerPublicDir = cfg.enhancedRendering.publicDir || `/static/${spriteBase}`;
            const angles = cfg.enhancedRendering.angles || [0, 45, 90, 135, 180, 225, 270, 315];
            
            // Preload ALL angle variants before adding layer to prevent styleimagemissing events
            await addEnhancedSpritesToMap(map, {
              baseName: spriteBase,
              publicDir: layerPublicDir,
              angles,
              viewType,
              urlBuilder: buildFlatSpriteUrl,
              replaceExisting: false
            });
            
            // Verify critical sprites are registered before proceeding
            const criticalAngles = viewType === 'top-down' ? [0] : [0, 45, 90, 135, 180, 225, 270, 315];
            for (const angle of criticalAngles) {
              const spriteId = buildSpriteImageId(spriteBase, angle, viewType);
              let registered = false;
              for (let attempt = 0; attempt < 10; attempt++) {
                try {
                  if (map.hasImage && map.hasImage(spriteId)) {
                    registered = true;
                    break;
                  }
                } catch (_) {}
                await new Promise(resolve => setTimeout(resolve, 50));
              }
              if (!registered && DEBUG_INFRA) {
                console.warn(`[loadInfrastructureLayer] Sprite ${spriteId} not registered after preload for ${layerId}`);
              }
            }
            
            // Opportunistic prefetch for current view
            try { prefetchView(spriteBase, angles, viewType, { map }); } catch(_) {}
          } catch (err) {
            if (DEBUG_INFRA) console.warn(`[loadInfrastructureLayer] Failed to preload sprites for ${layerId}:`, err);
          }

          // For point features, compute a bearing from nearest CSCL centerline when desired
          let lineFeatures = [];
          console.log(`[CSCL] ${layerId}: desiredParallelTo = ${cfg.enhancedRendering?.desiredParallelTo || 'undefined'}`);
          try {
            if (cfg.enhancedRendering?.desiredParallelTo === 'cscl') {
              // Expand bounds to find nearby streets (0.003° ≈ 330m at NYC latitude)
              const expandFactor = 0.003;
              const expanded = expandBounds(bounds, expandFactor);
              const [minLng, minLat] = expanded[0];
              const [maxLng, maxLat] = expanded[1];
              
              // Build Socrata SoQL spatial query using WKT POLYGON
              // Docs: https://dev.socrata.com/docs/functions/intersects.html
              const wktPoly = `POLYGON((${minLng} ${minLat}, ${minLng} ${maxLat}, ${maxLng} ${maxLat}, ${maxLng} ${minLat}, ${minLng} ${minLat}))`;
              const where = `intersects(the_geom, '${wktPoly}')`;
              const csclUrl = `https://data.cityofnewyork.us/resource/inkn-q76z.geojson?$where=${encodeURIComponent(where)}&$limit=5000`;
              
              console.log(`[CSCL] ${layerId}: Fetching from NYC Open Data...`);
              console.log(`[CSCL] ${layerId}: Bounds: [${minLng.toFixed(4)}, ${minLat.toFixed(4)}] to [${maxLng.toFixed(4)}, ${maxLat.toFixed(4)}]`);
              
              try {
                const resp = await fetch(csclUrl);
                console.log(`[CSCL] ${layerId}: Response status = ${resp.status}`);
                
                if (resp.ok) {
                  const gj = await resp.json();
                  // Handle both array (Socrata sometimes returns raw array) and FeatureCollection formats
                  if (Array.isArray(gj)) {
                    lineFeatures = gj;
                  } else if (gj?.features && Array.isArray(gj.features)) {
                    lineFeatures = gj.features;
                  }
                  console.log(`[CSCL] ${layerId}: ✅ Loaded ${lineFeatures.length} centerline features`);
                  if (lineFeatures.length > 0 && lineFeatures[0]?.geometry) {
                    console.log(`[CSCL] ${layerId}: First feature type = ${lineFeatures[0].geometry.type}`);
                  }
                } else {
                  const errorText = await resp.text().catch(() => 'Unable to read error');
                  console.warn(`[CSCL] ${layerId}: ❌ Failed (${resp.status}): ${errorText.substring(0, 200)}`);
                }
              } catch (fetchErr) {
                console.warn(`[CSCL] ${layerId}: ❌ Fetch error:`, fetchErr.message || fetchErr);
              }
            }
          } catch (err) {
            console.error(`[CSCL] ${layerId}: Error in CSCL block:`, err);
          }

          // Annotate each Point feature with base bearing and initial icon_image property
          // Track alignment statistics
          const alignmentStats = { cscl: 0, area: 0, fallback: 0, total: 0 };
          let sampleBearings = []; // For debugging - collect first few bearings
          
          filteredData = {
            ...filteredData,
            features: filteredData.features.map((f, featureIdx) => {
              if (!f || f.geometry?.type !== 'Point') return f;
              alignmentStats.total++;
              const p = f.properties || {};
              let baseBearing = null;
              let side = null;
              let baseSource = null;
              if (lineFeatures && lineFeatures.length > 0) {
                const local = computeNearestSegmentClosestPointBearing(f, lineFeatures);
                if (local && typeof local.axisBearing === 'number') {
                  baseBearing = local.axisBearing;
                  side = local.side || null;
                  baseSource = 'cscl';
                  alignmentStats.cscl++;
                  if (sampleBearings.length < 3) {
                    sampleBearings.push({ idx: featureIdx, bearing: baseBearing, source: 'cscl-segment', coords: f.geometry.coordinates });
                  }
                } else {
                  const br = computeNearestLineBearing(f, lineFeatures);
                  if (br != null) { 
                    baseBearing = br; 
                    baseSource = 'cscl'; 
                    alignmentStats.cscl++;
                    if (sampleBearings.length < 3) {
                      sampleBearings.push({ idx: featureIdx, bearing: baseBearing, source: 'cscl-line', coords: f.geometry.coordinates });
                    }
                  }
                }
              }
              if (baseBearing == null) {
                // Fallback: When CSCL alignment fails, use 0° (North-facing) as default
                // This is more predictable than area orientation which can give diagonal angles
                // for zones with curved/rounded edges
                baseBearing = 0;
                side = 'right'; // Default side when we can't determine from street
                baseSource = 'fallback';
                alignmentStats.fallback++;
              }
              const facingMode = cfg?.enhancedRendering?.facingMode;
              const { imageId: img } = computeFeatureSpriteAngle({
                map,
                view,
                areaGeom: focusedArea?.geometry,
                facingMode,
                baseAxisBearing: (baseBearing != null ? baseBearing : 0),
                side,
                spriteBase: cfg.enhancedRendering.spriteBase
              }) || {};
              
              // Calculate the display bearing based on facingMode
              // baseBearing = street axis direction (from CSCL)
              // For items that should face TOWARD or AWAY from the street, we add ±90°
              // to make them PERPENDICULAR to the street axis
              let displayBase = (baseBearing != null ? baseBearing : 0);
              if (facingMode === 'towardStreet' || facingMode === 'awayFromStreet') {
                const axis = ((Number(displayBase) % 360) + 360) % 360;
                const left = ((axis - 90) % 360 + 360) % 360;  // perpendicular left
                const right = ((axis + 90) % 360 + 360) % 360; // perpendicular right
                // Determine which perpendicular direction based on which side of street the item is on
                const isLeft = side === 'left';
                const toStreet = isLeft ? right : left;   // facing toward street center
                const awayStreet = isLeft ? left : right; // facing away from street center
                displayBase = (facingMode === 'towardStreet') ? toStreet : awayStreet;
              }
              const normalizedDisplayBearing = ((Number(displayBase) % 360) + 360) % 360;
              
              if (sampleBearings.length < 5) {
                sampleBearings.push({ 
                  idx: featureIdx, 
                  baseBearing, 
                  normalizedDisplayBearing,
                  side,
                  facingMode,
                  source: baseSource,
                  coords: f.geometry?.coordinates 
                });
              }
              
              return { ...f, properties: { ...p, icon_image: img, icon_sprite_base: cfg.enhancedRendering.spriteBase, icon_base_bearing: baseBearing, icon_side: side, icon_base_bearing_source: baseSource, icon_display_bearing: normalizedDisplayBearing, icon_base_rotation: normalizedDisplayBearing } };
            })
          };
          
          // Log alignment statistics
          console.log(`[Alignment] ${layerId}: ${alignmentStats.cscl}/${alignmentStats.total} aligned to CSCL (${alignmentStats.area} area, ${alignmentStats.fallback} fallback)`);
          console.log(`[Alignment] ${layerId}: Sample bearings:`, JSON.stringify(sampleBearings.slice(0, 3), null, 0));
        }
      } catch (e) {
        console.warn('[enhancedRendering] failed to annotate features:', e);
      }
      
      if (DEBUG_INFRA) console.log(`Loaded ${layerId}: ${filteredData.features.length} features found for area ${focusedArea.properties?.name || focusedArea.id}`);
      if (layerId === 'dcwpParkingGarages') {
        if (DEBUG_INFRA) console.log('[dcwp] sample feature geoms:', filteredData.features.slice(0, 2).map(f => f.geometry?.type));
      }
      
      // Ignore stale completion
      if ((requestVersionRef.current.get(layerId) || 0) !== startVersion) return;

      // Save the data
      setInfrastructureData(prev => ({
        ...prev,
        [layerId]: filteredData
      }));

      // Determine if dataset is empty up front
      const isEmpty = !filteredData?.features || filteredData.features.length === 0;

      if (isEmpty) {
        // No features: mark as loaded with no data immediately; do not wait for map layer presence
        setLayers(prev => ({
          ...prev,
          [layerId]: {
            ...prev[layerId],
            loading: false,
            error: false,
            loaded: true,
            empty: true,
            visible: false
          }
        }));
      } else {
        // Add to map; finalize to "ready" only after a render idle confirms style processed
        addInfrastructureLayerToMap(layerId, filteredData);

        // Keep showing loading until confirmed on next idle, then mark ready/visible
        const confirmReady = () => {
          try {
            if ((requestVersionRef.current.get(layerId) || 0) !== startVersion) return;
            const stillRequested = !!(layersRef.current?.[layerId]?.requested);
            setLayers(prev => ({
              ...prev,
              [layerId]: {
                ...prev[layerId],
                loading: false,
                error: false,
                loaded: true,
                empty: false,
                visible: stillRequested ? true : false
              }
            }));
            try { if (stillRequested) toggleInfrastructureLayerVisibility(layerId, true).catch(() => {}); } catch (_) {}
          } catch (_) {}
        };

        const safetyErr = () => {
          try {
            if ((requestVersionRef.current.get(layerId) || 0) !== startVersion) return;
            setLayers(prev => ({
              ...prev,
              [layerId]: { ...prev[layerId], loading: false, error: true, loaded: false, visible: false }
            }));
          } catch (_) {}
        };

        let safetyTimer = null;
        try { safetyTimer = setTimeout(safetyErr, 12000); } catch (_) {}
        try {
          if (map && typeof map.once === 'function') {
            map.once('idle', () => {
              try { if (safetyTimer) clearTimeout(safetyTimer); } catch (_) {}
              confirmReady();
            });
          } else {
            // Fallback next tick if idle is unavailable
            setTimeout(() => {
              try { if (safetyTimer) clearTimeout(safetyTimer); } catch (_) {}
              confirmReady();
            }, 0);
          }
        } catch (_) {
          try { if (safetyTimer) clearTimeout(safetyTimer); } catch (_) {}
          confirmReady();
        }
      }
      
    } catch (error) {
      console.error(`Error loading ${layerId}:`, error);
      setLayers(prev => ({
        ...prev,
        [layerId]: { 
          ...prev[layerId], 
          loading: false, 
          error: true, 
          visible: false,
          loaded: false,
          empty: false
        }
      }));
    } finally {
      loadingLayersRef.current.delete(layerId);
    }
  }, [map, focusedArea, addInfrastructureLayerToMap, setLayers, view?.viewType]);

  // Clear layer - use useCallback
  const clearLayer = useCallback((layerId) => {
    if (!map) return;
    
    // Check if map has a style loaded before trying to access layers
    try {
      if (!map.getStyle()) {
        if (DEBUG_INFRA) console.log(`Infrastructure: Map style not loaded, skipping clear for ${layerId}`);
        return;
      }
    } catch (error) {
      if (DEBUG_INFRA) console.log(`Infrastructure: Error checking map style, skipping clear for ${layerId}:`, error);
      return;
    }
    
    const config = layers[layerId];
    if (!config) return;
    
    // Remove all possible layer IDs and detach events
    try {
      const pointLayerId = `layer-${layerId}-point`;
      const lineLayerId = `layer-${layerId}-line`;
      const polygonLayerId = `layer-${layerId}-polygon`;
      const altLayerId = `${layerId}-layer`;

      if (map.getLayer(pointLayerId)) {
        try { map.off('mouseenter', pointLayerId); } catch {}
        try { map.off('mouseleave', pointLayerId); } catch {}
        try { map.off('click', pointLayerId); } catch {}
        map.removeLayer(pointLayerId);
      }
      if (map.getLayer(lineLayerId)) {
        map.removeLayer(lineLayerId);
      }
      if (map.getLayer(polygonLayerId)) {
        try { map.off('mouseenter', polygonLayerId); } catch {}
        try { map.off('mouseleave', polygonLayerId); } catch {}
        try { map.off('click', polygonLayerId); } catch {}
        map.removeLayer(polygonLayerId);
      }
      if (map.getLayer(altLayerId)) {
        map.removeLayer(altLayerId);
      }
      if (map.getSource(layerId)) {
        map.removeSource(layerId);
      }
      if (map.getSource(`source-${layerId}`)) {
        map.removeSource(`source-${layerId}`);
      }
      if (DEBUG_INFRA) console.log(`Infrastructure: Cleared layer ${layerId}`);
    } catch (error) {
      if (DEBUG_INFRA) console.log(`Infrastructure: Error clearing layer ${layerId}:`, error);
    }
  }, [map, layers]);

  // Load layer - use useCallback
  const loadLayer = useCallback(async (layerId) => {
    if (!map || !focusedArea) return;
    
    const config = layers[layerId];
    if (!config || config.loading || config.loaded) return;

    // Set loading state
    setLayers(prev => ({
      ...prev,
      [layerId]: { ...prev[layerId], loading: true, error: null }
    }));

    try {
      // Clear any existing layer first
      clearLayer(layerId);

      // Get the focused area geometry
      const geometry = focusedArea.geometry;
      
      // Make API call with the focused area geometry
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          geometry: geometry,
          // Add any other parameters the API expects
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Add the data as a source to the map
      map.addSource(layerId, {
        type: 'geojson',
        data: data
      });

      // Add the layer with appropriate styling
      map.addLayer({
        id: `${layerId}-layer`,
        type: config.style.type || 'line',
        source: layerId,
        paint: config.style.paint || {},
        layout: {
          visibility: config.visible ? 'visible' : 'none'
        }
      });

      // Update layer state
      setLayers(prev => ({
        ...prev,
        [layerId]: { 
          ...prev[layerId], 
          loading: false, 
          loaded: true, 
          error: null 
        }
      }));

      if (DEBUG_INFRA) console.log(`Infrastructure: Loaded layer ${layerId} for area ${focusedArea.id}`);

    } catch (error) {
      console.error(`Error loading ${layerId}:`, error);
      setLayers(prev => ({
        ...prev,
        [layerId]: { 
          ...prev[layerId], 
          loading: false, 
          error: error.message 
        }
      }));
    }
  }, [map, focusedArea, layers, setLayers, clearLayer]);

  // Toggle infrastructure layer visibility - preload sprites before showing (React/MapLibre best practice)
  const toggleInfrastructureLayerVisibility = useCallback(async (layerId, visible) => {
    if (!map) return;
    
    const pointLayerId = `layer-${layerId}-point`;
    const lineLayerId = `layer-${layerId}-line`;
    const polygonLayerId = `layer-${layerId}-polygon`;
    
    try {
      // If making visible, ensure sprites are preloaded first (React/MapLibre best practice)
      if (visible) {
        const layerConfig = layersRef.current?.[layerId];
        if (layerConfig?.enhancedRendering?.enabled && layerConfig?.enhancedRendering?.spriteBase) {
          const viewType = view?.viewType || getMapViewType(map);
          const spriteBase = layerConfig.enhancedRendering.spriteBase;
          const angles = layerConfig.enhancedRendering.angles || [0, 45, 90, 135, 180, 225, 270, 315];
          
          // Preload all angle variants before showing layer to prevent flicker
          // Use spriteResolver's preloadImage for better MapLibre integration
          try {
            // Ensure map style is ready
            if (map.isStyleLoaded && !map.isStyleLoaded()) {
              await new Promise((resolve) => {
                map.once('style.load', resolve);
              });
            }
            
            // Preload sprites using addEnhancedSpritesToMap which properly registers with MapLibre
            // Use the publicDir from layer config if available, otherwise construct it
            const layerPublicDir = layerConfig.enhancedRendering.publicDir || `/static/${spriteBase}`;
            await addEnhancedSpritesToMap(map, {
              baseName: spriteBase,
              publicDir: layerPublicDir,
              angles,
              viewType,
              urlBuilder: buildFlatSpriteUrl,
              replaceExisting: false
            });
            
            // Verify that sprites are actually registered with MapLibre before proceeding
            // This prevents race conditions where MapLibre tries to render before sprites are ready
            const criticalAngles = [0, 45, 90, 135, 180, 225, 270, 315].filter(a => angles.includes(a));
            for (const angle of criticalAngles) {
              const spriteId = buildSpriteImageId(spriteBase, angle, viewType);
              // Poll up to 5 times (250ms total) to ensure sprite is registered
              let registered = false;
              for (let attempt = 0; attempt < 5; attempt++) {
                try {
                  if (map.hasImage && map.hasImage(spriteId)) {
                    registered = true;
                    break;
                  }
                } catch (_) {}
                await new Promise(resolve => setTimeout(resolve, 50));
              }
              if (!registered) {
                // Continue anyway - styleimagemissing handler will catch it
                // But log for debugging
                if (DEBUG_INFRA) console.warn(`[useInfrastructure] Sprite ${spriteId} not registered after preload for ${layerId}`);
                break;
              }
            }
          } catch (err) {
            // Continue even if sprite loading fails - styleimagemissing will handle it
            console.warn(`[useInfrastructure] Failed to preload sprites for ${layerId}:`, err);
          }
        }
      }
      
      const next = visible ? 'visible' : 'none';
      const setIfChanged = (id) => {
        if (!map.getLayer(id)) return;
        try {
          const cur = map.getLayoutProperty(id, 'visibility');
          if (cur !== next) map.setLayoutProperty(id, 'visibility', next);
        } catch (_) {}
      };
      setIfChanged(pointLayerId);
      setIfChanged(lineLayerId);
      setIfChanged(polygonLayerId);
    } catch (error) {
      console.error(`Error toggling ${layerId} visibility:`, error);
    }
  }, [map, view?.viewType]);;

  // (toggleLayer / reloadVisibleLayers are declared after queue helpers)

  // Queue runner with limited concurrency (declared after loadInfrastructureLayer)
  const drainQueue = useCallback(() => {
    try {
      while (activeLoadsRef.current < maxConcurrentRef.current && loadQueueRef.current.length > 0) {
        const layerId = loadQueueRef.current.shift();
        if (!layerId) continue;
        if (DEBUG_INFRA) console.log('[infra] start load:', layerId);
        activeLoadsRef.current += 1;
        (async () => {
          try {
            await loadInfrastructureLayer(layerId);
            if (DEBUG_INFRA) console.log('[infra] finalized load:', layerId);
          } catch (e) {
            // On failure, mark layer as not loading/error to unblock UI and continue
            try {
              setLayers(prev => ({
                ...prev,
                [layerId]: {
                  ...prev[layerId],
                  loading: false,
                  error: true,
                  loaded: false
                }
              }));
            } catch (_) {}
          } finally {
            try { queuedSetRef.current.delete(layerId); } catch (_) {}
            activeLoadsRef.current = Math.max(0, activeLoadsRef.current - 1);
            setBulkProgress(prev => ({ total: prev.total, completed: Math.min(prev.total, prev.completed + 1) }));
            if (loadQueueRef.current.length === 0 && activeLoadsRef.current === 0) {
              setBulkLoading(false);
            } else {
              drainQueue();
            }
          }
        })();
      }
    } catch (_) {}
  }, [loadInfrastructureLayer]);

  const enqueueLoad = useCallback((layerId) => {
    try {
      const cfg = layersRef.current?.[layerId];
      if (!cfg || cfg.loading || cfg.loaded) return;
      if (queuedSetRef.current.has(layerId)) return;
      // Bump request version for this new intent
      try {
        const prev = requestVersionRef.current.get(layerId) || 0;
        requestVersionRef.current.set(layerId, prev + 1);
      } catch (_) {}
      queuedSetRef.current.add(layerId);
      loadQueueRef.current.push(layerId);
      drainQueue();
    } catch (_) {}
  }, [drainQueue]);

  const bulkCancelLoading = useCallback(() => {
    try {
      loadQueueRef.current = [];
      queuedSetRef.current.clear();
      setBulkLoading(false);
      setBulkProgress({ total: 0, completed: 0 });
    } catch (_) {}
  }, []);

  // Toggle layer - fix to properly load data for new areas
  const toggleLayer = useCallback((layerId) => {
    // Only handle infrastructure layers, not permit areas
    if (layerId === 'permitAreas') {
      if (DEBUG_INFRA) console.warn('Permit areas should be handled by EventStager, not infrastructure hook');
      return;
    }
    // Respect disabled layers
    const cfg = layers?.[layerId];
    if (cfg?.disabled || DISABLED_INFRASTRUCTURE_LAYERS.has(layerId)) {
      if (DEBUG_INFRA) console.log(`[infrastructure] Layer ${layerId} is disabled; ignoring toggle.`);
      return;
    }

    // Only allow toggling infrastructure layers if an area is focused
    if (!focusedArea) {
      if (DEBUG_INFRA) console.log('Please focus on a permit area first to enable infrastructure layers');
      return;
    }
    
    // Infrastructure layer toggling
    setLayers(prev => {
      const updatedLayers = { ...prev };
      const currentConfig = prev[layerId];
      if (!currentConfig) return prev; // Skip if layer doesn't exist
      
      const willBeRequested = !currentConfig.requested;
      
      // Special handling for subwayEntrances: default behavior toggles subwayLines ON when turning ON
      // (but allows independent control after)
      if (layerId === 'subwayEntrances' && willBeRequested) {
        const subwayLinesConfig = prev.subwayLines;
        // If subwayLines is not requested, also toggle it ON (default behavior)
        if (subwayLinesConfig && !subwayLinesConfig.requested) {
          const subwayLinesWillBeRequested = true;
          // Bump version for subwayLines
          try {
            const prevV = requestVersionRef.current.get('subwayLines') || 0;
            requestVersionRef.current.set('subwayLines', prevV + 1);
          } catch (_) {}
          if (!subwayLinesConfig.loaded && !subwayLinesConfig.loading && !loadingLayersRef.current.has('subwayLines')) {
            enqueueLoad('subwayLines');
          } else {
            try { toggleInfrastructureLayerVisibility('subwayLines', !subwayLinesConfig.empty).catch(() => {}); } catch (_) {}
          }
          updatedLayers.subwayLines = {
            ...prev.subwayLines,
            requested: subwayLinesWillBeRequested,
            visible: subwayLinesWillBeRequested ? (subwayLinesConfig.loaded ? !subwayLinesConfig.empty : false) : false,
            loading: subwayLinesWillBeRequested ? prev.subwayLines.loading : false
          };
        }
      }
      
      // Handle the primary layer toggle
      // Map side effect
      if (willBeRequested) {
        // Bump version for new request intent
        try {
          const prevV = requestVersionRef.current.get(layerId) || 0;
          requestVersionRef.current.set(layerId, prevV + 1);
        } catch (_) {}
        if (!currentConfig.loaded && !currentConfig.loading && !loadingLayersRef.current.has(layerId)) {
          enqueueLoad(layerId);
        } else {
          // Preload sprites before showing layer (fire-and-forget async)
          toggleInfrastructureLayerVisibility(layerId, !currentConfig.empty).catch(() => {});
        }
      } else {
        // Turning off: hide immediately (no sprite preloading needed)
        try { toggleInfrastructureLayerVisibility(layerId, false).catch(() => {}); } catch (_) {}
        try {
          // Remove from queue if present
          queuedSetRef.current.delete(layerId);
          try { loadQueueRef.current = (loadQueueRef.current || []).filter((queueId) => queueId !== layerId); } catch (_) {}
          // If currently loading, mark as not loading so UI clears spinner; fetch cannot be aborted but completion will be ignored
          loadingLayersRef.current.delete(layerId);
          // Bump version so any in-flight completion is ignored
          const prevV = requestVersionRef.current.get(layerId) || 0;
          requestVersionRef.current.set(layerId, prevV + 1);
        } catch (_) {}
      }
      
      updatedLayers[layerId] = {
        ...prev[layerId],
        requested: willBeRequested,
        // Keep visible in sync with requested to avoid re-show via effects
        visible: willBeRequested ? (currentConfig.loaded ? !currentConfig.empty : false) : false,
        // If turning off, ensure loading flag is cleared for UI responsiveness
        loading: willBeRequested ? prev[layerId].loading : false
      };
      
      return updatedLayers;
    });
  }, [focusedArea, enqueueLoad, toggleInfrastructureLayerVisibility, setLayers]);

  // Reload any currently visible layers (useful after style changes)
  // Use layersRef to avoid recreating callback on every layer change
  const reloadVisibleLayers = useCallback(() => {
    if (!map || !focusedArea) return;
    const run = () => {
      Object.entries(layersRef.current || {}).forEach(([layerId, config]) => {
        if (layerId !== 'permitAreas' && !config?.disabled && !DISABLED_INFRASTRUCTURE_LAYERS.has(layerId) && config.requested && !loadingLayersRef.current.has(layerId)) {
          if (DEBUG_INFRA) console.log('[infra] enqueue after reloadVisibleLayers:', layerId);
          enqueueLoad(layerId);
        }
      });
    };
    // Debounce to next tick to avoid thundering herd on style changes
    try { if (reloadDebounceRef.current) clearTimeout(reloadDebounceRef.current); } catch (_) {}
    reloadDebounceRef.current = setTimeout(() => {
      try {
        if (map.isStyleLoaded && !map.isStyleLoaded()) {
          map.once('style.load', run);
        } else {
          run();
        }
      } catch (_) {
        run();
      }
    }, 0);
  }, [map, focusedArea, enqueueLoad]); // Removed 'layers' dependency - use layersRef instead

  // After import rehydration completes, load any visible infrastructure layers
  useEffect(() => {
    const handler = () => {
      try { reloadVisibleLayers(); } catch (_) {}
    };
    try {
      if (typeof window !== 'undefined') window.addEventListener('rehydrating-import:end', handler);
    } catch (_) {}
    return () => {
      try { if (typeof window !== 'undefined') window.removeEventListener('rehydrating-import:end', handler); } catch (_) {}
    };
  }, [reloadVisibleLayers]);

  // When layer visibility state changes (e.g., after import), load any visible layers
  // that are not yet loaded, and ensure they are visible on the map once data arrives.
  useEffect(() => {
    if (!map || !focusedArea) return;
    const run = () => {
      try {
        const prevVisibility = prevLayerVisibilityRef.current;
        const currentVisibility = new Map();
        
        Object.entries(layers || {}).forEach(([layerId, cfg]) => {
          if (layerId === 'permitAreas') return;
          if (cfg?.disabled || DISABLED_INFRASTRUCTURE_LAYERS.has(layerId)) return;

          const visibilityKey = `${cfg?.requested}-${cfg?.visible}-${cfg?.loaded}`;
          currentVisibility.set(layerId, visibilityKey);
          
          // Only act on layers the user has requested to be on
          // If marked visible by state but not yet loaded/loading, fetch now
          if (cfg?.requested && cfg?.visible && !cfg?.loaded && !cfg?.loading && !loadingLayersRef.current.has(layerId)) {
            loadInfrastructureLayer(layerId);
            return;
          }

          // Only update visibility if the layer's visibility state actually changed
          // This prevents unnecessary updates to all layers when one layer is toggled.
          // Note: toggleLayer already calls toggleInfrastructureLayerVisibility for the specific layer,
          // so this useEffect primarily handles:
          // 1. Loading layers that are requested but not yet loaded
          // 2. Syncing visibility after import rehydration or initial mount
          const prevKey = prevVisibility.get(layerId);
          const visibilityChanged = prevKey !== visibilityKey;
          
          // For already-loaded layers, only sync visibility if it actually changed
          // Skip if visibility hasn't changed (prevents unnecessary updates to all layers)
          if (cfg?.loaded && visibilityChanged && prevKey !== undefined) {
            // Visibility state changed - sync it with the map
            if (cfg?.requested && cfg?.visible) {
              try { toggleInfrastructureLayerVisibility(layerId, true).catch(() => {}); } catch (_) {}
            } else {
              try { toggleInfrastructureLayerVisibility(layerId, false).catch(() => {}); } catch (_) {}
            }
          }
          // Note: For initial mount (prevKey === undefined), we skip visibility sync here
          // because toggleLayer or loadInfrastructureLayer will handle it when layers are first loaded
        });
        
        // Update the ref with current visibility states
        prevLayerVisibilityRef.current = currentVisibility;
      } catch (_) {}
    };
    try {
      if (map.isStyleLoaded && !map.isStyleLoaded()) {
        map.once('style.load', run);
      } else {
        run();
      }
    } catch (_) {
      run();
    }
  }, [map, focusedArea, layers, loadInfrastructureLayer, toggleInfrastructureLayerVisibility]);

  // Guardrail: if a layer is no longer requested, ensure loading is cleared so UI doesn't show stale spinners
  useEffect(() => {
    try {
      Object.entries(layersRef.current || {}).forEach(([layerId, cfg]) => {
        if (layerId === 'permitAreas') return;
        if (cfg && cfg.loading && !cfg.requested) {
          setLayers(prev => ({
            ...prev,
            [layerId]: { ...prev[layerId], loading: false }
          }));
        }
      });
    } catch (_) {}
  }, [layers, setLayers]);

      // Clear focus and all infrastructure - ensure state is properly reset
  const clearFocus = useCallback(() => {
    if (map) {
      try {
        Object.keys(layers || {}).forEach((layerId) => {
          if (layerId !== 'permitAreas') removeInfrastructureLayer(layerId);
        });
      } catch (_) {}
    }

    // Reset all infrastructure layer states (including requested)
    setLayers(prev => {
      const newLayers = { ...prev };
      Object.keys(newLayers).forEach(layerId => {
        if (layerId !== 'permitAreas') {
          newLayers[layerId] = {
            ...newLayers[layerId],
            visible: false,
            loaded: false,
            loading: false,
            error: null,
            requested: false
          };
        }
      });
      return newLayers;
    });

    // Clear data
    setInfrastructureData({});

    loadingLayersRef.current.clear();
  }, [map, layers, removeInfrastructureLayer, setLayers]);

  // Bulk toggle helper for All Recommended with queue + progress
  const bulkToggleAllRecommended = useCallback((targetOn = true) => {
    if (DEBUG_INFRA) console.log('[infra] bulkToggleAllRecommended called, targetOn:', targetOn, 'focusedArea:', !!focusedArea, 'map:', !!map);
    
    if (!map || !focusedArea) {
      if (DEBUG_INFRA) console.log('[infra] bulkToggleAllRecommended: No map or focusedArea, cannot toggle layers');
      return;
    }
    
    const cur = layersRef.current || {};
    const candidates = Object.keys(cur).filter((id) => id !== 'permitAreas' && !cur[id]?.disabled && !DISABLED_INFRASTRUCTURE_LAYERS.has(id) && !NON_RECOMMENDED_INFRASTRUCTURE_LAYERS.has(id));
    
    if (DEBUG_INFRA) console.log('[infra] bulkToggleAllRecommended: candidates:', candidates.length, candidates);

    if (targetOn) {
      // Determine which to show immediately and which to load
      const loadedToShow = candidates.filter((id) => cur[id]?.loaded && !cur[id]?.empty);
      const toLoad = candidates.filter((id) => {
        const cfg = cur[id];
        return cfg && !cfg.loaded && !cfg.loading && !loadingLayersRef.current.has(id);
      });
      
      if (DEBUG_INFRA) console.log('[infra] bulkToggleAllRecommended: loadedToShow:', loadedToShow.length, 'toLoad:', toLoad.length, toLoad);

      // Update state: mark requested and set visible=true for already-loaded non-empty layers
      setLayers(prev => {
        const next = { ...prev };
        candidates.forEach((id) => {
          const wasLoaded = !!prev[id]?.loaded;
          const wasEmpty = !!prev[id]?.empty;
          next[id] = {
            ...prev[id],
            requested: true,
            visible: wasLoaded ? !wasEmpty : false
          };
        });
        return next;
      });

      // Reflect map visibility for already-loaded layers
      loadedToShow.forEach((id) => { try { toggleInfrastructureLayerVisibility(id, true).catch(() => {}); } catch (_) {} });

      // Queue the rest
      if (toLoad.length > 0) {
        if (DEBUG_INFRA) console.log('[infra] bulkToggleAllRecommended: Queueing', toLoad.length, 'layers for loading');
        setBulkProgress({ total: toLoad.length, completed: 0 });
        setBulkLoading(true);
        toLoad.forEach((id) => enqueueLoad(id));
      } else {
        if (DEBUG_INFRA) console.log('[infra] bulkToggleAllRecommended: No layers to load (all already loaded or loading)');
      }
    } else {
      // Turning everything off: hide on map and in state; cancel outstanding loads
      setLayers(prev => {
        const next = { ...prev };
        candidates.forEach((id) => {
          next[id] = { ...prev[id], requested: false, visible: false };
        });
        return next;
      });
      candidates.forEach((id) => { try { toggleInfrastructureLayerVisibility(id, false).catch(() => {}); } catch (_) {} });
      bulkCancelLoading();
    }
  }, [map, focusedArea, setLayers, enqueueLoad, toggleInfrastructureLayerVisibility, bulkCancelLoading]);

  return useMemo(() => ({
    infrastructureData,
    toggleLayer,
    clearFocus,
    reloadVisibleLayers,
    bulkLoading,
    bulkProgress,
    bulkToggleAllRecommended,
    bulkCancelLoading
  }), [
    infrastructureData,
    toggleLayer,
    clearFocus,
    reloadVisibleLayers,
    bulkLoading,
    bulkProgress,
    bulkToggleAllRecommended,
    bulkCancelLoading
  ]);
};