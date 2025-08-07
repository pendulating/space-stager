// services/infrastructureService.js
import { INFRASTRUCTURE_ENDPOINTS } from '../constants/endpoints';
import { expandBounds } from '../utils/geometryUtils';
import { INFRASTRUCTURE_ICONS, getZoomIndependentIconSize, layerUsesPngIcon } from '../utils/iconUtils';

export const loadInfrastructureData = async (layerId, bounds) => {
  const endpoint = INFRASTRUCTURE_ENDPOINTS[layerId];
  if (!endpoint) throw new Error(`Unknown layer: ${layerId}`);
  
  console.log(`[infrastructureService] Loading ${layerId} with endpoint:`, endpoint);
  
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
    
    // Build the where clause with multiple conditions
    let whereConditions = [];
    
    // Add bounding box filter
    if (layerId === 'bikeLanes') {
      // WKT POLYGON: (minLng minLat, minLng maxLat, maxLng maxLat, maxLng minLat, minLng minLat)
      const wktPoly = `POLYGON((
        ${minLng} ${minLat},
        ${minLng} ${maxLat},
        ${maxLng} ${maxLat},
        ${maxLng} ${minLat},
        ${minLng} ${minLat}
      ))`;
      whereConditions.push(`intersects(${endpoint.geoField}, '${wktPoly.replace(/\s+/g, ' ').trim()}')`);
    } else {
      whereConditions.push(`within_box(${endpoint.geoField}, ${minLat}, ${minLng}, ${maxLat}, ${maxLng})`);
    }
    
    // Add additional filter conditions for fire lanes and special disaster routes
    if (endpoint.filterField && endpoint.filterValue) {
      whereConditions.push(`${endpoint.filterField}='${endpoint.filterValue}'`);
    }
    
    const bboxFilter = `$where=${whereConditions.join(' AND ')}`;
    url = `${endpoint.baseUrl}?${bboxFilter}&$limit=5000`;
    console.log(`[infrastructureService] Fetching ${layerId} with URL:`, url);
  }
  
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
  }
  
  const data = await response.json();
  
  // Handle datasets that use different geometry field names
  if (layerId === 'parkingMeters' && data.features) {
    console.log(`[infrastructureService] Processing ${layerId} with ${data.features.length} features`);
    
    // Transform features to use standard geometry field
    data.features = data.features.map(feature => {
      // Check if we need to create geometry from lat/lng properties
      if (feature.properties && feature.properties.lat && feature.properties.long && !feature.geometry) {
        return {
          ...feature,
          geometry: {
            type: 'Point',
            coordinates: [parseFloat(feature.properties.long), parseFloat(feature.properties.lat)]
          }
        };
      }
      return feature;
    });
    
    console.log(`[infrastructureService] Transformed ${data.features.length} parking meter features`);
  }
  
  // Handle LinkNYC kiosks data (JSON format with location coordinates)
  if (layerId === 'linknycKiosks' && Array.isArray(data)) {
    console.log(`[infrastructureService] Processing ${layerId} with ${data.length} features`);
    
    // Convert JSON array to GeoJSON format
    const geojsonData = {
      type: 'FeatureCollection',
      features: data.map(item => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [parseFloat(item.longitude), parseFloat(item.latitude)]
        },
        properties: {
          ...item,
          // Add some computed properties for better tooltips
          kiosk_id: item.link_site_id,
          kiosk_type: item.planned_kiosk_type,
          status: item.link_installation_status,
          address: item.street_address,
          cross_streets: `${item.cross_street_1} & ${item.cross_street_2}`,
          borough: item.boro,
          neighborhood: item.neighborhood_tabulation_area_nta
        }
      }))
    };
    
    console.log(`[infrastructureService] Transformed ${geojsonData.features.length} LinkNYC kiosk features`);
    return geojsonData;
  }
  
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
        

        
      case 'busStops':
        return true; // All bus stop features are valid
        
      case 'bikeLanes':
        return true; // Allow all features for bike lanes
        
      case 'bikeParking':
        return true; // All bike parking features are valid
        
      case 'citibikeStations':
        return true; // All citibike station features are valid
        
      case 'subwayEntrances':
        return true; // All subway entrance features are valid
        
      case 'fireLanes':
        return true; // All fire lane features are valid
        
      case 'specialDisasterRoutes':
        return true; // All special disaster route features are valid
        
      case 'pedestrianRamps':
        return true; // All pedestrian ramp features are valid
        
      case 'parkingMeters':
        return true; // All parking meter features are valid
        
      case 'linknycKiosks':
        return true; // All LinkNYC kiosk features are valid
        
      case 'publicRestrooms':
        return true; // All public restroom features are valid
        
      case 'drinkingFountains':
        return true; // All drinking fountain features are valid
        
      case 'sprayShowers':
        return true; // All spray shower features are valid
        
      case 'parksTrails':
        return true; // All parks trail features are valid
        
      case 'parkingLots':
        return true; // All parking lot features are valid
        
      case 'iceLadders':
        return true; // All ice ladder features are valid
        
      case 'parksSigns':
        return true; // All parks sign features are valid
        
      case 'benches':
        return true; // All bench features are valid
        
      default:
        return false;
    }
  }).map(feature => ({
    type: 'Feature',
    geometry: feature.geometry || { type: 'Point', coordinates: [0, 0] },
    properties: feature.properties || {}
  }));
};

