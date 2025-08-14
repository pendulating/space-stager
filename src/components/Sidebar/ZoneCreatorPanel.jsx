// src/components/Sidebar/ZoneCreatorPanel.jsx
import React from 'react';
import { useZoneCreatorContext, PRIMARY_TYPES } from '../../contexts/ZoneCreatorContext.jsx';

const TypeButton = ({ value, label, current, onChange }) => (
  <button
    onClick={() => onChange(value)}
    className={`px-3 py-1 rounded-md text-sm border ${current === value ? 'bg-blue-600 text-white border-blue-700' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
  >
    {label}
  </button>
);

const ZoneCreatorPanel = ({ geographyType }) => {
  const { primaryType, setPrimaryType, curbLaneOnly, setCurbLaneOnly, sidewalkOnly, setSidewalkOnly, entireZonePdf, setEntireZonePdf, selectedNodeIds, undoLastNode, clearNodes, widthFeet, setWidthFeet, previewActive, setPreviewActive } = useZoneCreatorContext();
  const isIntersections = geographyType === 'intersections';

  return (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Zone Creator</h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">Intersections mode</span>
      </div>

      {/* Step 1: Permit type */}
      <div className={`space-y-2 mb-3 ${isIntersections ? '' : 'opacity-50 pointer-events-none'}`}>
        <div className="text-xs text-gray-600 dark:text-gray-300">Step 1: Permit Type</div>
        <div className="flex flex-wrap gap-2">
          <TypeButton value={PRIMARY_TYPES.SINGLE_BLOCK} label="Single Block" current={primaryType} onChange={setPrimaryType} />
          <TypeButton value={PRIMARY_TYPES.MULTI_BLOCK} label="Multi-Block" current={primaryType} onChange={setPrimaryType} />
        </div>
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center space-x-2 text-sm">
            <input type="checkbox" className="rounded" checked={curbLaneOnly} onChange={(e) => setCurbLaneOnly(e.target.checked)} />
            <span className="text-gray-700 dark:text-gray-200">Curb Lane Only</span>
          </label>
          <label className="inline-flex items-center space-x-2 text-sm">
            <input type="checkbox" className="rounded" checked={sidewalkOnly} onChange={(e) => setSidewalkOnly(e.target.checked)} />
            <span className="text-gray-700 dark:text-gray-200">Sidewalk Only</span>
          </label>
        </div>
        <label className="inline-flex items-center space-x-2 text-sm">
          <input type="checkbox" className="rounded" checked={entireZonePdf} onChange={(e) => setEntireZonePdf(e.target.checked)} />
          <span className="text-gray-700 dark:text-gray-200">Also export entire zone as one PDF (no legend)</span>
        </label>
      </div>

      {/* Step 2: Node selection */}
      <div className={`space-y-2 ${isIntersections ? '' : 'opacity-50 pointer-events-none'}`}>
        <div className="text-xs text-gray-600 dark:text-gray-300">Step 2: Select intersection nodes in order</div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-700 dark:text-gray-200">Selected: {selectedNodeIds.length}</div>
          <div className="space-x-2">
            <button onClick={undoLastNode} className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">Undo</button>
            <button onClick={clearNodes} className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">Clear</button>
          </div>
        </div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400">
          {primaryType === PRIMARY_TYPES.SINGLE_BLOCK ? 'Pick up to 2 nodes' : 'Pick up to 12 nodes'}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-700 dark:text-gray-200">Zone width (ft)</label>
          <input
            type="number"
            className="w-20 px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700"
            min={6}
            max={200}
            step={2}
            value={widthFeet}
            onChange={(e) => setWidthFeet(Math.max(6, Math.min(200, Number(e.target.value) || 0)))}
          />
        </div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400">Tip: click intersections. ESC cancels.</div>
        <div className="pt-2 flex items-center justify-between">
          {!previewActive ? (
            <button
              className="px-3 py-1.5 rounded-md text-sm bg-blue-600 text-white disabled:opacity-50"
              disabled={(primaryType === PRIMARY_TYPES.SINGLE_BLOCK && selectedNodeIds.length !== 2) || (primaryType === PRIMARY_TYPES.MULTI_BLOCK && (selectedNodeIds.length < 2 || selectedNodeIds.length > 12))}
              onClick={() => {
                const evt = new CustomEvent('zonecreator:generate');
                window.dispatchEvent(evt);
              }}
            >
              Generate Zone
            </button>
          ) : (
            <button
              className="px-3 py-1.5 rounded-md text-sm bg-red-600 text-white"
              onClick={() => {
                const evt = new CustomEvent('zonecreator:reset');
                window.dispatchEvent(evt);
                setPreviewActive(false);
              }}
            >
              Exit Zone
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ZoneCreatorPanel;


