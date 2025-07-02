import React, { useState } from 'react';
import { Edit2, Check, X } from 'lucide-react';

const CustomShapesList = ({ 
  selectedShape, 
  onShapeSelect,
  draw,
  onShapeRename,
  showLabels = true,
  onToggleLabels
}) => {
  // console.log('CustomShapesList render:', { showLabels, onToggleLabels: !!onToggleLabels });

  const [editingShape, setEditingShape] = useState(null);
  const [editValue, setEditValue] = useState('');

  const handleShapeClick = (shapeId) => {
    if (draw && draw.current) {
      draw.current.changeMode('simple_select', { featureIds: [shapeId] });
      onShapeSelect(shapeId);
    }
  };

  const handleEditClick = (e, shape) => {
    e.stopPropagation();
    setEditingShape(shape.id);
    setEditValue(shape.label || '');
  };

  const handleSaveEdit = (e) => {
    e.stopPropagation();
    if (onShapeRename && editingShape) {
      onShapeRename(editingShape, editValue);
    }
    setEditingShape(null);
    setEditValue('');
  };

  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setEditingShape(null);
    setEditValue('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSaveEdit(e);
    } else if (e.key === 'Escape') {
      handleCancelEdit(e);
    }
  };

  // Get shapes from the draw instance
  const customShapes = draw?.current ? draw.current.getAll().features.map(feature => ({
    id: feature.id,
    type: feature.geometry.type,
    label: feature.properties?.label || '',
    properties: feature.properties
  })) : [];

  return (
    <div className="p-4 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">
          Event Fixtures ({customShapes.length})
        </h3>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => {
              if (onToggleLabels) {
                onToggleLabels(!showLabels);
              }
            }}
            className="flex items-center gap-2 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded cursor-pointer labels-toggle"
          >
            <input
              type="checkbox"
              checked={showLabels}
              readOnly
              className="pointer-events-none"
            />
            Show Labels
          </button>
        </div>
      </div>
      {customShapes.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {customShapes.map(shape => (
          <div
            key={shape.id}
            onClick={() => handleShapeClick(shape.id)}
            className={`px-3 py-2 text-sm rounded cursor-pointer flex items-center justify-between group custom-shape-item ${
              selectedShape === shape.id 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-white text-gray-700'
            }`}
          >
            {editingShape === shape.id ? (
                              <div className="flex items-center flex-1 mr-2 custom-shape-edit-mode" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="custom-shape-edit-input"
                    autoFocus
                  />
                  <div className="custom-shape-edit-actions">
                    <button
                      onClick={handleSaveEdit}
                      className="custom-shape-save-button"
                      title="Save"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="custom-shape-cancel-button"
                      title="Cancel"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
            ) : (
              <>
                <span className="flex-1">
                  {shape.label || `${shape.type} (unlabeled)`}
                </span>
                <button
                  onClick={(e) => handleEditClick(e, shape)}
                  className="custom-shape-edit-button"
                  title="Rename"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        ))}
        </div>
      )}
    </div>
  );
};

export default CustomShapesList;
