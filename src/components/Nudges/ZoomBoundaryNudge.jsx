// src/components/Nudges/ZoomBoundaryNudge.jsx
// Purpose: Display a contextual warning when user attempts to zoom out past focus boundary
// Linked files:
// - Triggered by zoom event handler in `src/hooks/usePermitAreas.js`
// - Follows same pattern as `src/components/Modals/ConfirmModal.jsx`

import React, { useEffect, useCallback } from 'react';
import { useGlobalKeymap } from '../../hooks/useGlobalKeymap';

const ZoomBoundaryNudge = ({ isOpen, onContinue, onCancel }) => {
  const handleKeyDown = useCallback((e) => {
    // Block zoom-related keys while open; allow Escape to cancel
    if (!isOpen) return;
    const key = e.key;
    const isZoomKey = key === '+' || key === '=' || key === '-' || key === '_' || key === '0' || key === 'PageUp' || key === 'PageDown';
    if (isZoomKey || e.ctrlKey || e.metaKey) {
      try { e.preventDefault(); } catch (_) {}
      try { e.stopPropagation(); } catch (_) {}
    }
    if (key === 'Escape') {
      try { e.preventDefault(); } catch (_) {}
      onCancel && onCancel();
    }
  }, [isOpen, onCancel]);

  const preventScroll = useCallback((e) => {
    if (!isOpen) return;
    try { e.preventDefault(); } catch (_) {}
    try { e.stopPropagation(); } catch (_) {}
    return false;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    // Capture and block wheel/touch/gesture while the modal is open
    window.addEventListener('wheel', preventScroll, { passive: false, capture: true });
    window.addEventListener('touchmove', preventScroll, { passive: false, capture: true });
    window.addEventListener('gesturestart', preventScroll, { passive: false, capture: true });
    window.addEventListener('gesturechange', preventScroll, { passive: false, capture: true });
    return () => {
      window.removeEventListener('wheel', preventScroll, { capture: true });
      window.removeEventListener('touchmove', preventScroll, { capture: true });
      window.removeEventListener('gesturestart', preventScroll, { capture: true });
      window.removeEventListener('gesturechange', preventScroll, { capture: true });
    };
  }, [isOpen, preventScroll]);

  useGlobalKeymap([
    isOpen ? {
      key: ['+', '=', '-', '_', '0', 'PageUp', 'PageDown', 'Escape'],
      preventDefault: true,
      stop: true,
      priority: 110,
      onEvent: (e) => handleKeyDown(e)
    } : null
  ]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[900] pointer-events-auto"
      onWheel={preventScroll}
      onTouchMove={preventScroll}
    >
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-auto">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden pointer-events-auto animate-bounce-in" role="dialog" aria-modal="true">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20">
            <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
              ⚠️ Zoom Boundary
            </h2>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              Zooming out further will make designing your site plan hard to see. Do you want to continue zooming out?
            </p>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-end space-x-3">
            <button 
              onClick={onCancel} 
              className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Stay Here
            </button>
            <button 
              onClick={onContinue} 
              className="px-4 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors"
            >
              Continue Zooming Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZoomBoundaryNudge;

