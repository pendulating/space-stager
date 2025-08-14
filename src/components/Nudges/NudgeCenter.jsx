// src/components/Nudges/NudgeCenter.jsx
// Purpose: UI surface for contextual nudges: list, severity, actions (zoom, highlight, dismiss).
// Linked files:
// - Driven by `src/hooks/useNudges.js`
// - Actions call back into map helpers / engine hooks

import React from 'react';

const NudgeCenter = ({ nudges = [], onZoom, onHighlight, onDismiss }) => {
  if (!nudges || nudges.length === 0) {
    // Empty pill state
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded-full shadow border border-gray-200 dark:border-gray-700 px-3 py-1 text-xs text-gray-500 dark:text-gray-300">No nudges</div>
      </div>
    );
  }
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[90%]">
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Contextual Nudges</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{nudges.length}</span>
        </div>
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {nudges.map(n => (
            <div key={n.id} className="flex items-start justify-between gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-200">
                  {n.severity === 'warning' ? '⚠️' : 'ℹ️'} {n.message}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <button className="text-xs text-blue-600 dark:text-blue-300 hover:underline" onClick={() => onZoom?.(n)}>Zoom</button>
                  <button className="text-xs text-gray-600 dark:text-gray-300 hover:underline" onClick={() => onHighlight?.(n)}>Highlight</button>
                  {n.citation && (
                    <a
                      className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                      href={n.citation}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Regulation
                    </a>
                  )}
                </div>
              </div>
              <button className="text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-100" title="Ignore" onClick={() => onDismiss?.(n.id)}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NudgeCenter;


