// utils/bearingUtils.js
import { quantizeAngleTo45, quantizeAngleTo90, quantizeBearingForSprites, computeDominantBearingFromPolygon, computeDominantViewportBearing } from './enhancedRenderingUtils';

export const normalizeAngle = (deg) => ((Number(deg) % 360) + 360) % 360;

export const quantizeAbsolute45 = (deg) => quantizeAngleTo45(normalizeAngle(deg));
export const quantizeAbsolute90 = (deg) => quantizeAngleTo90(normalizeAngle(deg));

// Oriented minimum bounding box angle (degrees) for a polygon/multipolygon.
// If projectFn provided, inputs are first projected via projectFn({lng,lat}) -> {x,y}.
// Returns bestAngle in degrees (edge orientation), and we convert to area orientation = -bestAngle.
const computeOrientedMinBBoxAngle = (geometry, projectFn = null) => {
  try {
    if (!geometry || !geometry.type) return 0;
    let coords = [];
    if (geometry.type === 'Polygon') {
      coords = geometry.coordinates || [];
    } else if (geometry.type === 'MultiPolygon') {
      coords = (geometry.coordinates || []).flat();
    } else {
      return 0;
    }
    const points = coords.flat().map(([x, y]) => {
      if (projectFn) {
        try {
          const p = projectFn({ lng: x, lat: y });
          return [p.x, p.y];
        } catch (_) { return [x, y]; }
      }
      return [x, y];
    });
    if (!points.length) return 0;
    // Convex hull (Graham scan)
    points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const p of points) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
    const upper = [];
    for (let i = points.length - 1; i >= 0; i--) { const p = points[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
    const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
    if (hull.length < 2) return 0;
    let minArea = Infinity, bestAngle = 0;
    for (let i = 0; i < hull.length; i++) {
      const p1 = hull[i], p2 = hull[(i + 1) % hull.length];
      const edgeAngle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
      const cos = Math.cos(-edgeAngle), sin = Math.sin(-edgeAngle);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of hull) {
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        minX = Math.min(minX, rx); minY = Math.min(minY, ry);
        maxX = Math.max(maxX, rx); maxY = Math.max(maxY, ry);
      }
      const area = (maxX - minX) * (maxY - minY);
      if (area < minArea) { minArea = area; bestAngle = edgeAngle * 180 / Math.PI; }
    }
    // Area/camera orientation uses -angle for alignment with map bearing conventions
    return normalizeAngle(-bestAngle);
  } catch (_) { return 0; }
};

// Compute area orientation in degrees using oriented min bbox.
// If pitch > 15 or preferViewport true, compute in viewport space using map.project; else geometry space.
export const computeAreaOrientation = ({ map = null, geometry = null, pitch = null, preferViewport = false } = {}) => {
  try {
    if (!geometry) return 0;
    const p = (typeof pitch === 'number') ? pitch : (map && typeof map.getPitch === 'function' ? map.getPitch() : 0);
    const isIso = p > 15;
    if ((preferViewport || isIso) && map && typeof map.project === 'function') {
      return computeOrientedMinBBoxAngle(geometry, (lngLat) => map.project(lngLat));
    }
    return computeOrientedMinBBoxAngle(geometry, null);
  } catch (_) { return 0; }
};

// Snap a camera/map bearing relative to an area orientation, using sprite quantization.
// Returns normalized absolute bearing in [0, 360).
export const snapBearingRelativeToArea = (bearingDeg, areaBearingDeg = 0, preferRightAngles = false) => {
  try {
    const rel = quantizeBearingForSprites((Number(bearingDeg) - Number(areaBearingDeg)), preferRightAngles);
    return normalizeAngle(Number(areaBearingDeg) + rel);
  } catch (_) {
    return normalizeAngle(bearingDeg);
  }
};

// Compute snapped camera bearing from a bearing and area geometry/map context.
// - If areaGeom provided, compute dominant orientation (viewport when isometric pitch > 15).
// - Quantize relative to the area orientation, then optionally quantize the absolute result to 45°.
// Returns normalized absolute bearing in [0, 360).
export const snapCameraBearingToArea = (bearingDeg, { map = null, areaGeom = null, pitch = null, preferRightAngles = false, enforceAbsolute45 = true } = {}) => {
  try {
    const p = (typeof pitch === 'number') ? pitch : (map && typeof map.getPitch === 'function' ? map.getPitch() : 0);
    let areaBearing = null;
    if (areaGeom) areaBearing = computeAreaOrientation({ map, geometry: areaGeom, pitch: p });
    let snapped = (areaBearing != null)
      ? snapBearingRelativeToArea(bearingDeg, areaBearing, preferRightAngles)
      : normalizeAngle(bearingDeg);
    if (enforceAbsolute45) snapped = quantizeAbsolute45(snapped);
    return snapped;
  } catch (_) {
    return quantizeAbsolute45(bearingDeg);
  }
};


