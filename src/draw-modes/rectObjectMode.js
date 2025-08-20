// Custom Mapbox GL Draw mode for two-point rectangle placement of equipment (e.g., stages)
// Produces a Polygon feature with user_* properties for downstream handling.

import { distance as turfDistance, rhumbBearing as turfRhumbBearing, rhumbDestination as turfRhumbDestination } from '@turf/turf';

// Compute rectangle corners given start and end lngLat, with optional rotation (degrees)
// Returns corners in clockwise order without closing point: [A, B, C, D]
function computeAxisAlignedCorners(startLngLat, endLngLat) {
  const minLng = Math.min(startLngLat[0], endLngLat[0]);
  const maxLng = Math.max(startLngLat[0], endLngLat[0]);
  const minLat = Math.min(startLngLat[1], endLngLat[1]);
  const maxLat = Math.max(startLngLat[1], endLngLat[1]);
  // A: bottom-left, B: bottom-right, C: top-right, D: top-left
  return [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat]
  ];
}

function rotatePointAround(center, point, angleDeg) {
  if (!angleDeg) return point;
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point[0] - center[0];
  const dy = point[1] - center[1];
  return [center[0] + dx * cos - dy * sin, center[1] + dx * sin + dy * cos];
}

function computeRotatedCorners(corners, rotationDeg) {
  if (!rotationDeg) return corners;
  const cx = (corners[0][0] + corners[2][0]) / 2;
  const cy = (corners[0][1] + corners[2][1]) / 2;
  const center = [cx, cy];
  return corners.map((p) => rotatePointAround(center, p, rotationDeg));
}

function centroidOfCorners(corners) {
  const cx = (corners[0][0] + corners[2][0]) / 2;
  const cy = (corners[0][1] + corners[2][1]) / 2;
  return [cx, cy];
}

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

const RectObjectMode = {};

RectObjectMode.onSetup = function(opts) {
  const state = {
    objectTypeId: opts?.objectTypeId,
    start: null,
    rotationDeg: 0,
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
  if (!state.start) {
    state.start = point;
    return;
  }
  // Finalize rectangle
  const axisCorners = computeAxisAlignedCorners(state.start, point);
  const corners = computeRotatedCorners(axisCorners, state.rotationDeg);
  const closed = corners.concat([corners[0]]);
  const dims = computeDimensionsMeters(corners);

  const finalFeature = this.newFeature({
    type: 'Feature',
    properties: {
      user_rectObjectType: state.objectTypeId || '',
      user_rotationDeg: state.rotationDeg,
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
  if (!state.start) return;
  const cur = [e.lngLat.lng, e.lngLat.lat];
  const axisCorners = computeAxisAlignedCorners(state.start, cur);
  const corners = computeRotatedCorners(axisCorners, state.rotationDeg);
  const closed = corners.concat([corners[0]]);
  try { state.tempRect.setCoordinates([closed]); state.tempRect.changed(); } catch (_) {}
};

RectObjectMode.onKeyDown = function(state, e) {
  const k = e.key;
  if (k === '[' || k === ',') {
    state.rotationDeg = (state.rotationDeg - 45 + 360) % 360;
    e.preventDefault();
  } else if (k === ']' || k === '.') {
    state.rotationDeg = (state.rotationDeg + 45) % 360;
    e.preventDefault();
  } else if (k === 'Escape') {
    try { this.deleteFeature(state.tempRect.id); } catch (_) {}
    this.changeMode('simple_select');
  }
};

RectObjectMode.onStop = function(state) {
  try { this.deleteFeature(state.tempRect.id); } catch (_) {}
};

RectObjectMode.toDisplayFeatures = function(state, geojson, display) {
  display(geojson);
};

export default RectObjectMode;


