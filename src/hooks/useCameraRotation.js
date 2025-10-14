import { useEffect, useRef } from 'react';
import { useGlobalKeymap } from './useGlobalKeymap';
import { computeAreaOrientation } from '../utils/bearingUtils';

/**
 * useCameraRotation
 * Centralize camera rotation controls:
 *  - Q/E keyboard nudge with smooth continuous rotation (no snapping)
 *  - rotateend leaves bearing as-is (no forced snap)
 *
 * options:
 *  - map: MapLibre/Mapbox map instance (required)
 *  - getAreaGeometry: () => GeoJSON geometry | null (optional)
 *  - isEnabled?: boolean (default true)
 */
export const useCameraRotation = ({ map, getAreaGeometry, isEnabled = true } = {}) => {
  const suppressSnapRef = useRef(false);
  const lastBearingRef = useRef(null);
  const lastThetaRef = useRef(null);
  const lastIsoRef = useRef(null);
  const activeDirRef = useRef(0);
  const lastDirRef = useRef(0);
  const rafIdRef = useRef(null);
  const lastFrameTsRef = useRef(0);
  const remainingBurstRef = useRef(0);

  const stopContinuousRotation = () => {
    activeDirRef.current = 0;
    lastDirRef.current = 0;
    lastFrameTsRef.current = 0;
    remainingBurstRef.current = 0;
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  };

  const stepContinuousRotation = (ts) => {
    try {
      if (!map) { stopContinuousRotation(); return; }
      const dir = activeDirRef.current || lastDirRef.current;
      if (!dir) { stopContinuousRotation(); return; }
      const prevTs = lastFrameTsRef.current || ts;
      lastFrameTsRef.current = ts;
      const dt = Math.max(0, (ts - prevTs) / 1000);
      if (!dt) {
        rafIdRef.current = requestAnimationFrame(stepContinuousRotation);
        return;
      }
      const bearing = (typeof map.getBearing === 'function') ? map.getBearing() : 0;
      const pitch = (typeof map.getPitch === 'function') ? map.getPitch() : 0;
      const isIso = pitch > 15;
      const speed = isIso ? 60 : 45; // degrees per second
      let delta = dir * speed * dt;
      if (remainingBurstRef.current > 0) {
        const maxBurst = Math.min(remainingBurstRef.current, Math.abs(delta));
        const applied = maxBurst > 0 ? dir * maxBurst : 0;
        if (Math.abs(delta) > maxBurst) {
          delta = dir * maxBurst;
        } else {
          delta = applied;
        }
        remainingBurstRef.current = Math.max(0, remainingBurstRef.current - Math.abs(delta));
      } else if (!activeDirRef.current) {
        stopContinuousRotation();
        return;
      }
      if (delta === 0) {
        rafIdRef.current = requestAnimationFrame(stepContinuousRotation);
        return;
      }
      const next = ((bearing + delta) % 360 + 360) % 360;
      suppressSnapRef.current = true;
      if (typeof map.setBearing === 'function') {
        map.setBearing(next);
      } else if (typeof map.rotateTo === 'function') {
        map.rotateTo(next, { duration: 0, essential: true });
      }
      lastDirRef.current = dir;
      rafIdRef.current = requestAnimationFrame(stepContinuousRotation);
    } catch (err) {
      stopContinuousRotation();
    }
  };

  // Keyboard map rotation with snapping relative to area orientation
  useGlobalKeymap([
    (!map || !isEnabled) ? null : {
      key: ['q', 'Q', 'e', 'E'],
      preventDefault: true,
      priority: 70,
      enabled: () => {
        const ae = typeof document !== 'undefined' ? document.activeElement : null;
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return false;
        return true;
      },
      onEvent: (e) => {
        try {
          if (!map || !isEnabled) return;
          if (e && e.repeat) return;
          const key = (e.key || '').toLowerCase();
          if (key !== 'q' && key !== 'e') return;
          const dir = key === 'e' ? 1 : -1; // CW for E, CCW for Q
          const p = (map.getPitch ? map.getPitch() : 0);
          const isIso = p > 15;
          const areaGeom = (typeof getAreaGeometry === 'function') ? (getAreaGeometry() || null) : null;
          const theta = areaGeom ? computeAreaOrientation({ map, geometry: areaGeom, pitch: p }) : 0;
          lastIsoRef.current = isIso;
          lastThetaRef.current = theta;
          const baseBurst = Math.abs(isIso ? 12 : 8);
          remainingBurstRef.current = baseBurst;
          try { if (typeof map.stop === 'function') map.stop(); } catch (_) {}
          suppressSnapRef.current = true;
          activeDirRef.current = dir;
          lastDirRef.current = dir;
          lastFrameTsRef.current = 0;
          if (rafIdRef.current == null) {
            rafIdRef.current = requestAnimationFrame(stepContinuousRotation);
          }
        } catch (_) {}
      }
    }
  ]);

  useGlobalKeymap([
    (!map || !isEnabled) ? null : {
      type: 'keyup',
      key: ['q', 'Q', 'e', 'E'],
      preventDefault: true,
      priority: 70,
      onEvent: () => {
        try {
          activeDirRef.current = 0;
          if (!remainingBurstRef.current) stopContinuousRotation();
        } catch (_) {}
      }
    }
  ]);

  // After rotateend, persist final bearing without snapping
  useEffect(() => {
    if (!map || !isEnabled) return;
    const onRotateEnd = () => {
      try {
        if (suppressSnapRef.current || activeDirRef.current) { suppressSnapRef.current = false; return; }
        const current = (typeof map.getBearing === 'function') ? map.getBearing() : 0;
        lastBearingRef.current = current;
      } catch (_) {}
    };
    try { map.on('rotateend', onRotateEnd); } catch (_) {}
    return () => { try { map.off('rotateend', onRotateEnd); } catch (_) {} };
  }, [map, isEnabled]);
};

export default useCameraRotation;



