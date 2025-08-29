import { useCallback } from 'react';

/**
 * useSelectionController
 * Centralizes selection hit-tests for rectangles (polygon contains) and enhanced point objects (proximity).
 *
 * Args:
 *  - map: MapLibre/Mapbox map instance
 *  - placeableObjects: catalog array
 *  - droppedObjects: current objects array
 *  - isPlacementActive: boolean (skip selection when placing)
 *  - setSelectedRectId: (id|null)=>void
 *  - setSelectedPointId: (id|null)=>void
 */
export const useSelectionController = ({ map, placeableObjects, droppedObjects, isPlacementActive, setSelectedRectId, setSelectedPointId }) => {
  const pointInPolygon = useCallback((point, ring) => {
    try {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        const intersect = ((yi > point[1]) !== (yj > point[1])) &&
          (point[0] < (xj - xi) * (point[1] - yi) / ((yj - yi) || 1e-12) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    } catch (_) { return false; }
  }, []);

  const handleClick = useCallback((e) => {
    try {
      if (!map || !placeableObjects || !Array.isArray(droppedObjects) || isPlacementActive) return;
      const mapContainer = map.getContainer();
      const rect = mapContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const lngLat = map.unproject([x, y]);
      const pt = [lngLat.lng, lngLat.lat];

      // Rectangles first by containment
      const rectObjs = droppedObjects.filter((o) => {
        const t = placeableObjects.find(p => p.id === o.type);
        return t && t.geometryType === 'rect' && o?.geometry?.type === 'Polygon';
      });
      let hitRectId = null;
      for (let i = 0; i < rectObjs.length; i++) {
        const ring = Array.isArray(rectObjs[i]?.geometry?.coordinates?.[0]) ? rectObjs[i].geometry.coordinates[0] : [];
        if (ring.length >= 4 && pointInPolygon(pt, ring)) { hitRectId = rectObjs[i].id; break; }
      }
      if (hitRectId) {
        setSelectedRectId && setSelectedRectId(hitRectId);
        setSelectedPointId && setSelectedPointId(null);
        return;
      }

      // Points by pixel proximity (non-rect objects)
      const candidates = droppedObjects.filter((o) => {
        const t = placeableObjects.find(p => p.id === o.type);
        return t && t.geometryType !== 'rect';
      });
      if (!candidates.length) { setSelectedPointId && setSelectedPointId(null); return; }
      const zoom = typeof map.getZoom === 'function' ? map.getZoom() : 16;
      const zoomScale = Math.min(1.6, Math.max(0.6, 0.6 + (zoom - 12) * 0.1));
      let best = { id: null, distSq: Infinity };
      for (const obj of candidates) {
        try {
          const t = placeableObjects.find(p => p.id === obj.type);
          if (!t) continue;
          const pixel = map.project([obj.position.lng, obj.position.lat]);
          const baseSize = Math.max(t.size.width, t.size.height, 24);
          const iconSize = baseSize * zoomScale;
          const radius = iconSize / 2;
          const dx = (pixel.x) - x;
          const dy = (pixel.y) - y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= radius * radius && d2 < best.distSq) {
            best = { id: obj.id, distSq: d2 };
          }
        } catch (_) {}
      }
      setSelectedPointId && setSelectedPointId(best.id || null);
      if (best.id) setSelectedRectId && setSelectedRectId(null);
    } catch (_) {}
  }, [map, placeableObjects, droppedObjects, isPlacementActive, pointInPolygon, setSelectedRectId, setSelectedPointId]);

  return { handleClick };
};


