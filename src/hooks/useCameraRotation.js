import { useEffect, useRef } from 'react';
import { computeAreaOrientation, getCenterOffsetForPitch } from '../utils/bearingUtils';
import { quantizeToSlices } from '../utils/enhancedRenderingUtils';

/**
 * useCameraRotation
 * Centralize camera rotation controls:
 *  - Q/E keyboard steps (45° increments) with view-dependent anchoring
 *  - rotateend snapping to nearest 45° with view-dependent center offset
 *
 * options:
 *  - map: MapLibre/Mapbox map instance (required)
 *  - getAreaGeometry: () => GeoJSON geometry | null (optional)
 *  - isEnabled?: boolean (default true)
 */
export const useCameraRotation = ({ map, getAreaGeometry, isEnabled = true } = {}) => {
  const suppressRotateSnapRef = useRef(false);
  const lastDiscreteBearingRef = useRef(null);
  const lastThetaRef = useRef(null);
  const lastIsoRef = useRef(null);

  // Keyboard map rotation with snapping relative to area orientation
  useEffect(() => {
    if (!map || !isEnabled) return;

    const onKeyDown = (e) => {
      try {
        const t = e.target;
        const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
        if (typing) return;
        if (e.repeat) return; // exactly one step per press
        const key = (e.key || '').toLowerCase();
        if (key !== 'q' && key !== 'e') return;
        e.preventDefault();
        const dir = key === 'e' ? 1 : -1; // CW for E, CCW for Q

        const current = (typeof map.getBearing === 'function') ? map.getBearing() : 0;
        const p = (map.getPitch ? map.getPitch() : 0);
        const isIso = p > 15;
        const areaGeom = (typeof getAreaGeometry === 'function') ? (getAreaGeometry() || null) : null;
        const theta = areaGeom ? computeAreaOrientation({ map, geometry: areaGeom, pitch: p }) : 0;

        let base = lastDiscreteBearingRef.current;
        // Re-anchor to current grid if:
        //  - no baseline yet
        //  - user rotated away from last discrete bearing
        //  - view type changed (isometric vs top-down)
        //  - dominant area orientation changed materially (>= 1°)
        const diffFromLast = (base == null) ? Infinity : Math.abs((((current - base) % 360) + 540) % 360 - 180);
        const prevIso = lastIsoRef.current;
        const prevTheta = lastThetaRef.current;
        const thetaDrift = (prevTheta == null) ? 0 : Math.abs((((theta - prevTheta) % 360) + 540) % 360 - 180);
        const needsReanchor = (base == null) || (diffFromLast > 2) || (prevIso != null && prevIso !== isIso) || (prevTheta != null && thetaDrift > 1);
        if (needsReanchor) {
          const centerOffset = getCenterOffsetForPitch(p);
          base = quantizeToSlices(current, 8, centerOffset);
        }

        lastIsoRef.current = isIso;
        lastThetaRef.current = theta;

        const target = ((base + dir * 45) % 360 + 360) % 360;
        try { if (typeof map.stop === 'function') map.stop(); } catch (_) {}
        try {
          suppressRotateSnapRef.current = true;
          lastDiscreteBearingRef.current = target;
          map.easeTo({ bearing: target, duration: 180, essential: true });
        } catch (_) {
          suppressRotateSnapRef.current = false;
        }
      } catch (_) {}
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => { window.removeEventListener('keydown', onKeyDown); };
  }, [map, getAreaGeometry, isEnabled]);

  // Snap free-rotate interactions on rotateend to nearest 45°
  useEffect(() => {
    if (!map || !isEnabled) return;
    const onRotateEnd = () => {
      try {
        if (suppressRotateSnapRef.current) { suppressRotateSnapRef.current = false; return; }
        const current = (typeof map.getBearing === 'function') ? map.getBearing() : 0;
        const p = (map.getPitch ? map.getPitch() : 0);
        const centerOffset = getCenterOffsetForPitch(p);
        const absQ = quantizeToSlices(current, 8, centerOffset);
        const delta = Math.abs((((absQ - current) % 360) + 540) % 360 - 180);
        if (delta > 0.5) {
          try { lastDiscreteBearingRef.current = absQ; map.rotateTo(absQ, { duration: 120 }); } catch (_) {}
        }
      } catch (_) {}
    };
    try { map.on('rotateend', onRotateEnd); } catch (_) {}
    return () => { try { map.off('rotateend', onRotateEnd); } catch (_) {} };
  }, [map, isEnabled]);
};

export default useCameraRotation;


