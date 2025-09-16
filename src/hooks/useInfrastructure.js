// hooks/useInfrastructure.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  loadInfrastructureData, 
  filterFeaturesByType,
  getLayerStyle 
} from '../services/infrastructureService';
import { calculateGeometryBounds, expandBounds } from '../utils/geometryUtils';
import { createInfrastructureTooltipContent } from '../utils/tooltipUtils';
import { addIconsToMap, retryLoadIcons, INFRASTRUCTURE_ICONS } from '../utils/iconUtils';
import { INFRASTRUCTURE_ENDPOINTS } from '../constants/endpoints';
import { addEnhancedSpritesToMap, computeNearestLineBearing, quantizeAngleTo45, quantizeAngleTo90, buildSpriteImageId, getMapViewType, buildSpriteUrl, buildFlatSpriteUrl, quantizeBearingForSprites, computeNearestSegmentClosestPointBearing, computeFeatureSpriteAngle } from '../utils/enhancedRenderingUtils';
import { snapBearingRelativeToArea, computeAreaOrientation } from '../utils/bearingUtils';
import { useMapViewState } from './useMapViewState';
import { DISABLED_INFRASTRUCTURE_LAYERS } from '../constants/layers';
const DEBUG_INFRA = false;
import { prefetchView } from '../utils/spriteResolver';

