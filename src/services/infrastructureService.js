// services/infrastructureService.js
import { INFRASTRUCTURE_ENDPOINTS } from '../constants/endpoints';
import proj4 from 'proj4';
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
    if (layerId === 'curbCuts') {
      // ArcGIS FeatureServer expects envelope bbox & parameters
      const geometry = `${minLng},${minLat},${maxLng},${maxLat}`;
      const params = new URLSearchParams({
        geometry,
        geometryType: 'esriGeometryEnvelope',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: '*',
        f: 'geojson'
      });
      url = `${endpoint.baseUrl}?${params.toString()}`;
    } else if (layerId === 'dcwpParkingGarages') {
      // Fetch DCWP licensed businesses: filter by Garage & Parking Lot within bbox
      // Build SoQL: business_category='Garage & Parking Lot' AND latitude/longitude within box
      const where = encodeURIComponent(`business_category='Garage & Parking Lot' AND latitude between ${minLat} and ${maxLat} AND longitude between ${minLng} and ${maxLng}`);
      const select = endpoint.selectFields?.length ? `&$select=${encodeURIComponent(endpoint.selectFields.join(','))}` : '';
      url = `${endpoint.baseUrl}?$where=${where}${select}&$limit=5000`;
    } else {
      if (layerId === 'streetParkingSigns') {
        // JSON endpoint; start without WHERE to validate columns/ranges, rely on client-side filtering if needed
        const select = endpoint.selectFields?.length ? `?$select=${encodeURIComponent(endpoint.selectFields.join(','))}` : '';
        url = `${endpoint.baseUrl}${select}${select ? '&' : '?'}$limit=5000`;
      } else {
        url = `${endpoint.baseUrl}?${bboxFilter}${selectClause}&$limit=5000`;
      }
    }
    console.log(`[infrastructureService] Fetching ${layerId} with URL:`, url);
  }
  
  console.log(`[infrastructureService] Fetching ${layerId} with URL: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
  }
  
  let data = await response.json();
  
  // Define EPSG:2263 (NAD83 / New York Long Island (ftUS)) once for coordinate conversion
  try {
    // Only define if not already present
    if (!proj4.defs || !proj4.defs('EPSG:2263')) {
      proj4.defs('EPSG:2263', '+proj=lcc +lat_1=41.03333333333333 +lat_2=40.66666666666666 +lat_0=40.16666666666666 +lon_0=-74 +x_0=300000 +y_0=0 +datum=NAD83 +units=us-ft +no_defs');
    }
  } catch (_) {}

  // Handle Parking Regulation Locations & Signs (nfid-uabd) JSON: construct Point geometry safely
  if (layerId === 'streetParkingSigns') {
    if (Array.isArray(data)) {
      try { console.log('[streetParkingSigns] raw rows:', data.length, 'sample:', data.slice(0, 5).map(r => ({ x: r.sign_x_coord, y: r.sign_y_coord }))); } catch(_) {}
      const toNum = (v) => (v == null || v === '' ? null : Number(v));
      const isValidLngLat = (lon, lat) => typeof lon === 'number' && typeof lat === 'number' && Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90;
      const getGeometryFromRow = (row) => {
        // Prefer explicit lon/lat pairs if ever present
        let lon = toNum(row.longitude || row.lon || row.long || row.sign_longitude);
        let lat = toNum(row.latitude || row.lat || row.sign_latitude);
        if (isValidLngLat(lon, lat)) return { type: 'Point', coordinates: [lon, lat] };
        // Otherwise use sign_x_coord/sign_y_coord (NY State Plane ftUS, EPSG:2263) and convert
        const x = toNum(row.sign_x_coord);
        const y = toNum(row.sign_y_coord);
        if (x != null && y != null && isFinite(x) && isFinite(y)) {
          try {
            const wgs84 = proj4('EPSG:2263', 'EPSG:4326', [x, y]);
            const [lon2, lat2] = wgs84;
            if (isValidLngLat(lon2, lat2)) return { type: 'Point', coordinates: [lon2, lat2] };
          } catch (e) {
            // fall through
          }
        }
        return null;
      };
      const convPreview = [];
      const features = data.map((row, idx) => {
        const geometry = getGeometryFromRow(row);
        if (idx < 10) {
          try {
            const rawX = row.sign_x_coord;
            const rawY = row.sign_y_coord;
            const xy = [rawX, rawY];
            const lonlat = geometry?.coordinates ? [geometry.coordinates[0], geometry.coordinates[1]] : null;
            convPreview.push({ raw: xy, converted: lonlat });
          } catch(_) {}
        }
        if (!geometry && idx < 5) {
          console.warn('[streetParkingSigns] failed to convert row', idx, {
            rawX: row.sign_x_coord ?? row.sign_coord_x,
            rawY: row.sign_y_coord ?? row.sign_coord_y
          });
        }
        return { type: 'Feature', geometry, properties: { ...row } };
      }).filter(f => !!f.geometry);
      try { console.log('[streetParkingSigns] sample conversions [x,y] -> [lon,lat]:', convPreview); } catch(_) {}
      try {
        const coords = features.map(f => f.geometry?.coordinates).filter(Boolean);
        const lons = coords.map(c => c[0]);
        const lats = coords.map(c => c[1]);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const outOfRange = coords.filter(([lon, lat]) => !(Math.abs(lon) <= 180 && Math.abs(lat) <= 90)).length;
        console.log('[streetParkingSigns] features built:', features.length, 'extent:', { minLon, maxLon, minLat, maxLat, outOfRange });
        console.log('[streetParkingSigns] sample coords:', coords.slice(0, 10));
      } catch(_) {}
      data = { type: 'FeatureCollection', features };
    }
    if (data.features) {
      data.features = data.features.map((feature) => {
        const p = feature.properties || {};
        return {
          ...feature,
          properties: {
            ...p,
            on_street: p.on_street || p.onstreet || p.primary_st || p.street || p.on || '',
            from_street: p.from_street || p.fromstreet || p.from_st || p.cross_from || '',
            to_street: p.to_street || p.tostreet || p.to_st || p.cross_to || '',
            side_of_street: p.side_of_street || p.side || p.side_street || p.side_of_st || '',
            sign_description: p.sign_description || p.sign_text || p.description || p.sign || ''
          }
        };
      });
    }
  }
  if (layerId === 'accessiblePedSignals') {
    // Ensure geometry is Point for APS dataset
    const toNum = (v) => (v == null || v === '' ? null : Number(v));
    if (Array.isArray(data.features)) {
      data.features = data.features.map((feature) => {
        let geometry = feature.geometry;
        const p = feature.properties || {};
        const lon = toNum(p.point_x || p.longitude || p.lon || p.long);
        const lat = toNum(p.point_y || p.latitude || p.lat);
        if ((!geometry || geometry.type !== 'Point') && lat != null && lon != null && isFinite(lat) && isFinite(lon)) {
          geometry = { type: 'Point', coordinates: [lon, lat] };
        }
        return { ...feature, geometry };
      }).filter(f => !!f.geometry);
    }
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
    // Transform features to use standard geometry field and normalize expected columns
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
          // Normalize fields expected by export for meters
          on_street: props.on_street || props.onstreet || props.on || props.street_name || '',
          from_street: props.from_street || props.fromstreet || props.from || props.from_st || '',
          to_street: props.to_street || props.tostreet || props.to || props.to_st || '',
          side_of_street: props.side_of_street || props.side || props.side_street || '',
          meter_number: props.meter_number || props.meterid || props.meter_id || props.meter || '',
          status: props.status || props.meter_status || '',
          meter_hours: props.meter_hours || props.hours || props.operation_hours || '',
          parking_facility_name: props.parking_facility_name || props.facility || ''
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

  if (layerId === 'curbCuts') {
    // Normalize ArcGIS geojson: ensure LineString/MultiLineString preserved, and store type
    if (Array.isArray(data.features)) {
      data.features = data.features.map(f => {
        const props = f.properties || {};
        const type = props.SUB_FEATURE_CODE === 222600 ? 'midblock' : (props.SUB_FEATURE_CODE === 222700 ? 'corner' : 'unknown');
        return {
          ...f,
          properties: { ...props, curbcut_type: type }
        };
      });
    }
  }

  if (layerId === 'dcwpParkingGarages') {
    // Build unique BIN list and fetch polygon geometries for those BINs from 5zhs-2jue (Building Footprints)
    try { console.log('[dcwp] raw dcwp rows count:', Array.isArray(data) ? data.length : (data?.features?.length || 0)); } catch(_) {}
    // https://data.cityofnewyork.us/resource/5zhs-2jue.geojson
    const bins = new Set();
    const dcwpRows = Array.isArray(data) ? data : (data.features || []).map(f => f.properties);
    (dcwpRows).forEach((row) => {
      const binStr = String(row.bin || row.BIN || '').trim();
      if (binStr && /^\d+$/.test(binStr)) bins.add(binStr);
    });
    const binList = Array.from(bins);
    try { console.log('[dcwp] unique BINs:', binList.length, binList.slice(0, 10)); } catch(_) {}
    let footprints = { type: 'FeatureCollection', features: [] };
    if (binList.length) {
      const base = 'https://data.cityofnewyork.us/resource/5zhs-2jue.geojson';
      const chunks = [];
      // Chunk BINs to avoid very long URLs
      for (let i = 0; i < binList.length; i += 100) chunks.push(binList.slice(i, i + 100));
      for (const c of chunks) {
        // Socrata BIN is usually text; quote values for IN clause
        const inList = c.map(v => `"${v}"`).join(',');
        const where = encodeURIComponent(`bin in(${inList})`);
        const urlFp = `${base}?$where=${where}&$limit=5000`;
        try { console.log('[dcwp] footprints URL:', urlFp); } catch(_) {}
        const resp = await fetch(urlFp);
        if (resp.ok) {
          const gj = await resp.json();
          const ct = Array.isArray(gj?.features) ? gj.features.length : 0;
          try { console.log('[dcwp] footprints chunk fetched:', ct); } catch(_) {}
          if (ct) footprints.features.push(...gj.features);
        }
      }
    }
    // Convert to only polygons and attach a simplified properties set
    const dcwpByBin = new Map();
    dcwpRows.forEach(r => { const b = String(r.bin || '').trim(); if (b) dcwpByBin.set(b, r); });
    const features = (footprints.features || []).filter(f => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')).map(f => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        bin: f.properties?.bin,
        name: 'DCWP Garage/Lot',
        source: 'DCWP',
        business_name: dcwpByBin.get(String(f.properties?.bin || '').trim())?.business_name || '',
        detail: dcwpByBin.get(String(f.properties?.bin || '').trim())?.detail || '',
        address_building: dcwpByBin.get(String(f.properties?.bin || '').trim())?.address_building || '',
        address_street_name: dcwpByBin.get(String(f.properties?.bin || '').trim())?.address_street_name || '',
        address_street_name_2: dcwpByBin.get(String(f.properties?.bin || '').trim())?.address_street_name_2 || ''
      }
    }));
    try { console.log('[dcwp] footprint polygons total:', features.length); } catch(_) {}
    data = { type: 'FeatureCollection', features };
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
    const hasValidPoint = (f) => {
      const g = f?.geometry;
      if (!g || g.type !== 'Point') return false;
      const c = g.coordinates;
      if (!Array.isArray(c) || c.length !== 2) return false;
      const lon = Number(c[0]);
      const lat = Number(c[1]);
      return isFinite(lon) && isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90;
    };
    
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
      case 'curbCuts':
        return feature.geometry && (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString');
        
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
      case 'streetParkingSigns':
        // Only keep valid point features with sane lon/lat
        return hasValidPoint(feature);
      case 'stationEnvelopes':
        return true; // All station envelope features are valid (polygons/multipolygons)
        
      case 'benches':
        return true; // All bench features are valid
      case 'accessiblePedSignals':
        return true; // All APS point features are valid
      case 'dcwpParkingGarages':
        return feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon');
        
      default:
        return false;
    }
  }).map(feature => {
    // Avoid fabricating [0,0] for streetParkingSigns; preserve only valid geometry
    const geometry = (layerId === 'streetParkingSigns')
      ? feature.geometry
      : (feature.geometry || { type: 'Point', coordinates: [0, 0] });
    return {
      type: 'Feature',
      geometry,
      properties: feature.properties || {}
    };
  });
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
        const base = 0.9 * sizeScale;
        const iconSize = layerUsesPngIcon(layerId) ? getZoomIndependentIconSize(base) : base;
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'bus-stop-icon',
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
    case 'curbCuts':
      return {
        type: 'line',
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'curbcut_type'], 'midblock'], '#ef4444',
            ['==', ['get', 'curbcut_type'], 'corner'], '#f97316',
            baseColor
          ],
          'line-width': 2.2,
          'line-opacity': 0.9
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
            'icon-size': 0.5 * sizeScale,
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
            'icon-size': 0.5 * sizeScale,
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
        const base = 0.8 * sizeScale;
        const iconSize = layerUsesPngIcon(layerId) ? getZoomIndependentIconSize(base) : base;
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'pedestrian-ramp-icon',
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
    case 'parkingMeters':
      if (hasIconDef) {
        const base = 0.8 * sizeScale;
        const iconSize = layerUsesPngIcon(layerId) ? getZoomIndependentIconSize(base) : base;
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'parking-meter-icon',
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
        const base = 0.9 * sizeScale;
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
        const base = 0.9 * sizeScale;
        const iconSize = layerUsesPngIcon(layerId) ? getZoomIndependentIconSize(base) : base;
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'public-restroom-icon',
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
            'circle-stroke-width': 2,
            'circle-stroke-color': 'white'
          }
        };
      }
    case 'drinkingFountains':
      if (hasIconDef) {
        const base = 0.8 * sizeScale;
        const iconSize = layerUsesPngIcon(layerId) ? getZoomIndependentIconSize(base) : base;
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'drinking-fountain-icon',
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
        const base = 0.8 * sizeScale;
        const iconSize = layerUsesPngIcon(layerId) ? getZoomIndependentIconSize(base) : base;
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'spray-shower-icon',
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
    case 'dcwpParkingGarages':
      return {
        type: 'fill',
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.25,
          'fill-outline-color': '#1d4ed8'
        }
      };
    case 'iceLadders':
      if (hasIconDef) {
        const base = 0.8 * sizeScale;
        const iconSize = layerUsesPngIcon(layerId) ? getZoomIndependentIconSize(base) : base;
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'ice-ladder-icon',
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
            'circle-stroke-width': 2,
            'circle-stroke-color': 'white'
          }
        };
      }
    case 'parksSigns':
      if (hasIconDef) {
        const base = 0.9 * sizeScale;
        const iconSize = layerUsesPngIcon(layerId) ? getZoomIndependentIconSize(base) : base;
        return {
          type: 'symbol',
          layout: {
            'icon-image': 'parks-sign-icon',
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