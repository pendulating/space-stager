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
  const hasSelectedRectRef = useRef(!!hasSelectedRect);
  const hasSelectedPointRef = useRef(!!hasSelectedPoint);
  const hasSelectedAnnotationRef = useRef(!!hasSelectedAnnotation);
  const isPlacementActiveRef = useRef(!!isPlacementActive);
  const mapRef = useRef(map);

  useEffect(() => {
    rotateRectRef.current = rotateSelectedRectBy;
    rotatePointRef.current = rotateSelectedPointBy;
    rotatePlacementRef.current = rotatePlacementStep;
    rotateAnnotationRef.current = rotateSelectedAnnotationBy;
    clearSelectionRef.current = clearSelection;
    hasSelectedRectRef.current = !!hasSelectedRect;
    hasSelectedPointRef.current = !!hasSelectedPoint;
    hasSelectedAnnotationRef.current = !!hasSelectedAnnotation;
    isPlacementActiveRef.current = !!isPlacementActive;
    mapRef.current = map;
  });
  // Engine state and helpers (refs ensure stability across renders)
  const rafIdRef = useRef(null);
  const activeDirRef = useRef(0); // -1 CCW, +1 CW
  const lastTsRef = useRef(0);
  const startTsRef = useRef(0);
  const gesturesLockedRef = useRef(false);

  const disableMapRotationGestures = () => {
    if (gesturesLockedRef.current) return;
    const m = mapRef.current;
    try { if (m && m.dragRotate && typeof m.dragRotate.disable === 'function') m.dragRotate.disable(); } catch (_) {}
    try { if (m && m.touchZoomRotate && typeof m.touchZoomRotate.disableRotation === 'function') m.touchZoomRotate.disableRotation(); } catch (_) {}
    try { if (m && m.keyboard && typeof m.keyboard.disable === 'function') m.keyboard.disable(); } catch (_) {}
    gesturesLockedRef.current = true;
  };
  const enableMapRotationGestures = () => {
    if (!gesturesLockedRef.current) return;
    const m = mapRef.current;
    try { if (m && m.dragRotate && typeof m.dragRotate.enable === 'function') m.dragRotate.enable(); } catch (_) {}
    try { if (m && m.touchZoomRotate && typeof m.touchZoomRotate.enableRotation === 'function') m.touchZoomRotate.enableRotation(); } catch (_) {}
    try { if (m && m.keyboard && typeof m.keyboard.enable === 'function') m.keyboard.enable(); } catch (_) {}
    gesturesLockedRef.current = false;
  };

  const targetDegreesPerSecond = 180;
  const accelerationTime = 0.3;

  const step = (ts) => {
    if ((!hasSelectedRectRef.current && !hasSelectedPointRef.current) || activeDirRef.current === 0) {
      if (gesturesLockedRef.current) enableMapRotationGestures();
      rafIdRef.current = null;
      return;
    }
    if (!lastTsRef.current) {
      lastTsRef.current = ts;
      startTsRef.current = ts;
      rafIdRef.current = requestAnimationFrame(step);
      return;
    }
    const dt = Math.max(0, (ts - lastTsRef.current) / 1000);
    const elapsed = (ts - startTsRef.current) / 1000;
    lastTsRef.current = ts;
    const progress = Math.min(elapsed / accelerationTime, 1);
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const currentSpeed = targetDegreesPerSecond * easedProgress;
    const delta = activeDirRef.current * currentSpeed * dt;
    try {
      if (hasSelectedRectRef.current && typeof rotateRectRef.current === 'function') {
        rotateRectRef.current(delta);
      } else if (hasSelectedPointRef.current && typeof rotatePointRef.current === 'function') {
        rotatePointRef.current(delta);
      }
    } catch (_) {}
    rafIdRef.current = requestAnimationFrame(step);
  };

  const onKeyDownGlobal = (e) => {
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
    const dir = (isPeriod || isRightBracket) ? 1 : -1;
    if (isPlacementActiveRef.current && typeof rotatePlacementRef.current === 'function') {
      try { rotatePlacementRef.current(dir * 45); } catch (_) {}
      return;
    }
    if (hasSelectedRectRef.current && typeof rotateRectRef.current === 'function') {
      if (activeDirRef.current !== dir) {
        lastTsRef.current = 0;
        startTsRef.current = 0;
        activeDirRef.current = dir;
        disableMapRotationGestures();
        if (rafIdRef.current == null) rafIdRef.current = requestAnimationFrame(step);
      }
      return;
    }
    if (hasSelectedPointRef.current && typeof rotatePointRef.current === 'function') {
      if (activeDirRef.current !== dir) {
        lastTsRef.current = 0;
        startTsRef.current = 0;
        activeDirRef.current = dir;
        disableMapRotationGestures();
        if (rafIdRef.current == null) rafIdRef.current = requestAnimationFrame(step);
      }
      return;
    }
    if (hasSelectedAnnotationRef.current && typeof rotateAnnotationRef.current === 'function') {
      try { rotateAnnotationRef.current(dir * 12); } catch (_) {}
      return;
    }
  };

  const onKeyUpGlobal = (e) => {
    const isComma = e.code === 'Comma' || e.key === ',' || e.key === '<';
    const isPeriod = e.code === 'Period' || e.key === '.' || e.key === '>';
    const isLeftBracket = e.code === 'BracketLeft' || e.key === '[';
    const isRightBracket = e.code === 'BracketRight' || e.key === ']';
    if (!(isComma || isPeriod || isLeftBracket || isRightBracket)) return;
    if (hasSelectedRectRef.current || hasSelectedPointRef.current) {
      activeDirRef.current = 0;
      lastTsRef.current = 0;
      startTsRef.current = 0;
      enableMapRotationGestures();
      if (rafIdRef.current != null) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
    }
  };

  // Register global key handlers via DOM listeners to avoid nested hook usage here
  useEffect(() => {
    const keydown = (e) => { try { onKeyDownGlobal(e); } catch (_) {} };
    const keyup = (e) => { try { onKeyUpGlobal(e); } catch (_) {} };
    window.addEventListener('keydown', keydown, { passive: false, capture: true });
    window.addEventListener('keyup', keyup, { passive: false, capture: true });
    return () => {
      try { window.removeEventListener('keydown', keydown, true); } catch (_) {}
      try { window.removeEventListener('keyup', keyup, true); } catch (_) {}
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
    try { enableMapRotationGestures(); } catch (_) {}
  }, []);
};


