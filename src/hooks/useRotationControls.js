import { useEffect } from 'react';

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

  useEffect(() => {
    let rafId = null;
    let activeDir = 0; // -1 CCW, +1 CW
    let lastTs = 0;
    const degreesPerSecond = 90;
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
      const dt = lastTs ? Math.max(0, (ts - lastTs) / 1000) : 0;
      lastTs = ts;
      const delta = activeDir * degreesPerSecond * dt;
      try { 
        if (hasSelectedRect && typeof rotateSelectedRectBy === 'function') {
          rotateSelectedRectBy(delta);
        } else if (hasSelectedPoint && typeof rotateSelectedPointBy === 'function') {
          rotateSelectedPointBy(delta);
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
      if (isEsc) { try { clearSelection && clearSelection(); } catch (_) {} return; }
      if (!(isComma || isPeriod || isLeftBracket || isRightBracket)) return;
      e.preventDefault();

      const dir = (isPeriod || isRightBracket) ? 1 : -1;

      if (isPlacementActive && typeof rotatePlacementStep === 'function') {
        // Uniform 8-slice rotation for placement
        try { rotatePlacementStep(dir * 45); } catch (_) {}
        return;
      }

      if (hasSelectedRect && typeof rotateSelectedRectBy === 'function') {
        // Immediate small nudge so a quick tap rotates visibly
        try { rotateSelectedRectBy(dir * 12); } catch (_) {}
        if (activeDir !== dir) {
          activeDir = dir;
          lastTs = 0;
          disableMapRotationGestures();
          if (rafId == null) rafId = requestAnimationFrame(step);
        }
        return;
      }

      if (hasSelectedPoint && typeof rotateSelectedPointBy === 'function') {
        // Continuous free rotation for dropped objects (same as rectangles)
        try { rotateSelectedPointBy(dir * 12); } catch (_) {}
        if (activeDir !== dir) {
          activeDir = dir;
          lastTs = 0;
          disableMapRotationGestures();
          if (rafId == null) rafId = requestAnimationFrame(step);
        }
        return;
      }

      if (hasSelectedAnnotation && typeof rotateSelectedAnnotationBy === 'function') {
        // Step rotation for annotations (lines/polygons) per keypress
        try { rotateSelectedAnnotationBy(dir * 12); } catch (_) {}
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
      if (hasSelectedRect) {
        activeDir = 0;
        lastTs = 0;
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
  }, [map, isPlacementActive, rotatePlacementStep, hasSelectedRect, rotateSelectedRectBy, hasSelectedPoint, rotateSelectedPointBy, hasSelectedAnnotation, rotateSelectedAnnotationBy, clearSelection]);
};


