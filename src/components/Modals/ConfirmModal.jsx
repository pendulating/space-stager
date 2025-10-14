import React, { useCallback } from 'react';
import { useGlobalKeymap } from '../../hooks/useGlobalKeymap';

const ConfirmModal = ({ isOpen, title, message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel }) => {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel && onCancel();
    }
  }, [onCancel]);

  useGlobalKeymap([
    isOpen ? {
      key: 'Escape',
      onEvent: (e) => { try { e.preventDefault(); } catch (_) {} onCancel && onCancel(); },
      preventDefault: true,
      priority: 100,
      stop: true
    } : null
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000]">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-gray-700 dark:text-gray-200">{message}</p>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-end space-x-3">
            <button onClick={onCancel} className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">{cancelText}</button>
            <button onClick={onConfirm} className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700">{confirmText}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;


