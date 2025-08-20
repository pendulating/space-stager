import React, { useEffect, useState } from 'react';

const ExportOptionsModal = ({ isOpen, onClose, value, onChange }) => {
  const [form, setForm] = useState(value || {
    // Defaults per request
    dimensionUnits: 'ft',
    includeObjectDimensions: true,
    includeZoneDimensions: false,
    includeStreetSidewalkDimensions: false,
    noLegend: false,
    mapProjectionMode: 'topDown'
  });

  useEffect(() => { setForm(value || {
    dimensionUnits: 'ft',
    includeObjectDimensions: true,
    includeZoneDimensions: false,
    includeStreetSidewalkDimensions: false,
    noLegend: false,
    mapProjectionMode: 'topDown'
  }); }, [value, isOpen]);
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
          <div>
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Map projection</div>
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
              <label className="flex items-center justify-between">
                <span>Top-down (recommended)</span>
                <input
                  type="radio"
                  name="projection"
                  className="h-4 w-4"
                  checked={(form.mapProjectionMode || 'topDown') === 'topDown'}
                  onChange={() => update('mapProjectionMode', 'topDown')}
                />
              </label>
              <label className="flex items-center justify-between">
                <span>Use current view (pitch/bearing)</span>
                <input
                  type="radio"
                  name="projection"
                  className="h-4 w-4"
                  checked={(form.mapProjectionMode || 'topDown') === 'current'}
                  onChange={() => update('mapProjectionMode', 'current')}
                />
              </label>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Dimensions</div>
            <div className="space-y-2">
              <label className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-200">
                <span>Object dimensions (e.g., stages)</span>
                <input type="checkbox" className="h-4 w-4" checked={!!form.includeObjectDimensions} onChange={e => update('includeObjectDimensions', e.target.checked)} />
              </label>
              <label className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-200">
                <span>Zone dimensions</span>
                <input type="checkbox" className="h-4 w-4" checked={!!form.includeZoneDimensions} onChange={e => update('includeZoneDimensions', e.target.checked)} />
              </label>
              <label className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-200">
                <span>Street/sidewalk dimensions</span>
                <input type="checkbox" className="h-4 w-4" checked={!!form.includeStreetSidewalkDimensions} onChange={e => update('includeStreetSidewalkDimensions', e.target.checked)} />
              </label>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700 dark:text-gray-200">Entire zone PDF (no legend)</label>
            <input type="checkbox" className="h-4 w-4" checked={!!form.noLegend} onChange={e => update('noLegend', e.target.checked)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Dimension units</label>
            <select className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" value={form.dimensionUnits || 'ft'} onChange={e => update('dimensionUnits', e.target.value)}>
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


