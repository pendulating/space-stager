import React, { useState, useEffect } from 'react';
import { Type } from 'lucide-react';

const ShapeProperties = ({ 
  selectedShape, 
  customShapes,
  draw,
  onUpdateShape 
}) => {
  const [shapeLabel, setShapeLabel] = useState('');
  const [textSize, setTextSize] = useState(14);
  const [textColor, setTextColor] = useState('#111827');
  const [halo, setHalo] = useState(true);

  // Update local state when selected shape changes
  useEffect(() => {
    if (selectedShape) {
      const shape = customShapes.find(s => s.id === selectedShape);
      setShapeLabel(shape?.label || '');
      const feature = draw?.current ? draw.current.get(selectedShape) : null;
      const p = feature?.properties || {};
      setTextSize(Number(p.textSize || 14));
      setTextColor(p.textColor || '#111827');
      setHalo(p.halo !== false);
    } else {
      setShapeLabel('');
      setTextSize(14);
      setTextColor('#111827');
      setHalo(true);
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
        feature.properties.textSize = Number(textSize) || 14;
        feature.properties.textColor = textColor;
        feature.properties.halo = !!halo;
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
    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
        <Type className="w-4 h-4 inline mr-2" />
        Shape Properties
      </h3>
      
      {selectedShapeData && (
        <div className="mb-3 text-xs text-gray-600 dark:text-gray-300">
          <span className="font-medium">Type:</span> {selectedShapeData.type}
        </div>
      )}
      
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Label</label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={shapeLabel}
              onChange={(e) => setShapeLabel(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., Stage, Food Truck, Info Booth"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <button
              onClick={updateShapeLabel}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Apply
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 items-center">
          <div className="col-span-2">
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Text Color</label>
            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-full h-9 p-0 border border-gray-300 dark:border-gray-700 rounded" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Size</label>
            <input type="number" min={8} max={48} value={textSize} onChange={(e) => setTextSize(e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          </div>
        </div>
        <label className="flex items-center text-sm text-gray-700 dark:text-gray-200">
          <input type="checkbox" checked={!!halo} onChange={(e) => setHalo(e.target.checked)} className="mr-2" />
          Text halo for contrast
        </label>
      </div>
    </div>
  );
};

export default ShapeProperties;
