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
 *  - rotateSelectedPointStep: (delta45:number)=>void
 *  - clearSelection?: ()=>void
 *
 * Keyboard bindings (consistent with existing app): , . [ ]
 *  - Rectangles: hold for continuous rotation at 90°/s
 *  - Enhanced points: step by 45° per keypress
 *  - Placement mode: step by 45° per keypress
 */
export const useRotationControls = (options) => {
  const {
    isPlacementActive,
    rotatePlacementStep,
    hasSelectedRect,
    rotateSelectedRectBy,
    hasSelectedPoint,
    rotateSelectedPointStep,
    clearSelection
  } = options || {};

  useEffect(() => {
    let rafId = null;
    let activeDir = 0; // -1 CCW, +1 CW
    let lastTs = 0;
    const degreesPerSecond = 90;

    const step = (ts) => {
      if (!hasSelectedRect || activeDir === 0) { rafId = null; return; }
      const dt = lastTs ? Math.max(0, (ts - lastTs) / 1000) : 0;
      lastTs = ts;
      const delta = activeDir * degreesPerSecond * dt;
      try { if (typeof rotateSelectedRectBy === 'function') rotateSelectedRectBy(delta); } catch (_) {}
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
        try { rotatePlacementStep(dir * 45); } catch (_) {}
        return;
      }

      if (hasSelectedRect && typeof rotateSelectedRectBy === 'function') {
        // Immediate small nudge so a quick tap rotates visibly
        try { rotateSelectedRectBy(dir * 12); } catch (_) {}
        if (activeDir !== dir) {
          activeDir = dir;
          lastTs = 0;
          if (rafId == null) rafId = requestAnimationFrame(step);
        }
        return;
      }

      if (hasSelectedPoint && typeof rotateSelectedPointStep === 'function') {
        try { rotateSelectedPointStep(dir * 45); } catch (_) {}
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
        if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
      }
    };

    window.addEventListener('keydown', onKeyDown, { passive: false, capture: true });
    window.addEventListener('keyup', onKeyUp, { passive: false, capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [isPlacementActive, rotatePlacementStep, hasSelectedRect, rotateSelectedRectBy, hasSelectedPoint, rotateSelectedPointStep, clearSelection]);
};


