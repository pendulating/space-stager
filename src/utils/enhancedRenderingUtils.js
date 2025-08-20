// utils/enhancedRenderingUtils.js

/**
 * Utilities for enhanced isometric sprite rendering for point layers.
 * - Loads angle-variant PNG sprites into the map sprite registry
 * - Computes nearest CSCL centerline bearing for a point
 * - Quantizes and maps bearings to sprite variant IDs
 */

/**
 * Pad an angle integer (0..359) to 3 digits, e.g. 0 -> "000", 45 -> "045".
 */
export const padAngle = (angle) => String(((angle % 360) + 360) % 360).padStart(3, '0');

/**
 * Given a numeric angle in degrees, quantize to nearest 45-degree bucket (0..315).
 */
export const quantizeAngleTo45 = (angleDeg) => {
  const a = ((angleDeg % 360) + 360) % 360;
  const q = Math.round(a / 45) * 45;
  return (q + 360) % 360;
};

/**
 * Compute rhumb bearing from p1 -> p2 in degrees (0=N, 90=E).
 * Uses simple approximation suitable for small distances in NYC.
 */
export const computeBearingDegrees = (lon1, lat1, lon2, lat2) => {
  const toRad = (d) => d * Math.PI / 180;
  const dLon = toRad(lon2 - lon1);
  const dLat = toRad(lat2 - lat1);
  const latAvg = toRad((lat1 + lat2) / 2);
  const x = Math.sin(dLon) * Math.cos(latAvg);
  const y = dLat;
  const brng = Math.atan2(x, y) * 180 / Math.PI; // degrees, 0=N
  return (brng + 360) % 360;
};

/**
 * Compute squared distance from point P to segment AB in lon/lat space (rough metric).
 */
const pointToSegmentDistanceSq = (px, py, ax, ay, bx, by) => {
  // Convert lon/lat to a local planar approximation in meters using simple scaling
  const metersPerDegLat = 111132; // approx
  const metersPerDegLon = 111320 * Math.cos(((ay + by) / 2) * Math.PI / 180);
  const axm = ax * metersPerDegLon;
  const aym = ay * metersPerDegLat;
  const bxm = bx * metersPerDegLon;
  const bym = by * metersPerDegLat;
  const pxm = px * metersPerDegLon;
  const pym = py * metersPerDegLat;
  const abx = bxm - axm;
  const aby = bym - aym;
  const apx = pxm - axm;
  const apy = pym - aym;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) {
    const dx = pxm - axm;
    const dy = pym - aym;
    return dx * dx + dy * dy;
  }
  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = axm + t * abx;
  const cy = aym + t * aby;
  const dx = pxm - cx;
  const dy = pym - cy;
  return dx * dx + dy * dy;
};

/**
 * Given a GeoJSON Feature<Point>, and an array of GeoJSON LineString/MultiLineString features
 * (e.g., CSCL centerlines), compute the bearing (0..360) of the nearest segment to the point.
 * Returns null if no valid lines are provided.
 */
export const computeNearestLineBearing = (pointFeature, lineFeatures) => {
  const coords = pointFeature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const px = Number(coords[0]);
  const py = Number(coords[1]);
  if (!isFinite(px) || !isFinite(py)) return null;

  let best = { distSq: Infinity, bearing: null };

  (lineFeatures || []).forEach((f) => {
    const g = f?.geometry;
    if (!g) return;
    if (g.type === 'LineString') {
      const arr = g.coordinates || [];
      for (let i = 0; i < arr.length - 1; i++) {
        const [ax, ay] = arr[i];
        const [bx, by] = arr[i + 1];
        const dSq = pointToSegmentDistanceSq(px, py, ax, ay, bx, by);
        if (dSq < best.distSq) {
          best.distSq = dSq;
          best.bearing = computeBearingDegrees(ax, ay, bx, by);
        }
      }
    } else if (g.type === 'MultiLineString') {
      const m = g.coordinates || [];
      m.forEach(arr => {
        for (let i = 0; i < arr.length - 1; i++) {
          const [ax, ay] = arr[i];
          const [bx, by] = arr[i + 1];
          const dSq = pointToSegmentDistanceSq(px, py, ax, ay, bx, by);
          if (dSq < best.distSq) {
            best.distSq = dSq;
            best.bearing = computeBearingDegrees(ax, ay, bx, by);
          }
        }
      });
    }
  });

  return best.bearing == null ? null : ((Math.round(best.bearing * 1000) / 1000) + 360) % 360; // stable rounding
};

/**
 * Ensure a set of angle-variant PNG images are added to the map.
 * Each sprite will be registered under an ID derived from baseName (e.g., "linknyc_090").
 */
export const addEnhancedSpritesToMap = async (map, options) => {
  const { baseName, publicDir, angles = [0,45,90,135,180,225,270,315] } = options || {};
  if (!map || !baseName || !publicDir) return;

  // Load each angle variant via DOM Image
  await Promise.all(angles.map((angle) => new Promise((resolve) => {
    const id = `${baseName}_${padAngle(angle)}`;
    try {
      if (map.hasImage && map.hasImage(id)) {
        resolve(true);
        return;
      }
    } catch (_) {}
    const url = `${publicDir}/${baseName}_${padAngle(angle)}.png`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        if (map.hasImage && map.hasImage(id)) {
          resolve(true);
          return;
        }
        map.addImage(id, img);
      } catch (_) {}
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = url;
  })));
};

/**
 * Build the image ID for a given quantized angle using the configured baseName.
 */
export const buildSpriteImageId = (baseName, angle) => `${baseName}_${padAngle(angle)}`;


