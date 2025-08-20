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
  const getAllResult = draw?.current ? draw.current.getAll() : { features: [] };
  const allFeatures = getAllResult.features || [];
  
  const filteredFeatures = allFeatures.filter(feature => {
    // Filter out any internal MapboxDraw features or unwanted features
    // Only include features that have valid geometry and are user-created
    
    // Check if feature is valid
    const hasValidStructure = feature && 
           feature.geometry && 
           feature.geometry.type && 
           feature.id;
    
    if (!hasValidStructure) {
      console.log('Filtered out feature - invalid structure:', feature);
      return false;
    }
    
    // Filter out meta features (internal MapboxDraw features)
    if (feature.properties?.meta) {
      console.log('Filtered out feature - meta feature:', feature);
      return false;
    }
    
    // Filter out draft/incomplete features
    // Draft features typically have incomplete coordinates or specific properties
    const isDraft = isDraftFeature(feature);
    if (isDraft) {
      console.log('Filtered out feature - draft feature:', feature);
      return false;
    }
    
    // Additional check: only show features that are not currently being drawn
    // This prevents showing the active drawing feature
    if (draw?.current) {
      const currentMode = draw.current.getMode();
      const isDrawingMode = currentMode === 'draw_point' || 
                           currentMode === 'draw_line_string' || 
                           currentMode === 'draw_polygon';
      
      if (isDrawingMode && feature.properties?.active === 'true') {
        console.log('Filtered out feature - currently being drawn:', feature);
        return false;
      }
    }
    
    return true;
  });
  
  // Helper function to identify draft features
  function isDraftFeature(feature) {
    if (!feature.geometry || !feature.geometry.coordinates) {
      return true;
    }
    
    const coords = feature.geometry.coordinates;
    
    // Check for MapboxDraw draft properties
    if (feature.properties?.active === 'true' || 
        feature.properties?.meta === 'vertex' ||
        feature.properties?.meta === 'midpoint' ||
        feature.properties?.meta === 'center') {
      return true;
    }
    
    // Check for MapboxDraw internal features
    if (feature.properties?.meta) {
      return true;
    }
    
    // Check if feature is in a drawing state
    if (feature.properties?.user_created === false) {
      return true;
    }
    
    // For points: check if coordinates are valid numbers and not at origin
    if (feature.geometry.type === 'Point') {
      return !Array.isArray(coords) || coords.length !== 2 || 
             typeof coords[0] !== 'number' || typeof coords[1] !== 'number' ||
             (coords[0] === 0 && coords[1] === 0); // Filter out origin points
    }
    
    // For lines: check if there are at least 2 points
    if (feature.geometry.type === 'LineString') {
      return !Array.isArray(coords) || coords.length < 2;
    }
    
    // For polygons: check if there are at least 3 points and it's closed
    if (feature.geometry.type === 'Polygon') {
      return !Array.isArray(coords) || coords.length === 0 || 
             !Array.isArray(coords[0]) || coords[0].length < 3;
    }
    
    return false;
  }
  

  
  const customShapes = filteredFeatures.map(feature => ({
    id: feature.id,
    type: feature.geometry.type,
    label: feature.properties?.label || '',
    properties: feature.properties
  }));

  return (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">
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
            className="flex items-center gap-2 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer labels-toggle"
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
        <div className="space-y-1 max-h-[25vh] overflow-y-auto">
          {customShapes.map(shape => (
          <div
            key={shape.id}
            onClick={() => handleShapeClick(shape.id)}
            className={`px-3 py-2 text-sm rounded cursor-pointer flex items-center justify-between group custom-shape-item ${
              selectedShape === shape.id 
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'
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
