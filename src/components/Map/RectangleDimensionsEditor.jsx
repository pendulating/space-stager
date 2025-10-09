import React, { useEffect, useMemo, useRef, useState } from 'react';

const RectangleDimensionsEditor = ({ map, object, placeableObjects, onSave, onCancel, objectUpdateTrigger }) => {
  const objectType = placeableObjects?.find(p => p.id === object?.type);
  const units = objectType?.units || 'ft';
  
  // Get current dimensions from object
  const currentDims = object?.properties?.dimensions || object?.properties?.user_dimensions_m || {};
  const currentWidthMeters = currentDims.width || 0;
  const currentHeightMeters = currentDims.height || 0;
  
  // Convert to display units (feet or meters)
  const metersToDisplayUnits = (m) => units === 'ft' ? m * 3.28084 : m;
  const displayUnitsToMeters = (d) => units === 'ft' ? d / 3.28084 : d;
  
  const [width, setWidth] = useState(Math.round(metersToDisplayUnits(currentWidthMeters)));
  const [height, setHeight] = useState(Math.round(metersToDisplayUnits(currentHeightMeters)));
  const containerRef = useRef(null);

  useEffect(() => {
    setWidth(Math.round(metersToDisplayUnits(currentWidthMeters)));
    setHeight(Math.round(metersToDisplayUnits(currentHeightMeters)));
  }, [object?.id, currentWidthMeters, currentHeightMeters]);

  const style = useMemo(() => {
    if (!map || !object) return { display: 'none' };
    try {
      // Position at the center of the rectangle
      const centroid = object.position || { lng: 0, lat: 0 };
      const p = map.project([centroid.lng, centroid.lat]);
      return {
        position: 'absolute',
        left: p.x,
        top: p.y - 40,
        transform: 'translate(-50%, -100%)',
        zIndex: 2000,
        pointerEvents: 'auto'
      };
    } catch (_) {
      return { display: 'none' };
    }
  }, [map, object, objectUpdateTrigger]);

  const handleSave = () => {
    const widthMeters = displayUnitsToMeters(Number(width) || 0);
    const heightMeters = displayUnitsToMeters(Number(height) || 0);
    if (onSave) onSave(widthMeters, heightMeters);
  };

  return (
    <div ref={containerRef} style={style} className="max-w-sm">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200">
          Set Dimensions
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 dark:text-gray-300 w-12">Width:</label>
            <input
              type="number"
              min="1"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              className="flex-1 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
              placeholder="Width"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">{units}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 dark:text-gray-300 w-12">Height:</label>
            <input
              type="number"
              min="1"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="flex-1 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
              placeholder="Height"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">{units}</span>
          </div>
        </div>
        <div className="px-3 pb-2 flex justify-end gap-2">
          <button 
            onClick={onCancel} 
            className="px-3 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default RectangleDimensionsEditor;


