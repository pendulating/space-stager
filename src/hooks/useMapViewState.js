import { useEffect, useRef, useState } from 'react';
import { getMapViewType } from '../utils/enhancedRenderingUtils';

/**
 * useMapViewState
 * Exposes { zoom, bearing, pitch, viewType, renderTick } for a MapLibre/Mapbox map.
 * 
 * PERFORMANCE OPTIMIZATION:
 * - Uses coarse bearing thresholds (1°) to reduce state updates during rotation
 * - Schedules updates via requestAnimationFrame to batch with browser paint
 * - Avoids triggering React re-renders on every frame during continuous rotation
 */
export const useMapViewState = (map) => {
  const [state, setState] = useState(() => {
    const initialPitch = 0;
    return {
      zoom: 0,
      bearing: 0,
      pitch: initialPitch,
      viewType: getMapViewType(initialPitch),
      centerLng: 0,
      centerLat: 0,
      renderTick: 0
    };
  });

  const rafRef = useRef(null);
  const latestRef = useRef(state);

  useEffect(() => {
    latestRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!map) return;
    let mounted = true;

    const sample = () => {
      try {
        const zoom = typeof map.getZoom === 'function' ? map.getZoom() : 0;
        const bearing = typeof map.getBearing === 'function' ? map.getBearing() : 0;
        const pitch = typeof map.getPitch === 'function' ? map.getPitch() : 0;
        let centerLng = 0; let centerLat = 0;
        try {
          const c = typeof map.getCenter === 'function' ? map.getCenter() : null;
          if (c) { centerLng = c.lng || 0; centerLat = c.lat || 0; }
        } catch (_) {}
        const viewType = getMapViewType(pitch);
        return { zoom, bearing, pitch, viewType, centerLng, centerLat };
      } catch (_) {
        return null;
      }
    };

    const flush = () => {
      rafRef.current = null;
      if (!mounted) return;
      const nextCore = sample();
      if (!nextCore) return;
      const prev = latestRef.current;
      
      // PERFORMANCE: Use coarser thresholds for bearing to reduce updates during rotation
      // Bearing: 1° threshold (prevents state updates on every sub-degree change)
      // Zoom/pitch: finer threshold for responsiveness
      // Center: coarse threshold (0.0001° ≈ ~11m at equator)
      const zoomEps = 0.01;
      const bearingEps = 1.0; // 1 degree threshold for bearing changes
      const pitchEps = 0.5;
      const centerEps = 0.0001;
      
      const changed = 
        Math.abs(prev.zoom - nextCore.zoom) > zoomEps ||
        Math.abs(prev.bearing - nextCore.bearing) > bearingEps ||
        Math.abs(prev.pitch - nextCore.pitch) > pitchEps ||
        prev.viewType !== nextCore.viewType ||
        Math.abs(prev.centerLng - nextCore.centerLng) > centerEps ||
        Math.abs(prev.centerLat - nextCore.centerLat) > centerEps;

      if (changed) {
        const next = { ...nextCore, renderTick: prev.renderTick + 1 };
        latestRef.current = next;
        setState(next);
      }
    };

    const schedule = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(flush);
    };

    // PERFORMANCE: Don't flush immediately on every render frame
    // Instead, schedule via RAF to batch updates
    const onRender = () => schedule();
    const onStyleLoad = () => schedule();
    const onBasic = () => schedule();
    const basics = ['move', 'zoom', 'rotate', 'pitch', 'resize'];

    try { map.on('render', onRender); } catch (_) {}
    try { map.on('style.load', onStyleLoad); } catch (_) {}
    basics.forEach((evt) => { try { map.on(evt, onBasic); } catch (_) {} });

    // initial sample
    flush();

    return () => {
      mounted = false;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      try { map.off('render', onRender); } catch (_) {}
      try { map.off('style.load', onStyleLoad); } catch (_) {}
      basics.forEach((evt) => { try { map.off(evt, onBasic); } catch (_) {} });
    };
  }, [map]);

  return state;
};


