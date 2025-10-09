// Custom Mapbox GL Draw mode for three-point rectangle placement of equipment (e.g., stages, tents, fire lanes)
// Click 1: Starting corner (point A)
// Click 2: Defines width and rotation (point B, creates edge A-B)
// Click 3: Defines height perpendicular to A-B (point C)
// Produces a Polygon feature with user_* properties for downstream handling.

import { distance as turfDistance, rhumbBearing as turfRhumbBearing } from '@turf/turf';

function computeDimensionsMeters(corners) {
  if (!corners || corners.length < 4) return { width: 0, height: 0 };
  // Use edge midpoints for robust length/width (A-B and B-C)
  const A = corners[0];
  const B = corners[1];
  const C = corners[2];
  try {
    const w = turfDistance(A, B, { units: 'meters' });
    const h = turfDistance(B, C, { units: 'meters' });
    return { width: w, height: h };
  } catch (_) {
    return { width: 0, height: 0 };
  }
}


// Helper to get the perpendicular vector
function getPerpendicularVector(lineStart, lineEnd) {
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  
  if (len === 0) return [0, 0];
  
  // Perpendicular is (-dy, dx) normalized
  return [-dy / len, dx / len];
}

// Compute 4 corners from 3 points: A (start), B (defines width), C (defines height direction)
function computeRectangleFrom3Points(pointA, pointB, pointC) {
  // Convert to Web Mercator for accurate calculations
  const R = 6378137;
  const toMerc = ([lng, lat]) => {
    const x = R * (lng * Math.PI / 180);
    const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
    return [x, y];
  };
  const toLngLat = ([x, y]) => {
    const lng = (x / R) * 180 / Math.PI;
    const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI;
    return [lng, lat];
  };
  
  const A = toMerc(pointA);
  const B = toMerc(pointB);
  const C = toMerc(pointC);
  
  // Get perpendicular vector from A-B edge
  const perpVec = getPerpendicularVector(A, B);
  
  // Calculate signed distance from C to line A-B
  const [x0, y0] = C;
  const [x1, y1] = A;
  const [x2, y2] = B;
  const dx = x2 - x1;
  const dy = y2 - y1;
  
  // Use cross product to determine side and distance
  const cross = (x0 - x1) * dy - (y0 - y1) * dx;
  const dist = Math.abs(cross) / Math.sqrt(dx * dx + dy * dy);
  const side = cross > 0 ? -1 : 1;  // Inverted to match drag direction
  
  // Build the 4 corners: A, B, then offset B and A by perpendicular distance
  const D = [A[0] + perpVec[0] * dist * side, A[1] + perpVec[1] * dist * side];
  const C_corner = [B[0] + perpVec[0] * dist * side, B[1] + perpVec[1] * dist * side];
  
  // Return corners in order: A, B, C, D (clockwise or counter-clockwise)
  return [A, B, C_corner, D].map(toLngLat);
}

const RectObjectMode = {};

RectObjectMode.onSetup = function(opts) {
  const state = {
    objectTypeId: opts?.objectTypeId,
    point1: null,  // First corner
    point2: null,  // Second corner (defines width)
    point3: null,  // Third point (defines height)
    tempRect: this.newFeature({
      type: 'Feature',
      properties: { user_rectObjectType: opts?.objectTypeId || '', meta: 'temp' },
      geometry: { type: 'Polygon', coordinates: [[]] }
    })
  };
  this.addFeature(state.tempRect);
  this.setActionableState({ trash: true });
  return state;
};

RectObjectMode.onClick = function(state, e) {
  const point = [e.lngLat.lng, e.lngLat.lat];
  
  // First click: set starting corner
  if (!state.point1) {
    state.point1 = point;
    return;
  }
  
  // Second click: set second corner (defines width/direction)
  if (!state.point2) {
    state.point2 = point;
    return;
  }
  
  // Third click: defines height, finalize rectangle
  state.point3 = point;
  
  const corners = computeRectangleFrom3Points(state.point1, state.point2, state.point3);
  const closed = corners.concat([corners[0]]);
  const dims = computeDimensionsMeters(corners);
  
  // Calculate rotation from the first edge (point1 to point2)
  const bearing = turfRhumbBearing(state.point1, state.point2);
  const rotationDeg = (bearing + 360) % 360;

  const finalFeature = this.newFeature({
    type: 'Feature',
    properties: {
      user_rectObjectType: state.objectTypeId || '',
      user_rotationDeg: rotationDeg,
      user_dimensions_m: dims
    },
    geometry: { type: 'Polygon', coordinates: [closed] }
  });

  // Emit as draw.create payload; consumers can convert to dropped object and delete the feature
  try { this.map.fire('draw.create', { features: [finalFeature.toGeoJSON()] }); } catch (_) {}
  try { this.deleteFeature(state.tempRect.id); } catch (_) {}
  this.changeMode('simple_select');
};

RectObjectMode.onMouseMove = function(state, e) {
  const cur = [e.lngLat.lng, e.lngLat.lat];
  
  // No preview until first point is set
  if (!state.point1) return;
  
  // After first point, show a line to cursor
  if (!state.point2) {
    // Draw a line from point1 to cursor
    try { 
      state.tempRect.setCoordinates([[state.point1, cur, cur, state.point1, state.point1]]);
      state.tempRect.changed(); 
    } catch (_) {}
    return;
  }
  
  // After second point, show preview rectangle
  const corners = computeRectangleFrom3Points(state.point1, state.point2, cur);
  const closed = corners.concat([corners[0]]);
  try { state.tempRect.setCoordinates([closed]); state.tempRect.changed(); } catch (_) {}
};

RectObjectMode.onKeyDown = function(state, e) {
  const k = e.key;
  if (k === 'Escape') {
    try { this.deleteFeature(state.tempRect.id); } catch (_) {}
    this.changeMode('simple_select');
    return;
  }
  // Backspace to undo last point
  if (k === 'Backspace' && (state.point2 || state.point1)) {
    e.preventDefault();
    if (state.point2) {
      // Undo second point
      state.point2 = null;
    } else if (state.point1) {
      // Undo first point
      state.point1 = null;
      try { state.tempRect.setCoordinates([[]]); state.tempRect.changed(); } catch (_) {}
    }
  }
};

RectObjectMode.onKeyUp = function(state, e) {
  // No special keyup handling needed for 3-point mode
};

RectObjectMode.onStop = function(state) {
  try { this.deleteFeature(state.tempRect.id); } catch (_) {}
};

RectObjectMode.toDisplayFeatures = function(state, geojson, display) {
  display(geojson);
};

export default RectObjectMode;


