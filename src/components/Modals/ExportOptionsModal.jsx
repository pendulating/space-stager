import React, { useEffect, useState } from 'react';

const ExportOptionsModal = ({ isOpen, onClose, value, onChange }) => {
  const [form, setForm] = useState(value || { includeDimensions: true, dimensionUnits: 'm' });

  useEffect(() => { setForm(value || { includeDimensions: true, dimensionUnits: 'm' }); }, [value, isOpen]);
  if (!isOpen) return null;

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = () => {
    if (onChange) onChange(form);
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Export Options</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Configure optional export settings</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700 dark:text-gray-200">Include dimensions</label>
            <input type="checkbox" className="h-4 w-4" checked={!!form.includeDimensions} onChange={e => update('includeDimensions', e.target.checked)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Dimension units</label>
            <select className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" value={form.dimensionUnits || 'm'} onChange={e => update('dimensionUnits', e.target.value)}>
              <option value="m">Metric (m / km)</option>
              <option value="ft">Imperial (ft / mi)</option>
            </select>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
          <button onClick={handleSave} className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">Save</button>
        </div>
      </div>
    </div>
  );
};

export default ExportOptionsModal;