// Helper function to check if icons are available on the map
export const areIconsAvailable = (map) => {
  if (!map) {
    console.log('[DEBUG] areIconsAvailable: No map provided');
    return false;
  }
  
  const iconCheck = Object.values(INFRASTRUCTURE_ICONS).map(icon => {
    const hasIcon = map.hasImage(icon.id);
    console.log(`[DEBUG] Icon ${icon.id} available: ${hasIcon}`);
    return hasIcon;
  });
  
  const allAvailable = iconCheck.every(available => available);
  console.log(`[DEBUG] All icons available: ${allAvailable}`);
  
  return allAvailable;
};

export const getLayerStyle = (layerId, layerConfig, map = null) => {
  const baseColor = layerConfig.color;
  const useIcons = map && areIconsAvailable(map);
  
  switch(layerId) {
    case 'hydrants':
      if (useIcons) {
        const iconSize = layerUsesPngIcon(layerId) ? getZoomIndependentIconSize(0.8) : 0.8;
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'hydrant-icon',
            'icon-size': iconSize,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          },
          paint: {
            'icon-color': baseColor,
            'icon-opacity': 0.9
          }
        };
      } else {
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
      }
    case 'trees':
      if (useIcons) {
        const iconSize = layerUsesPngIcon(layerId) ? getZoomIndependentIconSize(0.7) : 0.7;
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'tree-icon',
            'icon-size': iconSize,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          },
          paint: {
            'icon-color': baseColor,
            'icon-opacity': 0.8
          }
        };
      } else {
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
    case 'busStops':
      if (useIcons) {
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'bus-stop-icon',
            'icon-size': 0.9,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          },
          paint: {
            'icon-color': baseColor,
            'icon-opacity': 0.9
          }
        };
      } else {
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
      }
    case 'benches':
      if (useIcons) {
        const iconSize = layerUsesPngIcon(layerId) ? getZoomIndependentIconSize(0.8) : 0.8;
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'bench-icon',
            'icon-size': iconSize,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          },
          paint: {
            'icon-color': baseColor,
            'icon-opacity': 0.9
          }
        };
      } else {
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
      }

    case 'bikeLanes':
      return {
        type: 'line',
        paint: {
          'line-color': baseColor || '#2196f3',
          'line-width': 3,
          'line-opacity': 0.8
        }
      };
    case 'bikeParking':
      if (useIcons) {
        const iconSize = layerUsesPngIcon(layerId) ? getZoomIndependentIconSize(0.8) : 0.8;
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'bike-parking-icon',
            'icon-size': iconSize,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          },
          paint: {
            'icon-color': baseColor,
            'icon-opacity': 0.9
          }
        };
      } else {
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
      }
    case 'citibikeStations':
      if (useIcons) {
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'citibike-station-icon',
            'icon-size': 0.8,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          },
          paint: {
            'icon-color': baseColor,
            'icon-opacity': 0.9
          }
        };
      } else {
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
      }
    case 'subwayEntrances':
      if (useIcons) {
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'subway-entrance-icon',
            'icon-size': 0.8,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          },
          paint: {
            'icon-color': baseColor,
            'icon-opacity': 0.9
          }
        };
      } else {
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
      }
    case 'fireLanes':
      // For fire lanes, we use line styling since they are MultiLineString features
      return {
        type: 'line',
        paint: {
          'line-color': baseColor,
          'line-width': 4,
          'line-opacity': 0.8,
          'line-dasharray': [2, 2]
        }
      };
    case 'specialDisasterRoutes':
      // For special disaster routes, we use line styling since they are MultiLineString features
      return {
        type: 'line',
        paint: {
          'line-color': baseColor,
          'line-width': 4,
          'line-opacity': 0.8,
          'line-dasharray': [4, 2]
        }
      };
    case 'pedestrianRamps':
      if (useIcons) {
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'pedestrian-ramp-icon',
            'icon-size': 0.8,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          },
          paint: {
            'icon-color': baseColor,
            'icon-opacity': 0.9
          }
        };
      } else {
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
      }
    case 'parkingMeters':
      if (useIcons) {
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'parking-meter-icon',
            'icon-size': 0.8,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          },
          paint: {
            'icon-color': baseColor,
            'icon-opacity': 0.9
          }
        };
      } else {
        return {
          type: 'circle',
          paint: {
            'circle-radius': 4,
            'circle-color': baseColor,
            'circle-opacity': 0.9,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': 'white'
          }
        };
      }
    case 'linknycKiosks':
      if (useIcons) {
        const iconSize = layerUsesPngIcon(layerId) ? getZoomIndependentIconSize(0.8) : 0.8;
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'linknyc-kiosk-icon',
            'icon-size': iconSize,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          },
          paint: {
            'icon-color': baseColor,
            'icon-opacity': 0.9
          }
        };
      } else {
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
      }
    case 'publicRestrooms':
      if (useIcons) {
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'public-restroom-icon',
            'icon-size': 0.8,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          },
          paint: {
            'icon-color': baseColor,
            'icon-opacity': 0.9
          }
        };
      } else {
        return {
          type: 'circle',
          paint: {
            'circle-radius': 5,
            'circle-color': baseColor,
            'circle-opacity': 0.9,
            'circle-stroke-width': 2,
            'circle-stroke-color': 'white'
          }
        };
      }
    case 'drinkingFountains':
      if (useIcons) {
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'drinking-fountain-icon',
            'icon-size': 0.8,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          },
          paint: {
            'icon-color': baseColor,
            'icon-opacity': 0.9
          }
        };
      } else {
        return {
          type: 'circle',
          paint: {
            'circle-radius': 4,
            'circle-color': baseColor,
            'circle-opacity': 0.9,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': 'white'
          }
        };
      }
    case 'sprayShowers':
      if (useIcons) {
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'spray-shower-icon',
            'icon-size': 0.8,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          },
          paint: {
            'icon-color': baseColor,
            'icon-opacity': 0.9
          }
        };
      } else {
        return {
          type: 'circle',
          paint: {
            'circle-radius': 5,
            'circle-color': baseColor,
            'circle-opacity': 0.9,
            'circle-stroke-width': 2,
            'circle-stroke-color': 'white'
          }
        };
      }
    case 'parksTrails':
      // For trails, we use line styling instead of icons/circles
      return {
        type: 'line',
        paint: {
          'line-color': baseColor,
          'line-width': 3,
          'line-opacity': 0.8
        }
      };
    case 'parkingLots':
      // For parking lots, we use fill styling for polygons
      return {
        type: 'fill',
        paint: {
          'fill-color': baseColor,
          'fill-opacity': 0.6,
          'fill-outline-color': baseColor
        }
      };
    case 'iceLadders':
      if (useIcons) {
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'ice-ladder-icon',
            'icon-size': 0.8,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          },
          paint: {
            'icon-color': baseColor,
            'icon-opacity': 0.9
          }
        };
      } else {
        return {
          type: 'circle',
          paint: {
            'circle-radius': 5,
            'circle-color': baseColor,
            'circle-opacity': 0.9,
            'circle-stroke-width': 2,
            'circle-stroke-color': 'white'
          }
        };
      }
    case 'parksSigns':
      if (useIcons) {
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'parks-sign-icon',
            'icon-size': 0.8,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          },
          paint: {
            'icon-color': baseColor,
            'icon-opacity': 0.9
          }
        };
      } else {
        return {
          type: 'circle',
          paint: {
            'circle-radius': 4,
            'circle-color': baseColor,
            'circle-opacity': 0.9,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': 'white'
          }
        };
      }
    default:
      if (useIcons) {
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'circle',
            'icon-size': 0.6,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          },
          paint: {
            'icon-color': baseColor,
            'icon-opacity': 0.8
          }
        };
      } else {
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
  }
};  