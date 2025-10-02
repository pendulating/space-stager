// utils/mtaUtils.js
// MTA train line utilities based on NYC Core Framework
// https://www.nyc.gov/assets/oti/html/nyc-core-framework/subway-icons.html

/**
 * Official MTA train line colors
 * Based on NYC Core Framework subway icon styles
 */
export const MTA_COLORS = {
  '1': 'red',
  '2': 'red',
  '3': 'red',
  '4': 'green',
  '5': 'green',
  '6': 'green',
  '7': 'purple',
  'A': 'blue',
  'C': 'blue',
  'E': 'blue',
  'B': 'orange',
  'D': 'orange',
  'F': 'orange',
  'M': 'orange',
  'N': 'yellow',
  'Q': 'yellow',
  'R': 'yellow',
  'W': 'yellow',
  'G': 'green-2',
  'J': 'brown',
  'Z': 'brown',
  'L': 'gray',
  'S': 'gray', // Shuttle
  'FS': 'gray', // Franklin Shuttle
  'GS': 'gray', // Grand Central Shuttle
  'H': 'gray' // Rockaway Park Shuttle
};

/**
 * Tailwind CSS classes for MTA colors
 */
export const MTA_COLOR_CLASSES = {
  red: 'bg-[#EE352E] text-white',
  green: 'bg-[#00933C] text-white',
  blue: 'bg-[#0039A6] text-white',
  orange: 'bg-[#FF6319] text-white',
  purple: 'bg-[#B933AD] text-white',
  'green-2': 'bg-[#6CBE45] text-white',
  yellow: 'bg-[#FCCC0A] text-black',
  gray: 'bg-[#A7A9AC] text-white',
  brown: 'bg-[#996633] text-white'
};

/**
 * Hex color values for canvas rendering
 */
export const MTA_COLOR_HEX = {
  red: '#EE352E',
  green: '#00933C',
  blue: '#0039A6',
  orange: '#FF6319',
  purple: '#B933AD',
  'green-2': '#6CBE45',
  yellow: '#FCCC0A',
  gray: '#A7A9AC',
  brown: '#996633'
};

/**
 * Text colors for each background (for contrast)
 */
export const MTA_TEXT_COLOR_HEX = {
  red: '#FFFFFF',
  green: '#FFFFFF',
  blue: '#FFFFFF',
  orange: '#FFFFFF',
  purple: '#FFFFFF',
  'green-2': '#FFFFFF',
  yellow: '#000000',
  gray: '#FFFFFF',
  brown: '#FFFFFF'
};

/**
 * Parse daytime_routes string into array of individual train lines
 * Handles various formats from the NYC subway entrance dataset
 * 
 * @param {string|array} routesString - Routes from subway entrance properties
 * @returns {string[]} - Array of individual train line identifiers
 * 
 * Examples:
 *   "1 2 3" → ['1', '2', '3']
 *   "A C E" → ['A', 'C', 'E']
 *   "4-5-6" → ['4', '5', '6']
 *   "B,D,F,M" → ['B', 'D', 'F', 'M']
 */
export const parseTrainLines = (routesString) => {
  if (!routesString) return [];
  
  // Handle array input
  if (Array.isArray(routesString)) {
    return routesString
      .map(line => String(line).trim().toUpperCase())
      .filter(line => line.length > 0 && line !== 'NULL' && line !== 'NONE');
  }
  
  // Handle string input
  if (typeof routesString !== 'string') return [];
  
  // Split by various delimiters: space, comma, dash, slash
  return routesString
    .split(/[\s,\-/]+/)
    .map(line => line.trim().toUpperCase())
    .filter(line => line.length > 0 && line !== 'NULL' && line !== 'NONE')
    .filter((line, index, self) => self.indexOf(line) === index); // Remove duplicates
};

/**
 * Get the MTA color for a given train line
 * @param {string} line - Train line identifier (e.g., '1', 'A', 'Q')
 * @returns {string} - Color name
 */
