import React, { useState, useEffect } from 'react';

const SapoWalkthroughModal = ({ isOpen, onClose }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (!isOpen) setDontShowAgain(false);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000]">
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-3xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-fadeIn">
          {/* Close button */}
          <button
            onClick={() => onClose({ dontShowAgain })}
            aria-label="Close walkthrough"
            className="absolute top-3 right-3 rounded-full p-1.5 bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 z-10"
          >
            ✕
          </button>

          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">How to stage plazas and intersections</h3>
          </div>

          {/* Body with GIF */}
          <div className="p-0 bg-black flex items-center justify-center">
            <img
              src="/data/guides/sapo_walkthrough_15fps.gif"
              alt="Step-by-step walkthrough for plazas/intersections"
              className="max-h-[70vh] w-auto object-contain"
            />
          </div>

          {/* Footer controls */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                className="h-3.5 w-3.5"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
              />
              Don't show again
            </label>
            <button
              onClick={() => onClose({ dontShowAgain })}
              className="text-xs px-2.5 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SapoWalkthroughModal;


