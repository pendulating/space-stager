import React, { useState, useEffect } from 'react';
import { Type } from 'lucide-react';

const ShapeProperties = ({ 
  selectedShape, 
  customShapes,
  draw,
  onUpdateShape 
}) => {
  const [shapeLabel, setShapeLabel] = useState('');

  // Update local state when selected shape changes
  useEffect(() => {
    if (selectedShape) {
      const shape = customShapes.find(s => s.id === selectedShape);
      setShapeLabel(shape?.label || '');
    } else {
      setShapeLabel('');
    }
  }, [selectedShape, customShapes]);

  const updateShapeLabel = () => {
    if (selectedShape && draw?.current) {
      // Update shape in customShapes array
      onUpdateShape(selectedShape, { label: shapeLabel });
      
      // Update the draw feature properties
      const feature = draw.current.get(selectedShape);
      if (feature) {
        feature.properties.label = shapeLabel;
        draw.current.add(feature);
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      updateShapeLabel();
    }
  };

  if (!selectedShape) return null;

  const selectedShapeData = customShapes.find(s => s.id === selectedShape);

  return (
    <div className="p-4 border-b border-gray-200 bg-gray-50">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        <Type className="w-4 h-4 inline mr-2" />
        Shape Properties
      </h3>
      
      {selectedShapeData && (
        <div className="mb-3 text-xs text-gray-600">
          <span className="font-medium">Type:</span> {selectedShapeData.type}
        </div>
      )}
      
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Label</label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={shapeLabel}
              onChange={(e) => setShapeLabel(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., Stage, Food Truck, Info Booth"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <button
              onClick={updateShapeLabel}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShapeProperties;
