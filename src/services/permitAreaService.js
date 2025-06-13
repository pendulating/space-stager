// services/permitAreaService.js
import { MAP_CONFIG } from '../constants/mapConfig';

export const loadPermitAreas = async (map) => {
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
    
    // Check if source already exists
    if (map.getSource('permit-areas')) {
      console.log('PermitAreas service: Source already exists, removing first');
      // Clean up existing layers and source
      if (map.getLayer('permit-areas-focused-outline')) map.removeLayer('permit-areas-focused-outline');
      if (map.getLayer('permit-areas-focused-fill')) map.removeLayer('permit-areas-focused-fill');
      if (map.getLayer('permit-areas-outline')) map.removeLayer('permit-areas-outline');
      if (map.getLayer('permit-areas-fill')) map.removeLayer('permit-areas-fill');
      map.removeSource('permit-areas');
    }
    
    console.log('PermitAreas service: Fetching data from', MAP_CONFIG.permitAreaSource);
    const response = await fetch(MAP_CONFIG.permitAreaSource);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.features || !Array.isArray(data.features)) {
      throw new Error('Invalid GeoJSON data structure');
    }
    
    console.log(`PermitAreas service: Adding source with ${data.features.length} features`);
    
    // Add source to map
    map.addSource('permit-areas', {
      type: 'geojson',
      data: data
    });
    
    // Get the first symbol layer ID to insert our layers before it
    const layers = map.getStyle().layers;
    let firstSymbolId;
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].type === 'symbol') {
        firstSymbolId = layers[i].id;
        break;
      }
    }
    
    console.log('PermitAreas service: Adding layers, first symbol layer:', firstSymbolId);
    
    // Add layers in order, inserting before symbol layers
    map.addLayer({
      id: 'permit-areas-fill',
      type: 'fill',
      source: 'permit-areas',
      layout: {
        'visibility': 'visible'
      },
      paint: {
        'fill-color': '#f97316',
        'fill-opacity': 0.2
      }
    }, firstSymbolId);
    
    map.addLayer({
      id: 'permit-areas-outline',
      type: 'line',
      source: 'permit-areas',
      layout: {
        'visibility': 'visible'
      },
      paint: {
        'line-color': '#f97316',
        'line-width': 1
      }
    }, firstSymbolId);
    
    map.addLayer({
      id: 'permit-areas-focused-fill',
      type: 'fill',
      source: 'permit-areas',
      filter: ['==', 'id', ''],
      layout: {
        'visibility': 'visible'
      },
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': 0.3
      }
    }, firstSymbolId);
    
    map.addLayer({
      id: 'permit-areas-focused-outline',
      type: 'line',
      source: 'permit-areas',
      filter: ['==', 'id', ''],
      layout: {
        'visibility': 'visible'
      },
      paint: {
        'line-color': '#3b82f6',
        'line-width': 3,
        'line-dasharray': [1, 1]
      }
    }, firstSymbolId);
    
    // Verify all layers were created
    const requiredLayers = ['permit-areas-fill', 'permit-areas-outline', 'permit-areas-focused-fill', 'permit-areas-focused-outline'];
    for (const layerId of requiredLayers) {
      if (!map.getLayer(layerId)) {
        throw new Error(`Failed to create layer: ${layerId}`);
      }
    }
    
    // Wait a moment and verify layers are still there and visible
    await new Promise(resolve => setTimeout(resolve, 100));
    
    for (const layerId of requiredLayers) {
      const layer = map.getLayer(layerId);
      if (!layer) {
        throw new Error(`Layer disappeared after creation: ${layerId}`);
      }
      
      const visibility = map.getLayoutProperty(layerId, 'visibility');
      console.log(`PermitAreas service: Layer ${layerId} visibility:`, visibility);
      
      // Force visibility if it's not set correctly
      if (visibility !== 'visible') {
        console.log(`PermitAreas service: Forcing visibility for layer ${layerId}`);
        map.setLayoutProperty(layerId, 'visibility', 'visible');
      }
    }
    
    // Force multiple repaints with delays to ensure rendering
    map.triggerRepaint();
    
    // Additional checks after a longer delay
    setTimeout(() => {
      console.log('PermitAreas service: Final verification check');
      
      // Force another repaint
      map.triggerRepaint();
      
      // Check if layers are still visible
      for (const layerId of requiredLayers) {
        const visibility = map.getLayoutProperty(layerId, 'visibility');
        if (visibility !== 'visible') {
          console.warn(`PermitAreas service: Layer ${layerId} lost visibility, restoring`);
          map.setLayoutProperty(layerId, 'visibility', 'visible');
        }
      }
      
      // One more repaint for good measure
      setTimeout(() => map.triggerRepaint(), 100);
      
    }, 300);
    
    console.log('PermitAreas service: All layers created and verified successfully');
    
    // Return features for search functionality
    return data.features || [];
    
  } catch (error) {
    console.error('PermitAreas service: Error loading permit areas:', error);
    throw error;
  }
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