import React from 'react';

const CustomShapesList = ({ 
  customShapes, 
  selectedShape, 
  onShapeSelect,
  draw 
}) => {
  const handleShapeClick = (shapeId) => {
    if (draw && draw.current) {
      draw.current.changeMode('simple_select', { featureIds: [shapeId] });
      onShapeSelect(shapeId);
    }
  };

  if (customShapes.length === 0) return null;

  return (
    <div className="p-4 border-t border-gray-200 bg-gray-50">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        Event Fixtures ({customShapes.length})
      </h3>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {customShapes.map(shape => (
          <div
            key={shape.id}
            onClick={() => handleShapeClick(shape.id)}
            className={`px-3 py-2 text-sm rounded cursor-pointer transition-colors ${
              selectedShape === shape.id 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-white hover:bg-gray-100 text-gray-700'
            }`}
          >
            {shape.label || `${shape.type} (unlabeled)`}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomShapesList;
