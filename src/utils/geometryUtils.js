// utils/geometryUtils.js
export const calculateGeometryBounds = (geometry) => {
  if (!geometry || !geometry.coordinates) return null;
  
  let coordinates = [];
  
  if (geometry.type === 'Polygon') {
    coordinates = geometry.coordinates[0]; // Outer ring
  } else if (geometry.type === 'MultiPolygon') {
    // Flatten all coordinates from all polygons
    geometry.coordinates.forEach(polygon => {
      coordinates = coordinates.concat(polygon[0]);
    });
  } else {
    return null;
  }
  
  if (coordinates.length === 0) return null;
  
  // Find min/max coords
  let minX = coordinates[0][0];
  let minY = coordinates[0][1];
  let maxX = coordinates[0][0];
  let maxY = coordinates[0][1];
  
  coordinates.forEach(coord => {
    minX = Math.min(minX, coord[0]);
    minY = Math.min(minY, coord[1]);
    maxX = Math.max(maxX, coord[0]);
    maxY = Math.max(maxY, coord[1]);
  });
  
  return [[minX, minY], [maxX, maxY]];
};

export const expandBounds = (bounds, factor = 0.001) => {
  if (!bounds) return null;
  
  return [
    [bounds[0][0] - factor, bounds[0][1] - factor],
    [bounds[1][0] + factor, bounds[1][1] + factor]
  ];
};

export const getAreaDisplayName = (area) => {
  if (!area || !area.properties) return 'Unnamed Area';
  return area.properties.name || 'Unnamed Area';
};

export const getAreaDescription = (area) => {
  if (!area || !area.properties) return '';
  
  const parts = [];
  if (area.properties.propertyname) {
    parts.push(area.properties.propertyname);
  }
  if (area.properties.subpropertyname) {
    parts.push(area.properties.subpropertyname);
  }
  
  return parts.join(' › ');
};