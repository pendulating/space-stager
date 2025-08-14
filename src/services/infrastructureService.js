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
    
    // Add bounding box (or polygon intersects) filter
    if ((layerId === 'bikeLanes' || layerId === 'fireLanes' || layerId === 'specialDisasterRoutes') && endpoint.geoField) {
      // Use polygon intersects for line-based layers to better approximate area buffer
      const wktPoly = `POLYGON((
        ${minLng} ${minLat},
        ${minLng} ${maxLat},
        ${maxLng} ${maxLat},
        ${maxLng} ${minLat},
        ${minLng} ${minLat}
      ))`;
      whereConditions.push(`intersects(${endpoint.geoField}, '${wktPoly.replace(/\s+/g, ' ').trim()}')`);
    } else if (layerId === 'subwayEntrances' && endpoint.geoField) {
      // Prefer spatial within_box on the point field when available
      whereConditions.push(`within_box(${endpoint.geoField}, ${minLat}, ${minLng}, ${maxLat}, ${maxLng})`);
    } else {
      whereConditions.push(`within_box(${endpoint.geoField}, ${minLat}, ${minLng}, ${maxLat}, ${maxLng})`);
    }
    
    // Add additional filter conditions for fire lanes and special disaster routes
    if (endpoint.filterField && endpoint.filterValue) {
      whereConditions.push(`${endpoint.filterField}='${endpoint.filterValue}'`);
    }
    
    const bboxFilter = `$where=${whereConditions.join(' AND ')}`;
    // Optional column selection for certain datasets
    const selectClause = Array.isArray(endpoint.selectFields) && endpoint.selectFields.length > 0
      ? (() => {
          const fields = endpoint.geoField ? [endpoint.geoField, ...endpoint.selectFields] : endpoint.selectFields.slice();
          // Deduplicate to avoid invalid SoQL due to repeated columns
          const unique = Array.from(new Set(fields.filter(Boolean)));
          return `&$select=${encodeURIComponent(unique.join(','))}`;
        })()
      : '';
    // Socrata API prefers domain-less resource paths for domain-relative endpoints.
    // For full HTTPS URLs, leave as-is. The subway entrances dataset requires full domain.
    url = `${endpoint.baseUrl}?${bboxFilter}${selectClause}&$limit=5000`;
    console.log(`[infrastructureService] Fetching ${layerId} with URL:`, url);
  }
  
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
  }
  
  const data = await response.json();
  
  // Handle datasets that use different geometry/latlon field names
  if (layerId === 'streetParkingSigns' && data.features) {
    // Normalize properties to include expected fields; Socrata may use different casing
    data.features = data.features.map((feature) => {
      const p = feature.properties || {};
      return {
        ...feature,
        properties: {
          ...p,
          // Do not assume the dataset has order_number; leave blank if not present
          order_number: p.order_number || p.order || p.ordernum || p.order_no || p.ordernumber || '',
          on_street: p.on_street || p.onstreet || p.on || '',
          from_street: p.from_street || p.fromstreet || p.from || '',
          to_street: p.to_street || p.tostreet || p.to || '',
          side_of_street: p.side_of_street || p.side || '',
          sign_description: p.sign_description || p.description || p.sign_text || ''
        }
      };
    });
  }
  if (layerId === 'subwayEntrances') {
    // The ny.gov dataset is in feature array shape when using .geojson endpoint
    // Ensure each feature has Point geometry; construct from entrance_longitude/entrance_latitude if needed
    const toNumber = (v) => (v == null || v === '' ? null : Number(v));
    if (Array.isArray(data.features)) {
      data.features = data.features.map((feature) => {
        const p = feature.properties || {};
        let geometry = feature.geometry;
        const lon = toNumber(p.entrance_longitude || p.longitude || p.lon || p.long);
        const lat = toNumber(p.entrance_latitude || p.latitude || p.lat);
        if ((!geometry || geometry.type !== 'Point') && lat != null && lon != null && isFinite(lat) && isFinite(lon)) {
          geometry = { type: 'Point', coordinates: [lon, lat] };
        }
        return { ...feature, geometry };
      });
    } else if (Array.isArray(data)) {
      // JSON array fallback
      data = {
        type: 'FeatureCollection',
        features: data.map((item) => {
          const lon = toNumber(item.entrance_longitude || item.longitude || item.lon || item.long);
          const lat = toNumber(item.entrance_latitude || item.latitude || item.lat);
          return {
            type: 'Feature',
            geometry: (lat != null && lon != null) ? { type: 'Point', coordinates: [lon, lat] } : null,
            properties: { ...item }
          };
        }).filter(f => !!f.geometry)
      };
    }
  }
  if (layerId === 'parkingMeters' && data.features) {
    console.log(`[infrastructureService] Processing ${layerId} with ${data.features.length} features`);
    // Transform features to use standard geometry field and normalize expected sign columns
    data.features = data.features.map(feature => {
      const props = feature.properties || {};
      // Build geometry from lat/long if missing
      let geometry = feature.geometry;
      if (props && props.lat && props.long && !geometry) {
        geometry = {
          type: 'Point',
          coordinates: [parseFloat(props.long), parseFloat(props.lat)]
        };
      }
      return {
        ...feature,
        geometry: geometry || feature.geometry,
        properties: {
          ...props,
          // Normalize export-required columns for regulation summary
          order_number: props.order_number || props.order || props.ordernum || props.order_no || props.ordernumber || '',
          on_street: props.on_street || props.onstreet || props.on || '',
          from_street: props.from_street || props.fromstreet || props.from || '',
          to_street: props.to_street || props.tostreet || props.to || '',
          side_of_street: props.side_of_street || props.side || '',
          sign_description: props.sign_description || props.description || props.sign_text || ''
        }
      };
    });
    console.log(`[infrastructureService] Normalized ${data.features.length} parking meter features`);
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
  
  // Normalize Street Parking Regulations (streetParkingSigns) if present
  if (layerId === 'streetParkingSigns' && data.features) {
    data.features = data.features.map((feature) => {
      const p = feature.properties || {};
      return {
        ...feature,
        properties: {
          ...p,
          order_number: p.order_number || p.order || p.ordernum || p.order_no || p.ordernumber || '',
          on_street: p.on_street || p.onstreet || p.on || '',
          from_street: p.from_street || p.fromstreet || p.from || '',
          to_street: p.to_street || p.tostreet || p.to || '',
          side_of_street: p.side_of_street || p.side || '',
          sign_description: p.sign_description || p.description || p.sign_text || ''
        }
      };
    });
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
  const iconDef = INFRASTRUCTURE_ICONS[layerId];
  const hasIconDef = !!iconDef;
  const areaScale = iconDef?.areaScale ?? 1;
  const sizeScale = Math.sqrt(areaScale); // icon-size scales linearly; user parameter controls area
  
  switch(layerId) {
    case 'hydrants':
      if (hasIconDef) {
        const base = 0.8 * sizeScale;
        const iconSize = layerUsesPngIcon(layerId) ? getZoomIndependentIconSize(base) : base;
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
      if (hasIconDef) {
        const base = 0.7 * sizeScale;
        const iconSize = layerUsesPngIcon(layerId) ? getZoomIndependentIconSize(base) : base;
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
      if (hasIconDef) {
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'bus-stop-icon',
            'icon-size': 0.9 * sizeScale,
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
      if (hasIconDef) {
        const base = 0.8 * sizeScale;
        const iconSize = layerUsesPngIcon(layerId) ? getZoomIndependentIconSize(base) : base;
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
      if (hasIconDef) {
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
      if (hasIconDef) {
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'citibike-station-icon',
            'icon-size': 0.8 * sizeScale,
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
      if (hasIconDef) {
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'subway-entrance-icon',
            'icon-size': 0.8 * sizeScale,
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
      if (hasIconDef) {
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'pedestrian-ramp-icon',
            'icon-size': 0.8 * sizeScale,
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
      if (hasIconDef) {
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
      if (hasIconDef) {
        const base = 0.8 * sizeScale;
        const iconSize = layerUsesPngIcon(layerId) ? getZoomIndependentIconSize(base) : base;
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
      if (hasIconDef) {
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'public-restroom-icon',
            'icon-size': 0.8 * sizeScale,
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
      if (hasIconDef) {
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'drinking-fountain-icon',
            'icon-size': 0.8 * sizeScale,
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
      if (hasIconDef) {
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'spray-shower-icon',
            'icon-size': 0.8 * sizeScale,
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
      if (hasIconDef) {
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
      if (hasIconDef) {
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
      if (hasIconDef) {
        return {
          type: 'symbol',
          layout: {
            'icon-image': iconDef.id,
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