import React from 'react';

const PlaceableObjectsPanel = ({ objects, onDragStart }) => {
  return (
    <div className="p-4 border-b border-gray-200">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Event Objects</h3>
      <div className="grid grid-cols-2 gap-2 placeable-objects-grid">
        {objects.map((obj) => (
          <div
            key={obj.id}
            draggable
            onDragStart={(e) => onDragStart(e, obj)}
            className="flex flex-col items-center p-3 bg-gray-50 rounded-lg cursor-grab active:cursor-grabbing hover:bg-gray-100 transition-colors object-item draggable-object"
          >
            <div 
              className="w-8 h-8 mb-2 rounded-full flex items-center justify-center text-white text-sm font-medium"
              style={{ backgroundColor: obj.color }}
            >
              {obj.icon}
            </div>
            <span className="text-xs text-gray-700 text-center font-medium">
              {obj.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlaceableObjectsPanel;
