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
      // Pre-initialize source and layers with empty data to avoid flicker and event races
      const styleLayers = map.getStyle().layers;
      let firstSymbolId;
      for (let i = 0; i < styleLayers.length; i++) {
        if (styleLayers[i].type === 'symbol') {
          firstSymbolId = styleLayers[i].id;
          break;
        }
      }
      if (!map.getSource('permit-areas')) {
        map.addSource('permit-areas', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }
      if (!map.getLayer('permit-areas-fill')) {
        map.addLayer({
          id: 'permit-areas-fill',
          type: 'fill',
          source: 'permit-areas',
          layout: { 'visibility': 'visible' },
          paint: { 'fill-color': '#f97316', 'fill-opacity': 0.2 }
        }, firstSymbolId);
      }
      if (!map.getLayer('permit-areas-outline')) {
        map.addLayer({
          id: 'permit-areas-outline',
          type: 'line',
          source: 'permit-areas',
          layout: { 'visibility': 'visible' },
          paint: { 'line-color': '#f97316', 'line-width': 1 }
        }, firstSymbolId);
      }
      if (!map.getLayer('permit-areas-focused-fill')) {
        map.addLayer({
          id: 'permit-areas-focused-fill',
          type: 'fill',
          source: 'permit-areas',
          filter: ['==', ['get', 'system'], ''],
          layout: { 'visibility': 'visible' },
          paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.3 }
        }, firstSymbolId);
      }
      if (!map.getLayer('permit-areas-focused-outline')) {
        map.addLayer({
          id: 'permit-areas-focused-outline',
          type: 'line',
          source: 'permit-areas',
          filter: ['==', ['get', 'system'], ''],
          layout: { 'visibility': 'visible' },
          paint: { 'line-color': '#3b82f6', 'line-width': 3, 'line-dasharray': [2, 2], 'line-opacity': 1 }
        }, firstSymbolId);
      }

      // Fetch data (always fetch to refresh search/index) with cache bypass
      // Build a cache-busting URL and force a network fetch to avoid flaky cached responses
      const buildUrl = (extraParam) => {
        try {
          const u = new URL(MAP_CONFIG.permitAreaSource, window.location.origin);
          u.searchParams.set('_ts', String(Date.now()));
          if (extraParam) u.searchParams.set('_rnd', String(extraParam));
          return u.toString();
        } catch (_) {
          // Fallback for non-browser environments
          return `${MAP_CONFIG.permitAreaSource}?_ts=${Date.now()}${extraParam ? `&_rnd=${extraParam}` : ''}`;
        }
      };

      async function fetchWithCacheBypass() {
        const primaryUrl = buildUrl();
        console.log(`PermitAreas service: Fetching data from ${primaryUrl} (attempt ${attempt})`);
        let response = await fetch(primaryUrl, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, max-age=0',
            Pragma: 'no-cache'
          }
        });
        if (!response.ok || response.status === 304) {
          const fallbackUrl = buildUrl(Math.random());
          console.warn(`PermitAreas service: Primary fetch not ok (status ${response.status}). Retrying with ${fallbackUrl}`);
          response = await fetch(fallbackUrl, { cache: 'reload' });
        }
        return response;
      }

      const response = await fetchWithCacheBypass();
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      if (!data.features || !Array.isArray(data.features)) {
        throw new Error('Invalid GeoJSON data structure');
      }
      // Update source data and poll for readiness to avoid missing events
      const src = map.getSource('permit-areas');
      if (src && src.setData) {
        src.setData(data);
      }
      await new Promise((resolve, reject) => {
        const start = Date.now();
        const timeoutMs = 10000;
        const check = () => {
          try {
            if (map.isSourceLoaded && map.isSourceLoaded('permit-areas')) {
              resolve();
              return;
            }
          } catch (_) {}
          if (Date.now() - start > timeoutMs) {
            reject(new Error('Timed out waiting for permit-areas source to load'));
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });
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
      // Optional short delay to allow rendering to catch up
      await new Promise(resolve => setTimeout(resolve, 50));
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
      // Avoid destructive cleanup to reduce flicker; layers will be corrected on next attempt
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