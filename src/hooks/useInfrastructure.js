// hooks/useInfrastructure.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  loadInfrastructureData, 
  filterFeaturesByType,
  getLayerStyle 
} from '../services/infrastructureService';
import { calculateGeometryBounds } from '../utils/geometryUtils';
import { createInfrastructureTooltipContent } from '../utils/tooltipUtils';
import { addIconsToMap, retryLoadIcons } from '../utils/iconUtils';

export const useInfrastructure = (map, focusedArea, layers, setLayers) => {
  console.log('[DEBUG] useInfrastructure hook called with map:', !!map);
  
  const [infrastructureData, setInfrastructureData] = useState({
    trees: null,
    hydrants: null,
    busStops: null,
    benches: null,
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

  // Get the focused area ID for comparison
  const focusedAreaId = focusedArea?.id || focusedArea?.properties?.id;

  // Debug: Track map changes
  useEffect(() => {
    console.log('[DEBUG] Map changed:', !!map, 'map.isStyleLoaded():', map?.isStyleLoaded());
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
        if (layerId !== 'permitAreas' && config.visible && !loadingLayersRef.current.has(layerId)) {
          loadInfrastructureLayer(layerId);
        }
      });
    } else {
      // Clear everything when focus is removed
      if (map) {
        ['trees', 'hydrants', 'busStops', 'benches', 'bikeLanes', 'bikeParking', 'citibikeStations', 'subwayEntrances', 'fireLanes', 'specialDisasterRoutes', 'pedestrianRamps', 'parkingMeters', 'linknycKiosks', 'publicRestrooms', 'drinkingFountains', 'sprayShowers', 'parksTrails', 'parkingLots', 'iceLadders', 'parksSigns'].forEach(layerId => {
          removeInfrastructureLayer(layerId);
        });
      }
      
      setInfrastructureData({
        trees: null,
        hydrants: null,
        busStops: null,
        benches: null,
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
      
      setLayers(prev => ({
        ...prev,
        bikeLanes: { ...prev.bikeLanes, visible: false, loading: false },
        bikeParking: { ...prev.bikeParking, visible: false, loading: false },
        pedestrianRamps: { ...prev.pedestrianRamps, visible: false, loading: false },
        parkingMeters: { ...prev.parkingMeters, visible: false, loading: false },
        linknycKiosks: { ...prev.linknycKiosks, visible: false, loading: false },
        publicRestrooms: { ...prev.publicRestrooms, visible: false, loading: false },
        drinkingFountains: { ...prev.drinkingFountains, visible: false, loading: false },
        sprayShowers: { ...prev.sprayShowers, visible: false, loading: false },
        parksTrails: { ...prev.parksTrails, visible: false, loading: false },
        parkingLots: { ...prev.parkingLots, visible: false, loading: false },
        iceLadders: { ...prev.iceLadders, visible: false, loading: false },
        parksSigns: { ...prev.parksSigns, visible: false, loading: false },
        trees: { ...prev.trees, visible: false, loading: false },
        hydrants: { ...prev.hydrants, visible: false, loading: false },
        busStops: { ...prev.busStops, visible: false, loading: false },
        benches: { ...prev.benches, visible: false, loading: false }
      }));
      
      loadingLayersRef.current.clear();
    }
  }, [focusedAreaId]); // Only depend on the ID

  // Clear existing layers when focused area changes
  useEffect(() => {
    if (!map) return;

    // When focused area changes, clear all infrastructure layers and reset their state
    Object.keys(layers).forEach(layerId => {
      if (layerId !== 'permitAreas') {
        // Clear the layer from the map
        clearLayer(layerId);
        
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
  }, [focusedAreaId, map]); // Trigger when focused area ID changes

  // Load infrastructure icons when map is ready - more permissive (load whatever is possible)
  useEffect(() => {
    if (!map) return;
    const ensureIcons = () => {
      if (map.isStyleLoaded()) {
        addIconsToMap(map);
      } else {
        map.once('style.load', () => setTimeout(() => addIconsToMap(map), 100));
      }
    };
    const t = setTimeout(ensureIcons, 100);
    return () => clearTimeout(t);
  }, [map]);

  // Add infrastructure layer to map - move this before loadInfrastructureLayer
  const addInfrastructureLayerToMap = useCallback((layerId, data) => {
    if (!map) return;
    console.log(`[DEBUG] Adding ${layerId} layer to map with ${data.features.length} features`);
    
    removeInfrastructureLayer(layerId);
    const sourceId = `source-${layerId}`;
    
    // Add source
    map.addSource(sourceId, {
      type: 'geojson',
      data: data
    });
    
    const layerStyle = getLayerStyle(layerId, layers[layerId], map);
    console.log(`[DEBUG] Layer style for ${layerId}:`, layerStyle);
    
    // Check for different geometry types
    const hasLineString = data.features.some(f => f.geometry && (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString'));
    const hasPoint = data.features.some(f => f.geometry && f.geometry.type === 'Point');
    const hasPolygon = data.features.some(f => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'));
    
    console.log(`[DEBUG] ${layerId} has LineString: ${hasLineString}, has Point: ${hasPoint}, has Polygon: ${hasPolygon}`);
    console.log(`[DEBUG] ${layerId} sample features:`, data.features.slice(0, 2).map(f => ({
      hasGeometry: !!f.geometry,
      geometryType: f.geometry?.type,
      hasCoordinates: !!f.geometry?.coordinates
    })));
    
    if (hasLineString && layerStyle.type === 'line') {
      const lineLayerId = `layer-${layerId}-line`;
      map.addLayer({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        paint: layerStyle.paint
      });
      console.log(`[DEBUG] Added line layer: ${lineLayerId}`);
      // Optionally add hover/click events for lines here
    }
    
    if (hasPolygon && layerStyle.type === 'fill') {
      const polygonLayerId = `layer-${layerId}-polygon`;
      map.addLayer({
        id: polygonLayerId,
        type: 'fill',
        source: sourceId,
        paint: layerStyle.paint
      });
      console.log(`[DEBUG] Added polygon layer: ${polygonLayerId}`);
      
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
        console.log('Infrastructure feature clicked:', content);
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
      
      console.log(`[DEBUG] Adding point layer: ${pointLayerId} with config:`, layerConfig);
      
      map.addLayer(layerConfig);
      
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
        console.log('Infrastructure feature clicked:', content);
      });
      
      console.log(`[DEBUG] Successfully added point layer: ${pointLayerId}`);
    }
  }, [map, layers]);

  // Remove infrastructure layer - move this before addInfrastructureLayerToMap
  const removeInfrastructureLayer = useCallback((layerId) => {
    if (!map) return;
    
    // Check if map has a style loaded before trying to access layers
    try {
      if (!map.getStyle()) {
        console.log(`Infrastructure: Map style not loaded, skipping remove for ${layerId}`);
        return;
      }
    } catch (error) {
      console.log(`Infrastructure: Error checking map style, skipping remove for ${layerId}:`, error);
      return;
    }
    
    // Remove all possible layer IDs
    const pointLayerId = `layer-${layerId}-point`;
    const lineLayerId = `layer-${layerId}-line`;
    const polygonLayerId = `layer-${layerId}-polygon`;
    const altLayerId = `${layerId}-layer`;
    const sourceId = layerId;
    const altSourceId = `source-${layerId}`;
    try {
      if (map.getLayer(pointLayerId)) {
        map.off('mouseenter', pointLayerId);
        map.off('mouseleave', pointLayerId);
        map.off('click', pointLayerId);
        map.removeLayer(pointLayerId);
      }
      if (map.getLayer(lineLayerId)) {
        map.removeLayer(lineLayerId);
      }
      if (map.getLayer(polygonLayerId)) {
        map.off('mouseenter', polygonLayerId);
        map.off('mouseleave', polygonLayerId);
        map.off('click', polygonLayerId);
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

  // Load infrastructure layer - now addInfrastructureLayerToMap is defined
  const loadInfrastructureLayer = useCallback(async (layerId) => {
    if (!map || !focusedArea || loadingLayersRef.current.has(layerId)) return;
    
    console.log(`Loading ${layerId} for area:`, focusedArea.properties?.name || focusedArea.id);
    
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
      
      const filteredData = {
        type: 'FeatureCollection',
        features: filteredFeatures,
        crs: data.crs || { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } }
      };
      
      console.log(`Loaded ${layerId}: ${filteredData.features.length} features found for area ${focusedArea.properties?.name || focusedArea.id}`);
      
      // Save the data
      setInfrastructureData(prev => ({
        ...prev,
        [layerId]: filteredData
      }));
      
      // Add to map
      addInfrastructureLayerToMap(layerId, filteredData);
      
      // Clear loading state and mark as successful
      setLayers(prev => ({
        ...prev,
        [layerId]: { 
          ...prev[layerId], 
          loading: false, 
          error: false,
          loaded: true,
          visible: true
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
          loaded: false
        }
      }));
    } finally {
      loadingLayersRef.current.delete(layerId);
    }
  }, [map, focusedArea, addInfrastructureLayerToMap, setLayers]);

  // Clear layer - use useCallback
  const clearLayer = useCallback((layerId) => {
    if (!map) return;
    
    // Check if map has a style loaded before trying to access layers
    try {
      if (!map.getStyle()) {
        console.log(`Infrastructure: Map style not loaded, skipping clear for ${layerId}`);
        return;
      }
    } catch (error) {
      console.log(`Infrastructure: Error checking map style, skipping clear for ${layerId}:`, error);
      return;
    }
    
    const config = layers[layerId];
    if (!config) return;
    
    // Remove both possible layer IDs
    try {
      if (map.getLayer(`${layerId}-layer`)) {
        map.removeLayer(`${layerId}-layer`);
      }
      if (map.getLayer(`layer-${layerId}-point`)) {
        map.removeLayer(`layer-${layerId}-point`);
      }
      if (map.getSource(layerId)) {
        map.removeSource(layerId);
      }
      if (map.getSource(`source-${layerId}`)) {
        map.removeSource(`source-${layerId}`);
      }
      console.log(`Infrastructure: Cleared layer ${layerId}`);
    } catch (error) {
      console.log(`Infrastructure: Error clearing layer ${layerId}:`, error);
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

      console.log(`Infrastructure: Loaded layer ${layerId} for area ${focusedArea.id}`);

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
      console.warn('Permit areas should be handled by EventStager, not infrastructure hook');
      return;
    }

    // Only allow toggling infrastructure layers if an area is focused
    if (!focusedArea) {
      console.log('Please focus on a permit area first to enable infrastructure layers');
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
    Object.entries(layers).forEach(([layerId, config]) => {
      if (layerId !== 'permitAreas' && config.visible && !loadingLayersRef.current.has(layerId)) {
        loadInfrastructureLayer(layerId);
      }
    });
  }, [map, focusedArea, layers, loadInfrastructureLayer]);

      // Clear focus and all infrastructure - ensure state is properly reset
  const clearFocus = useCallback(() => {
    if (map) {
      ['trees', 'hydrants', 'busStops', 'benches', 'bikeLanes', 'bikeParking', 'citibikeStations', 'subwayEntrances', 'fireLanes', 'specialDisasterRoutes', 'pedestrianRamps', 'parkingMeters', 'linknycKiosks', 'publicRestrooms', 'drinkingFountains', 'sprayShowers', 'parksTrails', 'parkingLots', 'iceLadders', 'parksSigns'].forEach(layerId => {
        removeInfrastructureLayer(layerId);
      });
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
    setInfrastructureData({
      trees: null,
      hydrants: null,
      busStops: null,
      benches: null,
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

    loadingLayersRef.current.clear();
  }, [map, removeInfrastructureLayer, setLayers]);

  return {
    infrastructureData,
    toggleLayer,
    clearFocus,
    reloadVisibleLayers
  };
};