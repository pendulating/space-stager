import React, { useState, useEffect } from 'react';
import { Type, X } from 'lucide-react';

const ShapeProperties = ({ 
  selectedShape, 
  customShapes,
  draw,
  onUpdateShape,
  onDeleteShape
}) => {
  const [shapeLabel, setShapeLabel] = useState('');
  const [textSize, setTextSize] = useState(14);
  const [textColor, setTextColor] = useState('#111827');
  const [halo, setHalo] = useState(true);
  const [arrowStart, setArrowStart] = useState(false);
  const [arrowEnd, setArrowEnd] = useState(false);
  const selectedShapeRef = React.useRef(null);

  // Update local state when selected shape changes
  useEffect(() => {
    if (selectedShape) {
      // Only reset local fields if the selected shape ID has actually changed
      if (selectedShapeRef.current !== selectedShape) {
        const shape = customShapes.find(s => s.id === selectedShape);
        setShapeLabel(shape?.label || '');
        const feature = draw?.current ? draw.current.get(selectedShape) : null;
        const p = feature?.properties || {};
        setTextSize(Number(p.textSize || 14));
        setTextColor(p.textColor || '#111827');
        setHalo(p.halo !== false);
        setArrowStart(!!p.arrowStart);
        setArrowEnd(!!p.arrowEnd);
        selectedShapeRef.current = selectedShape;
      }
    } else {
      setShapeLabel('');
      setTextSize(14);
      setTextColor('#111827');
      setHalo(true);
      setArrowStart(false);
      setArrowEnd(false);
      selectedShapeRef.current = null;
    }
  }, [selectedShape, customShapes, draw]);

  const updateShapeProperties = () => {
    if (selectedShape && onUpdateShape) {
      onUpdateShape(selectedShape, { 
        label: shapeLabel,
        textSize: Number(textSize) || 14,
        textColor,
        halo: !!halo,
        arrowStart: !!arrowStart,
        arrowEnd: !!arrowEnd
      });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      updateShapeProperties();
    }
  };

  if (!selectedShape) return null;

  const SHAPE_TYPE_NAMES = {
    'Point': 'Point',
    'LineString': 'Line',
    'Polygon': 'Polygon'
  };

  const selectedShapeData = customShapes.find(s => s.id === selectedShape);
  
  // If the shape ID is set but it doesn't exist in our list anymore, 
  // it was likely just deleted. Don't render the properties panel.
  if (!selectedShapeData) return null;

  const displayType = selectedShapeData ? (SHAPE_TYPE_NAMES[selectedShapeData.type] || selectedShapeData.type) : '';

  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
        <Type className="w-4 h-4 inline mr-2" />
        Shape Properties
      </h3>
      
      {selectedShapeData && (
        <div className="mb-3 text-xs text-gray-600 dark:text-gray-300">
          <span className="font-medium">Type:</span> {displayType}
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
              onClick={updateShapeProperties}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Apply
            </button>
          </div>
        </div>

        {selectedShapeData && selectedShapeData.type === 'LineString' && (
          <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Arrow Tips</label>
            <div className="flex space-x-4">
              <label className="flex items-center text-sm text-gray-700 dark:text-gray-200">
                <input 
                  type="checkbox" 
                  checked={arrowStart} 
                  onChange={(e) => {
                    const newVal = e.target.checked;
                    setArrowStart(newVal);
                    // Immediate apply
                    onUpdateShape(selectedShape, { 
                      label: shapeLabel,
                      textSize: Number(textSize) || 14,
                      textColor,
                      halo: !!halo,
                      arrowStart: newVal,
                      arrowEnd
                    });
                  }} 
                  className="mr-2" 
                />
                Start
              </label>
              <label className="flex items-center text-sm text-gray-700 dark:text-gray-200">
                <input 
                  type="checkbox" 
                  checked={arrowEnd} 
                  onChange={(e) => {
                    const newVal = e.target.checked;
                    setArrowEnd(newVal);
                    // Immediate apply
                    onUpdateShape(selectedShape, { 
                      label: shapeLabel,
                      textSize: Number(textSize) || 14,
                      textColor,
                      halo: !!halo,
                      arrowStart,
                      arrowEnd: newVal
                    });
                  }} 
                  className="mr-2" 
                />
                End
              </label>
            </div>
          </div>
        )}

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
          <input 
            type="checkbox" 
            checked={!!halo} 
            onChange={(e) => {
              const newVal = e.target.checked;
              setHalo(newVal);
              // Immediate apply
              onUpdateShape(selectedShape, { 
                label: shapeLabel,
                textSize: Number(textSize) || 14,
                textColor,
                halo: newVal,
                arrowStart,
                arrowEnd
              });
            }} 
            className="mr-2" 
          />
          Text halo for contrast
        </label>

        <div className="pt-3 border-t border-gray-200 dark:border-gray-700 mt-4">
          <button
            onClick={() => {
              if (onDeleteShape) {
                onDeleteShape();
              }
            }}
            className="w-full px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            Delete {displayType || 'Shape'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShapeProperties;
