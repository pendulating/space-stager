import React, { useCallback } from 'react';
import { Grid3X3 } from 'lucide-react';

const PlaceableObjects = ({ 
  placeableObjects = [], // Add default empty array
  onActivation,
  placementMode
}) => {
  const handleClick = useCallback((e, obj) => {
    // Check if shift is held for batch mode
    const isBatchMode = e.shiftKey;
    onActivation(obj, isBatchMode);
  }, [onActivation]);

  // Early return if no objects to display
  if (!placeableObjects || placeableObjects.length === 0) {
    return (
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          <Grid3X3 className="w-4 h-4 inline mr-2" />
          Equipment & Objects
        </h3>
        <div className="text-xs text-gray-500 text-center py-4">
          No equipment objects available
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-b border-gray-200">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        <Grid3X3 className="w-4 h-4 inline mr-2" />
        Equipment & Objects
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {placeableObjects.map(obj => {
          const isActive = placementMode?.objectType.id === obj.id;
          const isBatchMode = isActive && placementMode.isBatchMode;
          
          return (
            <div
              key={obj.id}
              onClick={(e) => handleClick(e, obj)}
              className={`p-3 rounded-lg transition-all cursor-pointer border-2 ${
                isActive 
                  ? 'bg-blue-100 border-blue-500' 
                  : 'bg-gray-100 hover:bg-gray-200 border-transparent hover:border-blue-300'
              } ${
                isBatchMode ? 'border-4 border-blue-600' : ''
              }`}
              title={`Click to place ${obj.name}${isActive ? ' (click again to cancel)' : ''}`}
            >
              <div className="text-center">
                <div 
                  className="w-8 h-8 mx-auto mb-1 rounded flex items-center justify-center text-white text-lg"
                  style={{ backgroundColor: obj.color }}
                >
                  {obj.icon}
                </div>
                <div className="text-xs font-medium text-gray-700">{obj.name}</div>
                <div className="text-xs text-gray-500">{obj.category}</div>
              </div>
            </div>
          );
        })}
      </div>
      {placementMode && (
        <div className="mt-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
          {placementMode.isBatchMode 
            ? `Batch mode: Click anywhere to place ${placementMode.objectType.name} (click button again to cancel)`
            : `Click anywhere to place ${placementMode.objectType.name} (click button again to cancel)`
          }
        </div>
      )}
    </div>
  );
};

export default PlaceableObjects;
