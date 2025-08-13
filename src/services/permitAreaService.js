// services/permitAreaService.js
// Note: loadPermitAreas is now unified under geographyService (polygon/point loaders).
// This file now only contains search/highlight helpers used by the UI.

export const searchPermitAreas = (permitAreas, searchQuery) => {
  const query = searchQuery.toLowerCase().trim();
  
  return permitAreas
    .filter(area => {
      const p = area.properties || {};
      const fields = [
        p.name,
        p.propertyname,
        p.subpropertyname,
        p.FSN_1,
        p.FSN_2,
        p.FSN_3,
        p.FSN_4
      ].map(v => (v || '').toString().toLowerCase());
      return fields.some(v => v.includes(query));
    })
    .slice(0, 10);
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