import React, { useCallback } from 'react';

const PlaceableObjectsPanel = ({ 
  objects, 
  onActivation, 
  placementMode 
}) => {
  const handleClick = useCallback((e, obj) => {
    // Check if shift is held for batch mode
    const isBatchMode = e.shiftKey;
    onActivation(obj, isBatchMode);
  }, [onActivation]);

  return (
    <div className="p-4 border-b border-gray-200">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Event Objects</h3>
      <div className="grid grid-cols-2 gap-2 placeable-objects-grid">
        {objects.map((obj) => {
          const isActive = placementMode?.objectType.id === obj.id;
          const isBatchMode = isActive && placementMode.isBatchMode;
          
          return (
            <div
              key={obj.id}
              onClick={(e) => handleClick(e, obj)}
              className={`flex flex-col items-center p-3 rounded-lg transition-all cursor-pointer object-item ${
                isActive 
                  ? 'bg-blue-100 border-2 border-blue-500' 
                  : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
              } ${
                isBatchMode ? 'border-4 border-blue-600' : ''
              }`}
              title={`Click to place ${obj.name}${isActive ? ' (click again to cancel)' : ''}`}
            >
              {obj.imageUrl ? (
                <img
                  src={obj.imageUrl}
                  alt={obj.name}
                  className="w-12 h-12 mb-2 rounded"
                  style={{ objectFit: 'contain' }}
                  draggable={false}
                />
              ) : (
                <div 
                  className="w-12 h-12 mb-2 rounded-full flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: obj.color }}
                >
                  {obj.icon}
                </div>
              )}
              <span className="text-xs text-gray-700 text-center font-medium">
                {obj.name}
              </span>
              {isActive && (
                <span className="text-xs text-blue-600 mt-1">
                  {isBatchMode ? 'Batch Mode' : 'Active'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlaceableObjectsPanel;
