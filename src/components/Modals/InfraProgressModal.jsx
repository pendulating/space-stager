import React, { useMemo } from 'react';
import { useGlobalKeymap } from '../../hooks/useGlobalKeymap';

const InfraProgressModal = ({ isOpen, total = 0, completed = 0, onCancel }) => {
  const percent = useMemo(() => {
    if (!total || total <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
  }, [total, completed]);

  useGlobalKeymap([
    isOpen ? {
      key: 'Escape',
      onEvent: (e) => { try { e.preventDefault(); } catch (_) {} },
      preventDefault: true,
      priority: 100,
      stop: true
    } : null
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10010]">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Loading infrastructure layers…</h2>
          </div>
          <div className="px-6 py-5">
            <div className="mb-3 text-sm text-gray-700 dark:text-gray-200">Fetching and rendering layers</div>
            <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">{completed}/{total} completed</div>
            <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
              <div className="h-2 bg-blue-600 transition-all" style={{ width: `${percent}%` }} />
            </div>
            <div className="mt-2 text-right text-xs text-gray-500 dark:text-gray-400">{percent}%</div>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-end">
            <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfraProgressModal;


