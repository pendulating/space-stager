import React, { useEffect, useMemo } from 'react';

const stepsDefault = [
  { key: 'confirm', label: 'Confirming import' },
  { key: 'basemap', label: 'Switching basemap' },
  { key: 'geography', label: 'Preparing geography' },
  { key: 'focus', label: 'Focusing permit area' },
  { key: 'subfocus', label: 'Applying sub-area focus' },
  { key: 'layers', label: 'Restoring layers' },
  { key: 'shapes', label: 'Restoring annotations' },
  { key: 'objects', label: 'Restoring objects' },
  { key: 'finalize', label: 'Finalizing' }
];

const ImportProgressModal = ({ isOpen, currentStepKey, message, steps = stepsDefault, onCancel }) => {
  const idx = useMemo(() => Math.max(0, steps.findIndex(s => s.key === currentStepKey)), [steps, currentStepKey]);
  const progress = useMemo(() => Math.round(((idx + 1) / steps.length) * 100), [idx, steps.length]);

  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e) => { if (e.key === 'Escape') { e.preventDefault(); } };
    window.addEventListener('keydown', onEsc, { passive: false });
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10020]">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Importing site plan…</h2>
          </div>
          <div className="px-6 py-5">
            <div className="mb-3 text-sm text-gray-700 dark:text-gray-200">{steps[idx]?.label || 'Working…'}</div>
            {message && <div className="mb-3 text-xs text-gray-500 dark:text-gray-400">{message}</div>}
            <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
              <div className="h-2 bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 text-right text-xs text-gray-500 dark:text-gray-400">{progress}%</div>
            <ul className="mt-4 space-y-1 max-h-48 overflow-auto text-xs">
              {steps.map((s, i) => (
                <li key={s.key} className={`flex items-center gap-2 ${i <= idx ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>
                  <span className={`inline-block w-2 h-2 rounded-full ${i < idx ? 'bg-green-500' : (i === idx ? 'bg-blue-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-700')}`} />
                  <span>{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-end">
            <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportProgressModal;


