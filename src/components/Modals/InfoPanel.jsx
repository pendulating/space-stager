import React, { useEffect, useCallback } from 'react';
import { X, Info, Keyboard } from 'lucide-react';

const KEYBINDS = [
  { combo: 'Mouse click', action: 'Place selected object' },
  { combo: 'Esc', action: 'Cancel placement / close modals' },
  { combo: ',', action: 'Flip object horizontally while placing' },
  { combo: '.', action: 'Flip object horizontally while placing' },
  { combo: 'Delete/Backspace', action: 'Remove a placed object (click it)' },
  { combo: 'North button', action: 'Reset compass to North' }
];

const InfoPanel = ({ onClose, showInfo = true }) => {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose && onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (!showInfo) return;
    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showInfo, handleKeyDown]);

  if (!showInfo) return null;

  return (
    <div className="fixed inset-0 z-[1000]">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-blue-50">
            <div className="flex items-center space-x-2">
              <Info className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-blue-900">About NYC Public Space Event Stager</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-md text-blue-700 hover:bg-blue-100"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-6">
            <p className="text-sm text-gray-700">
              Design site plans for NYC public space events. Place equipment, annotate the map, and export a permit-ready plan.
            </p>

            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Keyboard className="w-5 h-5 text-gray-700" />
                <h3 className="text-base font-medium text-gray-900">Keybindings</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {KEYBINDS.map((k) => (
                  <div key={k.combo} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                    <span className="text-sm font-mono text-gray-800">{k.combo}</span>
                    <span className="text-sm text-gray-600">{k.action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfoPanel;
