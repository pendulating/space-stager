/**
 * Utility functions for object geometry transforms.
 */

export const normalizeAngle = (deg) => ((deg % 360) + 360) % 360;

export const rotateRectanglePolygon = (polygon, deltaDeg) => {
  try {
    if (!polygon || polygon.type !== 'Polygon') return polygon;
    const ring = Array.isArray(polygon.coordinates?.[0]) ? polygon.coordinates[0] : null;
    if (!ring || ring.length < 4) return polygon;
    const corners = ring.slice(0, 4).map(([lng, lat]) => [lng, lat]);
    const cx = (corners[0][0] + corners[2][0]) / 2;
    const cy = (corners[0][1] + corners[2][1]) / 2;
    const rad = (deltaDeg * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const rotatePt = ([x, y]) => {
      const dx = x - cx; const dy = y - cy;
      return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
    };
    const newCorners = corners.map(rotatePt);
    const newRing = [...newCorners, newCorners[0]];
    return { type: 'Polygon', coordinates: [newRing] };
  } catch (_) {
    return polygon;
  }
};

// Rotate a rectangle polygon around its center in SCREEN space (pixels), then unproject back to lng/lat.
// This keeps the visual rectangle axis-aligned with the camera POV (bearing/pitch) and avoids skew artifacts.
export const rotateRectanglePolygonScreen = (map, polygon, deltaDeg) => {
  try {
    if (!map || !polygon || polygon.type !== 'Polygon') return polygon;
    const ring = Array.isArray(polygon.coordinates?.[0]) ? polygon.coordinates[0] : null;
    if (!ring || ring.length < 4) return polygon;
    const corners = ring.slice(0, 4).map(([lng, lat]) => [lng, lat]);
    // Project to pixels
    const pts = corners.map(([lng, lat]) => map.project([lng, lat]));
    const cx = (pts[0].x + pts[2].x) / 2;
    const cy = (pts[0].y + pts[2].y) / 2;
    const rad = (deltaDeg * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const rotatePt = (p) => {
      const dx = p.x - cx; const dy = p.y - cy;
      return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
    };
    const rot = pts.map(rotatePt);
    // Unproject back to lng/lat
    const newCorners = rot.map((p) => {
      const ll = map.unproject([p.x, p.y]);
      return [ll.lng, ll.lat];
    });
    const newRing = [...newCorners, newCorners[0]];
    return { type: 'Polygon', coordinates: [newRing] };
  } catch (_) {
    return polygon;
  }
};

// Rotate a rectangle polygon around its center in Web Mercator (map plane), then convert back to lng/lat.
// This mirrors the annotation rotation fix so perspective/pitch do not skew rotation.
export const rotateRectanglePolygonMercator = (polygon, deltaDeg) => {
  try {
    if (!polygon || polygon.type !== 'Polygon') return polygon;
    const ring = Array.isArray(polygon.coordinates?.[0]) ? polygon.coordinates[0] : null;
    if (!ring || ring.length < 4) return polygon;
    const corners = ring.slice(0, 4).map(([lng, lat]) => [lng, lat]);
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
    const pts = corners.map(toMerc);
    let cx = 0, cy = 0;
    for (const [x, y] of pts) { cx += x; cy += y; }
    cx /= pts.length; cy /= pts.length;
    const rad = (deltaDeg * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const rotatePt = ([x, y]) => {
      const dx = x - cx; const dy = y - cy;
      const rx = cx + dx * cos - dy * sin;
      const ry = cy + dx * sin + dy * cos;
      return [rx, ry];
    };
    const rotated = pts.map(rotatePt).map(toLngLat);
    const newRing = [...rotated, rotated[0]];
    return { type: 'Polygon', coordinates: [newRing] };
  } catch (_) {
    return polygon;
  }
};


