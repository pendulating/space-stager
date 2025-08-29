import { useEffect, useRef, useState } from 'react';
import { getMapViewType } from '../utils/enhancedRenderingUtils';

/**
 * useMapViewState
 * Exposes { zoom, bearing, pitch, viewType, renderTick } for a MapLibre/Mapbox map.
 * - Subscribes primarily to 'render' and coalesces updates via requestAnimationFrame
 * - Also listens to basic camera events to ensure state updates if render is throttled
 * - Cleans up listeners and pending RAF on unmount or map/style changes
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
      if (
        prev.zoom !== nextCore.zoom ||
        prev.bearing !== nextCore.bearing ||
        prev.pitch !== nextCore.pitch ||
        prev.viewType !== nextCore.viewType ||
        prev.centerLng !== nextCore.centerLng ||
        prev.centerLat !== nextCore.centerLat
      ) {
        const next = { ...nextCore, renderTick: prev.renderTick + 1 };
        latestRef.current = next;
        setState(next);
      }
    };

    const schedule = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(flush);
    };

    // For tight camera-following, flush immediately on 'render'
    const onRender = () => flush();
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


