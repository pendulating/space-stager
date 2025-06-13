import React from 'react';
import { Grid3X3 } from 'lucide-react';

const PlaceableObjects = ({ 
  placeableObjects = [], // Add default empty array
  draggedObject, 
  onDragStart 
}) => {
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
        {placeableObjects.map(obj => (
          <div
            key={obj.id}
            draggable
            onDragStart={(e) => onDragStart(e, obj)}
            className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-grab active:cursor-grabbing transition-colors border-2 border-transparent hover:border-blue-300"
            title={`Drag to place ${obj.name}`}
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
        ))}
      </div>
      {draggedObject && (
        <div className="mt-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
          Drag "{draggedObject.name}" to the map to place it
        </div>
      )}
    </div>
  );
};

export default PlaceableObjects;