// NOTE: Enhanced infra sprites: use flat /static/{base}/{base|base_TOP} paths for both views
// because our public assets are deployed in flat layout. The spriteResolver handles nested fallbacks.
export const useInfrastructure = (map, focusedArea, layers, setLayers, options = {}) => {
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
    parksSigns: null
  });

  // Use refs to track state and prevent loops
  const prevFocusedAreaIdRef = useRef(null);
  const loadingLayersRef = useRef(new Set());
  const lastCameraBucketRef = useRef({});

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

    if (focusedAreaId) {
      // Load infrastructure data for layers that are visible
      Object.entries(layers).forEach(([layerId, config]) => {
        if (layerId !== 'permitAreas' && !config?.disabled && !DISABLED_INFRASTRUCTURE_LAYERS.has(layerId) && config.visible && !loadingLayersRef.current.has(layerId)) {
          loadInfrastructureLayer(layerId);
        }
      });
    } else {
      // Clear everything when focus is removed
      if (map) {
        try {
          Object.keys(layers || {}).forEach((layerId) => {
            if (layerId !== 'permitAreas') removeInfrastructureLayer(layerId);
          });
        } catch (_) {}
      }
      
      // Reset infrastructure data map
      setInfrastructureData({});
      
      // Reset all layer states dynamically
      setLayers(prev => {
        const next = { ...prev };
        Object.keys(prev || {}).forEach((layerId) => {
          if (layerId === 'permitAreas') return;
          next[layerId] = { ...prev[layerId], visible: false, loading: false, loaded: false, error: null };
        });
        return next;
      });
      
      loadingLayersRef.current.clear();
    }
  }, [focusedAreaId, layers, map, removeInfrastructureLayer, setLayers]);

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
            visible: false,  // Force layers to be hidden
            loaded: false, 
            loading: false,
            error: null
          }
        }));
      }
    });

    // Clear infrastructure data when focus changes
    setInfrastructureData({
      trees: null,
      hydrants: null,
      busStops: null,
      benches: null,
      trashBaskets: null,
      bikeLanes: null,
      bikeParking: null,
      citibikeStations: null,
      subwayEntrances: null,
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
      parksSigns: null
    });

    // Clear loading states
    loadingLayersRef.current.clear();
    try { lastCameraBucketRef.current = {}; } catch (_) {}
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
  useEffect(() => {
    if (!map) return;
    const viewType = view?.viewType || getMapViewType(map);
    try {
      Object.entries(layers).forEach(([layerId, cfg]) => {
        if (!cfg?.visible || !cfg?.enhancedRendering?.enabled) return;
        const base = cfg.enhancedRendering.spriteBase;
        const angles = cfg.enhancedRendering.angles || [0,45,90,135,180,225,270,315];
        // Replace existing images for this sprite family with the current view variant
        addEnhancedSpritesToMap(map, {
          baseName: base,
          publicDir: `/static/${base}`,
          angles,
          viewType,
          urlBuilder: buildFlatSpriteUrl,
          replaceExisting: true
        });
        // Opportunistic prefetch via DOM for sidebar/other consumers
        try { prefetchView(base, angles, viewType); } catch (_) {}

        // Force a lightweight layout refresh on the symbol layer so updated images are bound
        try {
          const pointLayerId = `layer-${layerId}-point`;
          if (map.getLayer(pointLayerId)) {
            const prev = map.getLayoutProperty(pointLayerId, 'icon-image');
            const fallbackId = INFRASTRUCTURE_ICONS[layerId]?.id;
            if (fallbackId) {
              // Temporarily set to a simple id, then restore the previous expression/value
              map.setLayoutProperty(pointLayerId, 'icon-image', fallbackId);
              // Next tick restore original to trigger rebind
              setTimeout(() => {
                try { map.setLayoutProperty(pointLayerId, 'icon-image', prev); } catch (_) {}
              }, 0);
            }
          }
        } catch (_) {}
      });
      try { if (typeof map.triggerRepaint === 'function') map.triggerRepaint(); } catch (_) {}
    } catch (_) {}
  }, [map, layers, view?.viewType]);

  // Recompute per-feature icon_image for enhanced infra when bearing/view changes
  // Uses same logic as dropped objects: compensate for map bearing in isometric view
  useEffect(() => {
    if (!map) return;
    try {
      Object.entries(layers).forEach(([layerId, cfg]) => {
        if (!cfg?.visible || !cfg?.enhancedRendering?.enabled) return;
        const data = infrastructureData?.[layerId];
        if (!data || !Array.isArray(data.features) || data.features.length === 0) return;
        const viewType = view?.viewType || getMapViewType(map);
        const areaGeom = (() => { try {
          return (focusedArea?.properties?.__subFocus ? focusedArea : null)?.geometry || (focusedArea?.geometry);
        } catch (_) { return null; } })();

        // Per-layer camera bucket to avoid redundant mass recompute
        const bearingRaw = (typeof view?.bearing === 'number') ? view.bearing : (typeof map?.getBearing === 'function' ? map.getBearing() : 0);
        let areaBearing = 0;
        try { if (areaGeom) areaBearing = computeAreaOrientation({ map, geometry: areaGeom }); } catch (_) { areaBearing = 0; }
        const rel = quantizeBearingForSprites((Number(bearingRaw) - Number(areaBearing)), false);
        const snappedBucket = (((Number(areaBearing) + rel) % 360) + 360) % 360;
        const prevBucket = lastCameraBucketRef.current[layerId];
        if (typeof prevBucket === 'number' && prevBucket === snappedBucket) {
          return; // Skip when bucket unchanged
        }
        lastCameraBucketRef.current[layerId] = snappedBucket;
        let changed = false;
        const newFeatures = data.features.map((f) => {
          if (!f || f.geometry?.type !== 'Point') return f;
          const p = f.properties || {};
          const facingMode = cfg?.enhancedRendering?.facingMode;
          const side = p.icon_side || null;
          const baseAngle = (typeof p.icon_base_bearing === 'number') ? p.icon_base_bearing : 0;
          const { imageId: img } = computeFeatureSpriteAngle({
            map,
            view,
            areaGeom,
            facingMode,
            baseAxisBearing: baseAngle,
            side,
            spriteBase: cfg.enhancedRendering.spriteBase
          }) || {};
          if (p.icon_image !== img) {
            changed = true;
            return { ...f, properties: { ...p, icon_image: img } };
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
          setInfrastructureData((prev) => ({ ...prev, [layerId]: updated }));
        }
      });
    } catch (_) {}
  }, [map, layers, infrastructureData, view?.bearing, view?.viewType, view?.pitch]);

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
    
    const layerStyle = getLayerStyle(layerId, layers[layerId], map);
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
      // Prefer placing polygons below active zone geometry if present
      let zoneBeforeId;
      try {
        const zoneCandidates = [
          'sub-focus-fill','sub-focus-outline',
          'permit-areas-focused-fill','permit-areas-focused-outline',
          'plaza-areas-focused-fill','plaza-areas-focused-outline',
          'permit-areas-fill','permit-areas-outline',
          'plaza-areas-fill','plaza-areas-outline'
        ];
        for (const id of zoneCandidates) {
          if (map.getLayer && map.getLayer(id)) { zoneBeforeId = id; break; }
        }
      } catch (_) {}
      const finalBeforeId = zoneBeforeId || beforeId;
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
      
      // Add hover and click events for polygons
      map.on('mouseenter', polygonLayerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', polygonLayerId, () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('click', polygonLayerId, (e) => {
        if (e.features.length === 0) return;
        const feature = e.features[0];
        const content = createInfrastructureTooltipContent(feature.properties, layerId);
        if (DEBUG_INFRA) console.log('Infrastructure feature clicked:', content);
      });
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
      // Ensure icons do not rotate with map bearing/pitch
      try {
        layerConfig.layout = {
          ...(layerConfig.layout || {}),
          'symbol-placement': 'point',
          'icon-rotation-alignment': 'viewport',
          'icon-pitch-alignment': 'viewport',
          'icon-rotate': 0
        };
      } catch (_) {}
      
      if (DEBUG_INFRA) console.log(`[DEBUG] Adding point layer: ${pointLayerId} with config:`, layerConfig);
      
      map.addLayer(layerConfig, beforeId);
      
      map.on('mouseenter', pointLayerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', pointLayerId, () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('click', pointLayerId, (e) => {
        if (e.features.length === 0) return;
        const feature = e.features[0];
        const content = createInfrastructureTooltipContent(feature.properties, layerId);
        if (DEBUG_INFRA) console.log('Infrastructure feature clicked:', content);
      });
      
      if (DEBUG_INFRA) console.log(`[DEBUG] Successfully added point layer: ${pointLayerId}`);
    }
  }, [map, layers]);

  // (removed duplicate definition further below)

  // Load infrastructure layer - now addInfrastructureLayerToMap is defined
  const loadInfrastructureLayer = useCallback(async (layerId) => {
    if (!map || !focusedArea || loadingLayersRef.current.has(layerId)) return;
    const cfg = layers?.[layerId];
    if (cfg?.disabled || DISABLED_INFRASTRUCTURE_LAYERS.has(layerId)) return;
    
    if (DEBUG_INFRA) console.log(`Loading ${layerId} for area:`, focusedArea.properties?.name || focusedArea.id);
    
    // Mark as loading
    loadingLayersRef.current.add(layerId);
    
    setLayers(prev => ({
      ...prev,
      [layerId]: { ...prev[layerId], loading: true, error: false }
    }));
    
    try {
      const bounds = calculateGeometryBounds(focusedArea.geometry);
      if (!bounds) throw new Error('Invalid geometry bounds');
      
      const data = await loadInfrastructureData(layerId, bounds);
      
      let filteredFeatures = data.features;
      if (layerId !== 'hydrants' && layerId !== 'busStops') {
        filteredFeatures = filterFeaturesByType(data.features, layerId);
      }
      
      let filteredData = {
        type: 'FeatureCollection',
        features: filteredFeatures,
        crs: data.crs || { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } }
      };

      // Enhanced rendering: annotate features for angle-specific sprite IDs when enabled
      try {
        const cfg = layers[layerId];
        if (cfg?.enhancedRendering?.enabled) {
          // Ensure sprites are loaded for variants
          try {
            const viewType = view?.viewType || getMapViewType(map);
            await addEnhancedSpritesToMap(map, {
              baseName: cfg.enhancedRendering.spriteBase,
              publicDir: `/static/${cfg.enhancedRendering.spriteBase}`,
              angles: cfg.enhancedRendering.angles,
              viewType,
              urlBuilder: buildFlatSpriteUrl
            });
            // Opportunistic prefetch for current view
            try { prefetchView(cfg.enhancedRendering.spriteBase, cfg.enhancedRendering.angles, viewType); } catch(_) {}
          } catch (_) {}

          // For point features, compute a bearing from nearest CSCL centerline when desired
          let lineFeatures = [];
          try {
            if (cfg.enhancedRendering.desiredParallelTo === 'cscl') {
              const expandFactor = 0.0015;
              const expanded = expandBounds(bounds, expandFactor);
              const minLng = expanded[0][0];
              const minLat = expanded[0][1];
              const maxLng = expanded[1][0];
              const maxLat = expanded[1][1];
              const ep = INFRASTRUCTURE_ENDPOINTS.csclCenterlines;
              let csclUrl = '';
              if (ep && ep.baseUrl && ep.geoField) {
                const wktPoly = `POLYGON((
                  ${minLng} ${minLat},
                  ${minLng} ${maxLat},
                  ${maxLng} ${maxLat},
                  ${maxLng} ${minLat},
                  ${minLng} ${minLat}
                ))`.replace(/\s+/g, ' ').trim();
                const where = `intersects(${ep.geoField}, '${wktPoly}')`;
                csclUrl = `${ep.baseUrl}?$where=${encodeURIComponent(where)}&$limit=5000`;
              }
              if (csclUrl) {
                try {
                  const resp = await fetch(csclUrl);
                  if (resp.ok) {
                    const gj = await resp.json();
                    lineFeatures = Array.isArray(gj?.features) ? gj.features : [];
                  }
                } catch (_) {}
              }
            }
          } catch (_) {}

          // Annotate each Point feature with base bearing and initial icon_image property
          filteredData = {
            ...filteredData,
            features: filteredData.features.map((f) => {
              if (!f || f.geometry?.type !== 'Point') return f;
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
                } else {
                  const br = computeNearestLineBearing(f, lineFeatures);
                  if (br != null) { baseBearing = br; baseSource = 'cscl'; }
                }
              }
              if (baseBearing == null) {
                // Fallback: use area orientation (viewport when pitched) and approximate side via centroid heuristic
                try {
                  const areaGeom = focusedArea?.geometry;
                  const pitch = (typeof view?.pitch === 'number') ? view.pitch : (map && typeof map.getPitch === 'function' ? map.getPitch() : 0);
                  const areaAxis = computeAreaOrientation({ map, geometry: areaGeom, pitch });
                  baseBearing = (typeof areaAxis === 'number') ? areaAxis : 0;
                  // centroid heuristic for side
                  const centroid = (() => {
                    try {
                      if (!areaGeom || !areaGeom.type) return null;
                      let ring = null;
                      if (areaGeom.type === 'Polygon') {
                        ring = Array.isArray(areaGeom.coordinates?.[0]) ? areaGeom.coordinates[0] : null;
                      } else if (areaGeom.type === 'MultiPolygon') {
                        ring = Array.isArray(areaGeom.coordinates?.[0]?.[0]) ? areaGeom.coordinates[0][0] : null;
                      }
                      if (!ring || ring.length === 0) return null;
                      let sx = 0, sy = 0;
                      ring.forEach(([x, y]) => { sx += x; sy += y; });
                      const n = ring.length;
                      return [sx / n, sy / n];
                    } catch (_) { return null; }
                  })();
                  if (centroid && Array.isArray(f.geometry?.coordinates)) {
                    const [cx, cy] = centroid;
                    const [px, py] = f.geometry.coordinates;
                    const rad = (Number(baseBearing) * Math.PI) / 180;
                    const dx = Math.sin(rad) * 1e-4; // small step in lon
                    const dy = Math.cos(rad) * 1e-4; // small step in lat
                    const ax = cx, ay = cy;
                    const bx = cx + dx, by = cy + dy;
                    const abx = bx - ax, aby = by - ay;
                    const apx = px - ax, apy = py - ay;
                    const crossZ = abx * apy - aby * apx;
                    side = crossZ > 0 ? 'left' : 'right';
                  }
                  baseSource = 'area';
                } catch (_) {
                  // final fallback
                  baseBearing = 0;
                  baseSource = 'fallback';
                }
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
              return { ...f, properties: { ...p, icon_image: img, icon_sprite_base: cfg.enhancedRendering.spriteBase, icon_base_bearing: baseBearing, icon_side: side, icon_base_bearing_source: baseSource } };
            })
          };
        }
      } catch (e) {
        console.warn('[enhancedRendering] failed to annotate features:', e);
      }
      
      if (DEBUG_INFRA) console.log(`Loaded ${layerId}: ${filteredData.features.length} features found for area ${focusedArea.properties?.name || focusedArea.id}`);
      if (layerId === 'dcwpParkingGarages') {
        if (DEBUG_INFRA) console.log('[dcwp] sample feature geoms:', filteredData.features.slice(0, 2).map(f => f.geometry?.type));
      }
      
      // Save the data
      setInfrastructureData(prev => ({
        ...prev,
        [layerId]: filteredData
      }));
      
      // Add to map
      addInfrastructureLayerToMap(layerId, filteredData);
      
      // Clear loading state and mark as successful; if empty, treat as hidden and flag empty
      const isEmpty = !filteredData?.features || filteredData.features.length === 0;
      setLayers(prev => ({
        ...prev,
        [layerId]: { 
          ...prev[layerId], 
          loading: false, 
          error: false,
          loaded: true,
          visible: isEmpty ? false : true,
          empty: isEmpty
        }
      }));
      
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

  // Toggle infrastructure layer visibility - use useCallback
  const toggleInfrastructureLayerVisibility = useCallback((layerId, visible) => {
    if (!map) return;
    
    const pointLayerId = `layer-${layerId}-point`;
    const lineLayerId = `layer-${layerId}-line`;
    const polygonLayerId = `layer-${layerId}-polygon`;
    
    try {
      // Toggle point layer
      if (map.getLayer(pointLayerId)) {
        map.setLayoutProperty(
          pointLayerId,
          'visibility',
          visible ? 'visible' : 'none'
        );
      }
      // Toggle line layer
      if (map.getLayer(lineLayerId)) {
        map.setLayoutProperty(
          lineLayerId,
          'visibility',
          visible ? 'visible' : 'none'
        );
      }
      // Toggle polygon layer
      if (map.getLayer(polygonLayerId)) {
        map.setLayoutProperty(
          polygonLayerId,
          'visibility',
          visible ? 'visible' : 'none'
        );
      }
    } catch (error) {
      console.error(`Error toggling ${layerId} visibility:`, error);
    }
  }, [map]);

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
      const currentConfig = prev[layerId];
      const willBeVisible = !currentConfig.visible;
      
      if (willBeVisible) {
        // If turning on, load the data for this area
        loadInfrastructureLayer(layerId);
      } else {
        // If turning off, hide the layer
        toggleInfrastructureLayerVisibility(layerId, false);
      }
      
      return {
        ...prev,
        [layerId]: { 
          ...prev[layerId], 
          visible: willBeVisible,
          // Reset loaded state if turning on so it loads fresh data
          loaded: willBeVisible ? false : prev[layerId].loaded
        }
      };
    });
  }, [focusedArea, loadInfrastructureLayer, toggleInfrastructureLayerVisibility, setLayers]);

  // Reload any currently visible layers (useful after style changes)
  const reloadVisibleLayers = useCallback(() => {
    if (!map || !focusedArea) return;
    const run = () => {
      Object.entries(layers).forEach(([layerId, config]) => {
        if (layerId !== 'permitAreas' && !config?.disabled && !DISABLED_INFRASTRUCTURE_LAYERS.has(layerId) && config.visible && !loadingLayersRef.current.has(layerId)) {
          loadInfrastructureLayer(layerId);
        }
      });
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
  }, [map, focusedArea, layers, loadInfrastructureLayer]);

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
        Object.entries(layers || {}).forEach(([layerId, cfg]) => {
          if (layerId === 'permitAreas') return;
          if (cfg?.disabled || DISABLED_INFRASTRUCTURE_LAYERS.has(layerId)) return;

          // If marked visible by state but not yet loaded/loading, fetch now
          if (cfg?.visible && !cfg?.loaded && !cfg?.loading && !loadingLayersRef.current.has(layerId)) {
            loadInfrastructureLayer(layerId);
            return;
          }

          // If already loaded and should be visible, ensure layer visibility in style
          if (cfg?.visible && cfg?.loaded) {
            try { toggleInfrastructureLayerVisibility(layerId, true); } catch (_) {}
          }
        });
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

      // Clear focus and all infrastructure - ensure state is properly reset
  const clearFocus = useCallback(() => {
    if (map) {
      try {
        Object.keys(layers || {}).forEach((layerId) => {
          if (layerId !== 'permitAreas') removeInfrastructureLayer(layerId);
        });
      } catch (_) {}
    }

    // Reset all infrastructure layer states
    setLayers(prev => {
      const newLayers = { ...prev };
      Object.keys(newLayers).forEach(layerId => {
        if (layerId !== 'permitAreas') {
          newLayers[layerId] = {
            ...newLayers[layerId],
            visible: false,
            loaded: false,
            loading: false,
            error: null
          };
        }
      });
      return newLayers;
    });

    // Clear data
    setInfrastructureData({});

    loadingLayersRef.current.clear();
  }, [map, layers, removeInfrastructureLayer, setLayers]);

  return {
    infrastructureData,
    toggleLayer,
    clearFocus,
    reloadVisibleLayers
  };
};