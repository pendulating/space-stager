import React, { useEffect, useState } from 'react';
import { useGeoclientAuth } from '../../contexts/GeoclientAuthContext.jsx';

const GeoclientSettingsModal = ({ isOpen, onClose }) => {
  const { key, setKey, clearKey, remember } = useGeoclientAuth();
  const [localKey, setLocalKey] = useState('');
  const [localRemember, setLocalRemember] = useState(false);

  useEffect(() => {
    setLocalKey(key || '');
    setLocalRemember(!!remember);
  }, [key, remember, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md shadow-lg w-[420px] max-w-[90vw] p-4">
        <div className="text-base font-semibold mb-1">Geoclient Settings</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">Your key is stored only on this device if you choose Remember.</div>
        <label className="block text-sm mb-1">Subscription Key</label>
        <input
          type="password"
          value={localKey}
          onChange={(e) => setLocalKey(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800"
          placeholder="Paste your key"
        />
        <label className="inline-flex items-center gap-2 mt-3 text-sm">
          <input type="checkbox" checked={localRemember} onChange={(e) => setLocalRemember(e.target.checked)} />
          Remember on this device
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700">Close</button>
          <button onClick={() => { clearKey(); setLocalKey(''); }} className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700">Clear</button>
          <button onClick={() => { setKey(localKey, { remember: localRemember }); onClose && onClose(); }} className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white">Save</button>
        </div>
      </div>
    </div>
  );
};

export default GeoclientSettingsModal;