export const getTrainLineColor = (line) => {
  if (!line) return 'gray';
  const normalized = String(line).toUpperCase().trim();
  return MTA_COLORS[normalized] || 'gray';
};

/**
 * Get Tailwind CSS classes for a train line
 * @param {string} line - Train line identifier
 * @returns {string} - CSS classes
 */
export const getTrainLineClasses = (line) => {
  const color = getTrainLineColor(line);
  return MTA_COLOR_CLASSES[color] || MTA_COLOR_CLASSES.gray;
};

/**
 * Get hex color value for a train line
 * @param {string} line - Train line identifier
 * @returns {string} - Hex color code
 */
export const getTrainLineHexColor = (line) => {
  const color = getTrainLineColor(line);
  return MTA_COLOR_HEX[color] || MTA_COLOR_HEX.gray;
};

/**
 * Get text color (for contrast) for a train line
 * @param {string} line - Train line identifier
 * @returns {string} - Hex color code for text
 */
export const getTrainLineTextColor = (line) => {
  const color = getTrainLineColor(line);
  return MTA_TEXT_COLOR_HEX[color] || MTA_TEXT_COLOR_HEX.gray;
};

/**
 * Sort train lines in a logical order (numbers first, then letters)
 * @param {string[]} lines - Array of train line identifiers
 * @returns {string[]} - Sorted array
 */
export const sortTrainLines = (lines) => {
  if (!Array.isArray(lines)) return [];
  
  return [...lines].sort((a, b) => {
    const aIsNumber = /^\d+$/.test(a);
    const bIsNumber = /^\d+$/.test(b);
    
    // Numbers before letters
    if (aIsNumber && !bIsNumber) return -1;
    if (!aIsNumber && bIsNumber) return 1;
    
    // Both numbers or both letters - sort naturally
    if (aIsNumber && bIsNumber) {
      return parseInt(a) - parseInt(b);
    }
    
    return a.localeCompare(b);
  });
};

/**
 * Group subway entrance features by station location
 * Combines entrances that are very close together (same station)
 * @param {object[]} features - GeoJSON features
 * @param {number} tolerance - Distance tolerance in degrees (default ~10 meters)
 * @returns {Map} - Map of location key to combined feature data
 */
export const groupSubwayEntrancesByLocation = (features, tolerance = 0.0001) => {
  const stations = new Map();
  
  if (!Array.isArray(features)) return stations;
  
  features.forEach(feature => {
    if (!feature?.geometry?.coordinates) return;
    
    const [lng, lat] = feature.geometry.coordinates;
    const props = feature.properties || {};
    
    // Create a location key (rounded coordinates)
    const locationKey = `${Math.round(lng / tolerance) * tolerance},${Math.round(lat / tolerance) * tolerance}`;
    
    if (!stations.has(locationKey)) {
      stations.set(locationKey, {
        location: [lng, lat],
        lines: new Set(),
        entrances: [],
        stationName: props.stop_name || props.station_name,
        stationId: props.station_id || props.complex_id
      });
    }
    
    const station = stations.get(locationKey);
    const lines = parseTrainLines(
      props.daytime_routes || props.routes || props.line || props.lines
    );
    
    lines.forEach(line => station.lines.add(line));
    station.entrances.push(feature);
  });
  
  return stations;
};

/**
 * Create a consolidated feature for a station with all its train lines
 * @param {object} stationData - Data from groupSubwayEntrancesByLocation
 * @returns {object} - GeoJSON feature
 */
export const createStationFeature = (stationData) => {
  const lines = sortTrainLines(Array.from(stationData.lines));
  
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: stationData.location
    },
    properties: {
      train_lines: lines,
      daytime_routes: lines.join(' '),
      entrance_count: stationData.entrances.length,
      station_name: stationData.stationName,
      station_id: stationData.stationId,
      // Preserve other properties from first entrance
      ...stationData.entrances[0]?.properties
    }
  };
};

