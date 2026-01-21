// src/services/openStreetsService.js
import { INFRASTRUCTURE_ENDPOINTS } from '../constants/endpoints';
import { expandBounds } from '../utils/geometryUtils';

/**
 * Fetch and normalize Open Streets data for a given bounding box.
 * 
 * @param {Array<Array<number>>} bounds - [[minLng, minLat], [maxLng, maxLat]]
 * @returns {Promise<Object>} - GeoJSON FeatureCollection
 */
export const loadOpenStreetsData = async (bounds) => {
  const endpoint = INFRASTRUCTURE_ENDPOINTS.openStreets;
  if (!endpoint) throw new Error('Open Streets endpoint not configured');

  const expandFactor = 0.002;
  const expanded = expandBounds(bounds, expandFactor);
  const minLng = expanded[0][0];
  const minLat = expanded[0][1];
  const maxLng = expanded[1][0];
  const maxLat = expanded[1][1];

  // Socrata SoQL filter for Open Streets
  // Note: Open Streets data uses 'the_geom' for MultiLineString
  const wktPoly = `POLYGON((
    ${minLng} ${minLat},
    ${minLng} ${maxLat},
    ${maxLng} ${maxLat},
    ${maxLng} ${minLat},
    ${minLng} ${minLat}
  ))`.replace(/\s+/g, ' ').trim();

  const where = `intersects(${endpoint.geoField}, '${wktPoly}')`;
  const url = `${endpoint.baseUrl}?$where=${encodeURIComponent(where)}&$limit=5000`;

  console.log('[openStreetsService] Fetching Open Streets data:', url);

  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
  }

  const data = await response.json();
  
  // Normalize and calculate density score
  if (data && data.features) {
    data.features = data.features.map(feature => {
      const props = feature.properties || {};
      
      // Calculate density score based on approved days of week
      // apprdayswe: "mon,tue,wed,thu,fri,sat,sun"
      const days = (props.apprdayswe || '').split(',').filter(d => d.trim().length > 0);
      const densityScore = days.length; // 0 to 7
      
      return {
        ...feature,
        properties: {
          ...props,
          activation_density: densityScore,
          is_active_today: checkIfActiveToday(props),
          display_name: `${props.appronstre} (${props.apprfromst} - ${props.apprtostre})`
        }
      };
    });
  }

  return data;
};

/**
 * Helper to check if an Open Street is active today based on its schedule.
 * 
 * @param {Object} props - Feature properties
 * @returns {boolean}
 */
const checkIfActiveToday = (props) => {
  const now = new Date();
  const daysMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const today = daysMap[now.getDay()];
  
  const approvedDays = (props.apprdayswe || '').toLowerCase();
  if (!approvedDays.includes(today)) return false;
  
  // Check if current time is within approved hours for today
  // apprmonope, apprmonclo, etc.
  const openKey = `appr${today}ope`;
  const closeKey = `appr${today}clo`;
  
  const openTime = props[openKey];
  const closeTime = props[closeKey];
  
  if (!openTime || !closeTime) return true; // Assume all day if times missing but day matches
  
  try {
    const [openH, openM] = openTime.split(':').map(Number);
    const [closeH, closeM] = closeTime.split(':').map(Number);
    
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    
    const currentTimeMinutes = currentH * 60 + currentM;
    const openTimeMinutes = openH * 60 + openM;
    const closeTimeMinutes = closeH * 60 + closeM;
    
    return currentTimeMinutes >= openTimeMinutes && currentTimeMinutes <= closeTimeMinutes;
  } catch (_) {
    return true;
  }
};

