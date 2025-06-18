// services/permitAreaService.js
import { MAP_CONFIG } from '../constants/mapConfig';

export const loadPermitAreas = async (map) => {
  const MAX_RETRIES = 5;
  const RETRY_DELAYS = [500, 1000, 2000, 4000, 8000]; // ms

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Validate map instance
      if (!map || typeof map.addSource !== 'function') {
        throw new Error('Invalid map instance provided');
      }
      // Check if map is ready
      if (!map.getStyle()) {
        throw new Error('Map style not loaded');
      }
      // Wait for map to be fully loaded
      if (!map.loaded()) {
        console.log('PermitAreas service: Map not fully loaded, waiting...');
        await new Promise((resolve) => {
          const checkLoaded = () => {
            if (map.loaded()) {
              resolve();
            } else {
              setTimeout(checkLoaded, 50);
            }
          };
          checkLoaded();
        });
      }
      // Clean up any existing source/layers
      if (map.getSource('permit-areas')) {
        console.log('PermitAreas service: Source already exists, removing first');
        if (map.getLayer('permit-areas-focused-outline')) map.removeLayer('permit-areas-focused-outline');
        if (map.getLayer('permit-areas-focused-fill')) map.removeLayer('permit-areas-focused-fill');
        if (map.getLayer('permit-areas-outline')) map.removeLayer('permit-areas-outline');
        if (map.getLayer('permit-areas-fill')) map.removeLayer('permit-areas-fill');
        map.removeSource('permit-areas');
      }
      // Fetch data
      console.log(`PermitAreas service: Fetching data from ${MAP_CONFIG.permitAreaSource} (attempt ${attempt})`);
      const response = await fetch(MAP_CONFIG.permitAreaSource);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      if (!data.features || !Array.isArray(data.features)) {
        throw new Error('Invalid GeoJSON data structure');
      }
      // Add source
      map.addSource('permit-areas', {
        type: 'geojson',
        data: data
      });
      // Wait for source to be fully loaded (sourcedata event)
      await new Promise((resolve, reject) => {
        let timeout = setTimeout(() => {
          reject(new Error('Timed out waiting for permit-areas source to load'));
        }, 10000);
        function onSourceData(e) {
          if (
            e.sourceId === 'permit-areas' &&
            map.isSourceLoaded &&
            map.isSourceLoaded('permit-areas')
          ) {
            map.off('sourcedata', onSourceData);
            clearTimeout(timeout);
            resolve();
          }
        }
        map.on('sourcedata', onSourceData);
      });
      // Get the first symbol layer ID
      const layers = map.getStyle().layers;
      let firstSymbolId;
      for (let i = 0; i < layers.length; i++) {
        if (layers[i].type === 'symbol') {
          firstSymbolId = layers[i].id;
          break;
        }
      }
      // Add layers
      map.addLayer({
        id: 'permit-areas-fill',
        type: 'fill',
        source: 'permit-areas',
        layout: { 'visibility': 'visible' },
        paint: { 'fill-color': '#f97316', 'fill-opacity': 0.2 }
      }, firstSymbolId);
      map.addLayer({
        id: 'permit-areas-outline',
        type: 'line',
        source: 'permit-areas',
        layout: { 'visibility': 'visible' },
        paint: { 'line-color': '#f97316', 'line-width': 1 }
      }, firstSymbolId);
      map.addLayer({
        id: 'permit-areas-focused-fill',
        type: 'fill',
        source: 'permit-areas',
        filter: ['==', 'id', ''],
        layout: { 'visibility': 'visible' },
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.3 }
      }, firstSymbolId);
      map.addLayer({
        id: 'permit-areas-focused-outline',
        type: 'line',
        source: 'permit-areas',
        filter: ['==', 'id', ''],
        layout: { 'visibility': 'visible' },
        paint: { 'line-color': '#3b82f6', 'line-width': 3, 'line-dasharray': [2, 2], 'line-opacity': 1 }
      }, firstSymbolId);
      // Wait for map to be idle (all rendering/data complete)
      await new Promise((resolve, reject) => {
        let timeout = setTimeout(() => {
          reject(new Error('Timed out waiting for map to become idle after adding layers'));
        }, 10000);
        function onIdle() {
          map.off('idle', onIdle);
          clearTimeout(timeout);
          resolve();
        }
        map.on('idle', onIdle);
      });
      // --- Robust rendering workarounds ---
      // Short delay before final rendering steps
      await new Promise(resolve => setTimeout(resolve, 150));
      // 1. Force a resize and repaint
      if (map.resize) map.resize();
      if (map.triggerRepaint) map.triggerRepaint();
      // 3. Listen for one 'render' event and trigger another repaint
      await new Promise(resolve => {
        let didRender = false;
        function onRender() {
          if (!didRender) {
            didRender = true;
            map.off('render', onRender);
            if (map.triggerRepaint) map.triggerRepaint();
            resolve();
          }
        }
        map.on('render', onRender);
        // Fallback: resolve after 200ms if 'render' doesn't fire
        setTimeout(() => {
          if (!didRender) {
            map.off('render', onRender);
            resolve();
          }
        }, 200);
      });
      // --- End robust rendering workarounds ---
      // Verify all layers were created
      const requiredLayers = ['permit-areas-fill', 'permit-areas-outline', 'permit-areas-focused-fill', 'permit-areas-focused-outline'];
      for (const layerId of requiredLayers) {
        if (!map.getLayer(layerId)) {
          throw new Error(`Failed to create layer: ${layerId}`);
        }
      }
      // Wait and verify layers are visible
      await new Promise(resolve => setTimeout(resolve, 100));
      for (const layerId of requiredLayers) {
        const layer = map.getLayer(layerId);
        if (!layer) {
          throw new Error(`Layer disappeared after creation: ${layerId}`);
        }
        const visibility = map.getLayoutProperty(layerId, 'visibility');
        if (visibility !== 'visible') {
          map.setLayoutProperty(layerId, 'visibility', 'visible');
        }
      }
      // Final check after a short delay
      await new Promise(resolve => setTimeout(resolve, 100));
      for (const layerId of requiredLayers) {
        if (!map.getLayer(layerId)) {
          throw new Error(`Layer missing after final check: ${layerId}`);
        }
      }
      console.log('PermitAreas service: All layers created and verified successfully');
      return data.features || [];
    } catch (error) {
      lastError = error;
      console.error(`PermitAreas service: Error on attempt ${attempt}:`, error);
      // Clean up before retrying
      if (map.getLayer('permit-areas-focused-outline')) map.removeLayer('permit-areas-focused-outline');
      if (map.getLayer('permit-areas-focused-fill')) map.removeLayer('permit-areas-focused-fill');
      if (map.getLayer('permit-areas-outline')) map.removeLayer('permit-areas-outline');
      if (map.getLayer('permit-areas-fill')) map.removeLayer('permit-areas-fill');
      if (map.getSource('permit-areas')) map.removeSource('permit-areas');
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt - 1] || 8000;
        console.warn(`PermitAreas service: Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  // If we get here, all retries failed
  throw lastError || new Error('Failed to load permit areas after multiple attempts');
};

export const searchPermitAreas = (permitAreas, searchQuery) => {
  const query = searchQuery.toLowerCase().trim();
  
  return permitAreas
    .filter(area => {
      const name = (area.properties.name || '').toLowerCase();
      const propertyName = (area.properties.propertyname || '').toLowerCase();
      const subPropertyName = (area.properties.subpropertyname || '').toLowerCase();
      
      return name.includes(query) || 
             propertyName.includes(query) || 
             subPropertyName.includes(query);
    })
    .slice(0, 10); // Limit to 10 results
};

export const highlightOverlappingAreas = (map, features) => {
  if (!map) return;
  
  // Extract feature IDs
  const featureIds = features.map(f => {
    return f.id || f.properties.id || f.properties.OBJECTID || f.properties.fid;
  }).filter(id => id !== undefined && id !== null);
  
  // Remove existing overlap highlight layer
  if (map.getLayer('permit-areas-overlap-highlight')) {
    map.removeLayer('permit-areas-overlap-highlight');
  }
  
  if (featureIds.length === 0) return;
  
  try {
    // Add highlight layer for overlapping areas
    map.addLayer({
      id: 'permit-areas-overlap-highlight',
      type: 'line',
      source: 'permit-areas',
      filter: ['in', ['get', 'id'], ['literal', featureIds]],
      paint: {
        'line-color': '#ff6b35',
        'line-width': 3,
        'line-dasharray': [1, 1],
        'line-opacity': 0.8
      }
    });
  } catch (error) {
    console.error('Error adding overlap highlight layer:', error);
  }
};

export const clearOverlapHighlights = (map) => {
  if (!map) return;
  
  if (map.getLayer('permit-areas-overlap-highlight')) {
    map.removeLayer('permit-areas-overlap-highlight');
  }
};