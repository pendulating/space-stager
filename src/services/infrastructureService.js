// services/infrastructureService.js
import { INFRASTRUCTURE_ENDPOINTS } from '../constants/endpoints';
import { expandBounds } from '../utils/geometryUtils';

export const loadInfrastructureData = async (layerId, bounds) => {
  const endpoint = INFRASTRUCTURE_ENDPOINTS[layerId];
  if (!endpoint) throw new Error(`Unknown layer: ${layerId}`);
  
  let url;
  
  if (endpoint.isLocal) {
    url = endpoint.baseUrl;
  } else {
    // Expand bounds slightly
    const expanded = expandBounds(bounds);
    const minLng = expanded[0][0];
    const minLat = expanded[0][1];
    const maxLng = expanded[1][0];
    const maxLat = expanded[1][1];
    
    // Build URL with bbox filter
    const bboxFilter = `$where=within_box(${endpoint.geoField}, ${minLat}, ${minLng}, ${maxLat}, ${maxLng})`;
    url = `${endpoint.baseUrl}?${bboxFilter}&$limit=5000`;
  }
  
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
  }
  
  const data = await response.json();
  
  // For local files, filter by bounds manually
  if (endpoint.isLocal && bounds) {
    data.features = data.features.filter(feature => {
      if (!feature.geometry || feature.geometry.type !== 'Point') return false;
      
      const [lng, lat] = feature.geometry.coordinates;
      return lng >= bounds[0][0] && lng <= bounds[1][0] && 
             lat >= bounds[0][1] && lat <= bounds[1][1];
    });
  }
  
  return data;
};

export const filterFeaturesByType = (features, layerId) => {
  if (!features || !Array.isArray(features)) return [];
  
  return features.filter(feature => {
    if (!feature || !feature.properties) return false;
    
    const props = feature.properties || {};
    
    switch(layerId) {
      case 'trees':
        return props.genusspecies || 
              props.tpstructure || 
              (props.dbh && Number(props.dbh) > 0) ||
              Object.values(props).some(val => 
                typeof val === 'string' && val.toLowerCase().includes('tree')
              );
      
      case 'hydrants':
        return true; // All hydrant features are valid
        
      case 'parking':
        return Object.values(props).some(val => 
          typeof val === 'string' && (
            val.toLowerCase().includes('meter') ||
            val.toLowerCase().includes('parking')
          )
        );
        
      case 'benches':
        return Object.values(props).some(val => 
          typeof val === 'string' && val.toLowerCase().includes('bench')
        );
        
      case 'streetlights':
        return Object.values(props).some(val => 
          typeof val === 'string' && (
            val.toLowerCase().includes('light') ||
            val.toLowerCase().includes('lamp')
          )
        );
        
      case 'busStops':
        return true; // All bus stop features are valid
        
      default:
        return false;
    }
  }).map(feature => ({
    type: 'Feature',
    geometry: feature.geometry || { type: 'Point', coordinates: [0, 0] },
    properties: feature.properties || {}
  }));
};

export const getLayerStyle = (layerId, layerConfig) => {
  const baseColor = layerConfig.color;
  
  switch(layerId) {
    case 'hydrants':
      return {
        type: 'circle',
        paint: {
          'circle-radius': 5,
          'circle-color': baseColor,
          'circle-opacity': 0.9,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'white'
        }
      };
    case 'trees':
      return {
        type: 'circle',
        paint: {
          'circle-radius': 4,
          'circle-color': baseColor,
          'circle-opacity': 0.8,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'white'
        }
      };
    case 'busStops':
      return {
        type: 'circle',
        paint: {
          'circle-radius': 6,
          'circle-color': baseColor,
          'circle-opacity': 0.9,
          'circle-stroke-width': 2,
          'circle-stroke-color': 'white'
        }
      };
    default:
      return {
        type: 'circle',
        paint: {
          'circle-radius': 4,
          'circle-color': baseColor,
          'circle-opacity': 0.8,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'white'
        }
      };
  }
};  