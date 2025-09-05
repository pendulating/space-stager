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
 * Quantize to nearest 90-degree bucket (0,90,180,270) to favor parallel/perpendicular alignment.
 */
export const quantizeAngleTo90 = (angleDeg) => {
  const a = ((angleDeg % 360) + 360) % 360;
  const q = Math.round(a / 90) * 90;
  return (q + 360) % 360;
};

/**
 * Snap an angle to the nearest increment step (default 45°).
 * Returns a normalized angle in [0, 360).
 */
export const snapToNearest = (angleDeg, step = 45) => {
  const a = ((Number(angleDeg) % 360) + 360) % 360;
  const s = Math.max(1, Math.abs(Number(step) || 45));
  const q = Math.round(a / s) * s;
  return ((q % 360) + 360) % 360;
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
  const { baseName, publicDir, angles = [0,45,90,135,180,225,270,315], viewType, urlBuilder, replaceExisting = false } = options || {};
  if (!map || !baseName || !publicDir) return;

  // Load each angle variant via DOM Image
  await Promise.all(angles.map((angle) => new Promise((resolve) => {
    const id = `${baseName}_${padAngle(angle)}`;
    try {
      if (map.hasImage && map.hasImage(id)) {
        if (replaceExisting) {
          try { map.removeImage(id); } catch (_) {}
        } else {
          resolve(true);
          return;
        }
      }
    } catch (_) {}
    const urls = [];
    if (typeof urlBuilder === 'function') {
      urls.push(urlBuilder(baseName, angle, viewType));
      // Fallback to isometric if top-down missing
      if (viewType === VIEW_TYPES.TOP_DOWN) urls.push(urlBuilder(baseName, angle, VIEW_TYPES.ISOMETRIC));
    } else if (publicDir) {
      urls.push(`${publicDir}/${baseName}_${padAngle(angle)}.png`);
    }
    // Legacy fallback
    urls.push(`/data/icons/isometric-bw/${baseName}_${padAngle(angle)}.png`);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const has = map.hasImage && map.hasImage(id);
        if (replaceExisting && has) {
          if (typeof map.updateImage === 'function') {
            try { map.updateImage(id, img); } catch (_) { try { map.removeImage(id); map.addImage(id, img); } catch (__) {} }
          } else {
            try { map.removeImage(id); } catch (_) {}
            try { map.addImage(id, img); } catch (_) {}
          }
        } else if (!has) {
          map.addImage(id, img);
        } // else has and !replaceExisting → keep existing
      } catch (_) {}
      resolve(true);
    };
    let i = 0;
    img.onerror = () => {
      i += 1;
      if (i < urls.length) {
        img.src = urls[i];
      } else {
        resolve(false);
      }
    };
    img.src = urls[i];
  })));
};

/**
 * Build the image ID for a given quantized angle using the configured baseName.
 */
export const buildSpriteImageId = (baseName, angle) => `${baseName}_${padAngle(angle)}`;

// View type helpers
export const VIEW_TYPES = { ISOMETRIC: 'isometric', TOP_DOWN: 'top-down' };

export const getMapViewType = (mapOrPitch) => {
  if (mapOrPitch == null) return VIEW_TYPES.ISOMETRIC; // default when unknown
  let pitch = 0;
  try {
    if (typeof mapOrPitch === 'number') {
      pitch = mapOrPitch;
    } else if (mapOrPitch && typeof mapOrPitch.getPitch === 'function') {
      pitch = mapOrPitch.getPitch() || 0;
    }
  } catch (_) {}
  return (pitch > 15) ? VIEW_TYPES.ISOMETRIC : VIEW_TYPES.TOP_DOWN;
};

export const buildSpriteUrl = (baseName, angle, viewType = VIEW_TYPES.ISOMETRIC) => {
  const vt = (viewType === VIEW_TYPES.TOP_DOWN) ? VIEW_TYPES.TOP_DOWN : VIEW_TYPES.ISOMETRIC;
  const dir = `/static/${baseName}/${vt}/renders`;
  const file = vt === VIEW_TYPES.TOP_DOWN
    ? `${baseName}_TOP_${padAngle(angle)}.png`
    : `${baseName}_${padAngle(angle)}.png`;
  return `${dir}/${file}`;
};

export const buildLegacyIsometricUrl = (baseName, angle) => `/data/icons/isometric-bw/${baseName}_${padAngle(angle)}.png`;

// Flat public/static structure helper: /static/{base}/{base|base_TOP}_NNN.png
export const buildFlatSpriteUrl = (baseName, angle, viewType = VIEW_TYPES.ISOMETRIC) => {
  const vt = (viewType === VIEW_TYPES.TOP_DOWN) ? VIEW_TYPES.TOP_DOWN : VIEW_TYPES.ISOMETRIC;
  const file = vt === VIEW_TYPES.TOP_DOWN
    ? `${baseName}_TOP_${padAngle(angle)}.png`
    : `${baseName}_${padAngle(angle)}.png`;
  return `/static/${baseName}/${file}`;
};

