import React from 'react';
import { X } from 'lucide-react';

const DroppedObjectsList = ({ 
  objects = [], // Changed from droppedObjects and added default
  placeableObjects = [], // Added default
  onRemove 
}) => {
  if (!objects || objects.length === 0) return null;

  return (
    <div className="p-4 border-t border-gray-200 bg-gray-50">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        Placed Objects ({objects.length})
      </h3>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {objects.map(obj => {
          const objectType = placeableObjects.find(p => p.id === obj.type);
          return (
            <div
              key={obj.id}
              className="flex items-center justify-between px-3 py-2 text-sm bg-white hover:bg-gray-100 rounded transition-colors"
            >
              <div className="flex items-center space-x-2">
                {objectType?.imageUrl ? (
                  <img
                    src={objectType.imageUrl}
                    alt={objectType?.name}
                    className="w-4 h-4 rounded object-contain"
                    draggable={false}
                  />
                ) : (
                  <div 
                    className="w-4 h-4 rounded flex items-center justify-center text-white text-xs"
                    style={{ backgroundColor: objectType?.color || '#gray' }}
                  >
                    {objectType?.icon}
                  </div>
                )}
                <span className="text-gray-700">{obj.name}</span>
              </div>
              <button
                onClick={() => onRemove && onRemove(obj.id)}
                className="text-red-500 hover:text-red-700 p-1"
                title="Remove object"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DroppedObjectsList;
