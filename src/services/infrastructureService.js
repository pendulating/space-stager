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
    // Use a larger buffer for bikeLanes
    const expandFactor = layerId === 'bikeLanes' ? 0.002 : 0.001;
    const expanded = expandBounds(bounds, expandFactor);
    const minLng = expanded[0][0];
    const minLat = expanded[0][1];
    const maxLng = expanded[1][0];
    const maxLat = expanded[1][1];
    
    // Use intersects_box for bikeLanes, within_box for others
    let bboxFilter;
    if (layerId === 'bikeLanes') {
      // WKT POLYGON: (minLng minLat, minLng maxLat, maxLng maxLat, maxLng minLat, minLng minLat)
      const wktPoly = `POLYGON((
        ${minLng} ${minLat},
        ${minLng} ${maxLat},
        ${maxLng} ${maxLat},
        ${maxLng} ${minLat},
        ${minLng} ${minLat}
      ))`;
      bboxFilter = `$where=intersects(${endpoint.geoField}, '${wktPoly.replace(/\s+/g, ' ').trim()}')`;
    } else {
      bboxFilter = `$where=within_box(${endpoint.geoField}, ${minLat}, ${minLng}, ${maxLat}, ${maxLng})`;
    }
    url = `${endpoint.baseUrl}?${bboxFilter}&$limit=5000`;
    console.log(`[infrastructureService] Fetching ${layerId} with URL:`, url);
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
        
      case 'busStops':
        return true; // All bus stop features are valid
        
      case 'bikeLanes':
        return true; // Allow all features for bike lanes
        
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
    case 'bikeLanes':
      return {
        type: 'line',
        paint: {
          'line-color': baseColor || '#2196f3',
          'line-width': 3,
          'line-opacity': 0.8
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