export const buildSpriteFallbacks = (baseName, angle, viewType = VIEW_TYPES.ISOMETRIC) => {
  const nestedPrimary = buildSpriteUrl(baseName, angle, viewType); // nested view dir
  const nestedIso = buildSpriteUrl(baseName, angle, VIEW_TYPES.ISOMETRIC); // nested iso
  const flat = buildFlatSpriteUrl(baseName, angle, viewType); // flat current view
  const flatIso = buildFlatSpriteUrl(baseName, angle, VIEW_TYPES.ISOMETRIC); // flat iso
  const legacy = buildLegacyIsometricUrl(baseName, angle);
  const chain = [];
  // Prioritize flat structure which matches current public assets
  if (!chain.includes(flat)) chain.push(flat);
  if (!chain.includes(flatIso)) chain.push(flatIso);
  // Then include nested structure as deeper fallbacks
  if (!chain.includes(nestedPrimary)) chain.push(nestedPrimary);
  if (!chain.includes(nestedIso)) chain.push(nestedIso);
  if (!chain.includes(legacy)) chain.push(legacy);
  return chain;
};

/**
 * Choose an angle quantizer based on alignment preference.
 * When aligning to CSCL centerlines, prefer parallel/perpendicular (90° bins).
 * Otherwise, allow 45° bins for more diagonal freedom.
 */
export const chooseAngleQuantizer = (preferRightAngles = false) => (preferRightAngles ? quantizeAngleTo90 : quantizeAngleTo45);



/**
 * Quantize a map bearing to the appropriate step for sprite families.
 * When layers prefer parallel/perpendicular alignment, snap to 90°; otherwise 45°.
 */
export const quantizeBearingForSprites = (bearingDeg, preferRightAngles = false) => {
  const a = ((Number(bearingDeg) % 360) + 360) % 360;
  const q = (preferRightAngles ? quantizeAngleTo90 : quantizeAngleTo45)(a);
  return ((q % 360) + 360) % 360;
};

/**
 * Compute the dominant orientation (bearing) of a Polygon/MultiPolygon geometry.
 * Uses length-weighted average of doubled-angle vectors so direction (0/180) is treated the same.
 * Returns degrees in [0, 360). When invalid, returns 0.
 */
export const computeDominantBearingFromPolygon = (geometry) => {
  try {
    if (!geometry || !geometry.type) return 0;
    const addSegments = (coords) => {
      if (!Array.isArray(coords) || coords.length < 2) return;
      for (let i = 0; i < coords.length - 1; i++) {
        const [ax, ay] = coords[i];
        const [bx, by] = coords[i + 1];
        const metersPerDegLat = 111132;
        const metersPerDegLon = 111320 * Math.cos(((ay + by) / 2) * Math.PI / 180);
        const axm = ax * metersPerDegLon;
        const aym = ay * metersPerDegLat;
        const bxm = bx * metersPerDegLon;
        const bym = by * metersPerDegLat;
        const dx = bxm - axm;
        const dy = bym - aym;
        const len = Math.hypot(dx, dy);
        if (!(len > 0)) continue;
        // Orientation with 0° pointing north, clockwise positive
        const theta = Math.atan2(dx, dy); // radians
        const w = len;
        sumX += w * Math.cos(2 * theta);
        sumY += w * Math.sin(2 * theta);
      }
    };

    let sumX = 0;
    let sumY = 0;
    if (geometry.type === 'Polygon') {
      const rings = geometry.coordinates || [];
      rings.forEach(addSegments);
    } else if (geometry.type === 'MultiPolygon') {
      const polys = geometry.coordinates || [];
      polys.forEach((poly) => {
        (poly || []).forEach(addSegments);
      });
    } else {
      return 0;
    }
    if (sumX === 0 && sumY === 0) return 0;
    const angle = 0.5 * Math.atan2(sumY, sumX); // radians
    let deg = (angle * 180) / Math.PI;
    // Normalize to [0, 360)
    deg = ((deg % 360) + 360) % 360;
    return deg;
  } catch (_) {
    return 0;
  }
};

/**
 * Compute dominant orientation (bearing) in VIEWPORT space for a Polygon/MultiPolygon.
 * 0° = up (toward top of screen), positive clockwise. Requires map.project.
 */
export const computeDominantViewportBearing = (map, geometry) => {
  try {
    if (!map || typeof map.project !== 'function' || !geometry || !geometry.type) return 0;
    const addSegments = (coords) => {
      if (!Array.isArray(coords) || coords.length < 2) return;
      for (let i = 0; i < coords.length - 1; i++) {
        const a = coords[i];
        const b = coords[i + 1];
        const pa = map.project({ lng: a[0], lat: a[1] });
        const pb = map.project({ lng: b[0], lat: b[1] });
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const len = Math.hypot(dx, dy);
        if (!(len > 0)) continue;
        // 0° up (negative y), clockwise positive
        const theta = Math.atan2(dx, -dy);
        sumX += len * Math.cos(2 * theta);
        sumY += len * Math.sin(2 * theta);
      }
    };
    let sumX = 0;
    let sumY = 0;
    if (geometry.type === 'Polygon') {
      (geometry.coordinates || []).forEach(addSegments);
    } else if (geometry.type === 'MultiPolygon') {
      (geometry.coordinates || []).forEach((poly) => (poly || []).forEach(addSegments));
    } else {
      return 0;
    }
    if (sumX === 0 && sumY === 0) return 0;
    const angle = 0.5 * Math.atan2(sumY, sumX);
    let deg = (angle * 180) / Math.PI;
    return ((deg % 360) + 360) % 360;
  } catch (_) {
    return 0;
  }
};

