import { useEffect, useRef } from 'react';

/**
 * useRotationControls
 * Centralized keyboard rotation behavior.
 *
 * options:
 *  - isPlacementActive: boolean
 *  - rotatePlacementStep: (delta45:number)=>void
 *  - hasSelectedRect: boolean
 *  - rotateSelectedRectBy: (deltaDeg:number)=>void // will be called every frame while key held
 *  - hasSelectedPoint: boolean
 *  - rotateSelectedPointBy: (deltaDeg:number)=>void // will be called every frame while key held (continuous in 2D)
 *  - clearSelection?: ()=>void
 *
 * Keyboard bindings (consistent with existing app): , . [ ]
 *  - Rectangles: hold for continuous rotation at 90°/s
 *  - Points (dropped objects): hold for continuous free rotation at 90°/s in 2D mode
 *  - Placement mode: step by 45° per keypress
 */
export const useRotationControls = (options) => {
  const {
    map,
    isPlacementActive,
    rotatePlacementStep,
    hasSelectedRect,
    rotateSelectedRectBy,
    hasSelectedPoint,
    rotateSelectedPointBy,
    clearSelection,
    hasSelectedAnnotation,
    rotateSelectedAnnotationBy
  } = options || {};

  // Use refs for callbacks so useEffect doesn't restart when they change
  const rotateRectRef = useRef(rotateSelectedRectBy);
  const rotatePointRef = useRef(rotateSelectedPointBy);
  const rotatePlacementRef = useRef(rotatePlacementStep);
  const rotateAnnotationRef = useRef(rotateSelectedAnnotationBy);
  const clearSelectionRef = useRef(clearSelection);

  useEffect(() => {
    rotateRectRef.current = rotateSelectedRectBy;
    rotatePointRef.current = rotateSelectedPointBy;
    rotatePlacementRef.current = rotatePlacementStep;
    rotateAnnotationRef.current = rotateSelectedAnnotationBy;
    clearSelectionRef.current = clearSelection;
  });

  useEffect(() => {
    let rafId = null;
    let activeDir = 0; // -1 CCW, +1 CW
    let lastTs = 0;
    let startTs = 0; // Track when rotation started
    const targetDegreesPerSecond = 180; // Target rotation speed
    const accelerationTime = 0.3; // Seconds to reach full speed
    let gesturesLocked = false;

    const disableMapRotationGestures = () => {
      if (gesturesLocked) return;
      try { if (map && map.dragRotate && typeof map.dragRotate.disable === 'function') map.dragRotate.disable(); } catch (_) {}
      try { if (map && map.touchZoomRotate && typeof map.touchZoomRotate.disableRotation === 'function') map.touchZoomRotate.disableRotation(); } catch (_) {}
      try { if (map && map.keyboard && typeof map.keyboard.disable === 'function') map.keyboard.disable(); } catch (_) {}
      gesturesLocked = true;
    };
    const enableMapRotationGestures = () => {
      if (!gesturesLocked) return;
      try { if (map && map.dragRotate && typeof map.dragRotate.enable === 'function') map.dragRotate.enable(); } catch (_) {}
      try { if (map && map.touchZoomRotate && typeof map.touchZoomRotate.enableRotation === 'function') map.touchZoomRotate.enableRotation(); } catch (_) {}
      try { if (map && map.keyboard && typeof map.keyboard.enable === 'function') map.keyboard.enable(); } catch (_) {}
      gesturesLocked = false;
    };

    const step = (ts) => {
      if ((!hasSelectedRect && !hasSelectedPoint) || activeDir === 0) { 
        if (gesturesLocked) enableMapRotationGestures(); 
        rafId = null; 
        return; 
      }
      
      // Initialize timestamps
      if (!lastTs) {
        lastTs = ts;
        startTs = ts;
        rafId = requestAnimationFrame(step);
        return;
      }
      
      const dt = Math.max(0, (ts - lastTs) / 1000);
      const elapsed = (ts - startTs) / 1000;
      lastTs = ts;
      
      // Smooth acceleration with easing (ease-out cubic)
      const progress = Math.min(elapsed / accelerationTime, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
      const currentSpeed = targetDegreesPerSecond * easedProgress;
      
      const delta = activeDir * currentSpeed * dt;
      try { 
        if (hasSelectedRect && typeof rotateRectRef.current === 'function') {
          rotateRectRef.current(delta);
        } else if (hasSelectedPoint && typeof rotatePointRef.current === 'function') {
          rotatePointRef.current(delta);
        }
      } catch (_) {}
      rafId = requestAnimationFrame(step);
    };

    const onKeyDown = (e) => {
      // Ignore when typing
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (typing) return;

      const isComma = e.code === 'Comma' || e.key === ',' || e.key === '<';
      const isPeriod = e.code === 'Period' || e.key === '.' || e.key === '>';
      const isLeftBracket = e.code === 'BracketLeft' || e.key === '[';
      const isRightBracket = e.code === 'BracketRight' || e.key === ']';
      const isEsc = e.key === 'Escape';
      if (isEsc) { try { clearSelectionRef.current && clearSelectionRef.current(); } catch (_) {} return; }
      if (!(isComma || isPeriod || isLeftBracket || isRightBracket)) return;
      e.preventDefault();

      const dir = (isPeriod || isRightBracket) ? 1 : -1;

      if (isPlacementActive && typeof rotatePlacementRef.current === 'function') {
        // Uniform 8-slice rotation for placement
        try { rotatePlacementRef.current(dir * 45); } catch (_) {}
        return;
      }

      if (hasSelectedRect && typeof rotateRectRef.current === 'function') {
        // Smooth acceleration to continuous rotation
        if (activeDir !== dir) {
          // Reset timestamps when starting fresh or changing direction
          lastTs = 0;
          startTs = 0;
          activeDir = dir;
          disableMapRotationGestures();
          if (rafId == null) rafId = requestAnimationFrame(step);
        }
        // Don't process repeated keydown events while already rotating in same direction
        return;
      }

      if (hasSelectedPoint && typeof rotatePointRef.current === 'function') {
        // Continuous free rotation for dropped objects (same as rectangles)
        if (activeDir !== dir) {
          // Reset timestamps when starting fresh or changing direction
          lastTs = 0;
          startTs = 0;
          activeDir = dir;
          disableMapRotationGestures();
          if (rafId == null) rafId = requestAnimationFrame(step);
        }
        // Don't process repeated keydown events while already rotating in same direction
        return;
      }

      if (hasSelectedAnnotation && typeof rotateAnnotationRef.current === 'function') {
        // Step rotation for annotations (lines/polygons) per keypress
        try { rotateAnnotationRef.current(dir * 12); } catch (_) {}
        return;
      }
    };

    const onKeyUp = (e) => {
      const isComma = e.code === 'Comma' || e.key === ',' || e.key === '<';
      const isPeriod = e.code === 'Period' || e.key === '.' || e.key === '>';
      const isLeftBracket = e.code === 'BracketLeft' || e.key === '[';
      const isRightBracket = e.code === 'BracketRight' || e.key === ']';
      if (!(isComma || isPeriod || isLeftBracket || isRightBracket)) return;
      e.preventDefault();
      if (hasSelectedRect || hasSelectedPoint) {
        activeDir = 0;
        lastTs = 0;
        startTs = 0;
        enableMapRotationGestures();
        if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
      }
    };

    window.addEventListener('keydown', onKeyDown, { passive: false, capture: true });
    window.addEventListener('keyup', onKeyUp, { passive: false, capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      if (rafId != null) cancelAnimationFrame(rafId);
      try { enableMapRotationGestures(); } catch (_) {}
    };
  }, [map, isPlacementActive, hasSelectedRect, hasSelectedPoint, hasSelectedAnnotation]);
};


