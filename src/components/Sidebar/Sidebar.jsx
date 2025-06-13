// src/components/Sidebar/Sidebar.jsx
import React from 'react';
import DrawingTools from './DrawingTools';
import ShapeProperties from './ShapeProperties';
import PermitAreaSearch from './PermitAreaSearch';
import LayersPanel from './LayersPanel';
import PlaceableObjects from './PlaceableObjects';
import CustomShapesList from './CustomShapesList';
import DroppedObjectsList from './DroppedObjectsList';

const Sidebar = ({ 
  layers,
  setLayers,
  focusedArea,
  onClearFocus,
  onToggleLayer,
  drawTools,
  permitAreas,
  infrastructure,
  dragDrop,
  placeableObjects
}) => {
  return (
    <div className="w-80 bg-white shadow-lg z-10 flex flex-col">
      <DrawingTools 
        activeTool={drawTools.activeTool}
        onToolSelect={drawTools.activateDrawingTool}
        selectedShape={drawTools.selectedShape}
        onDelete={drawTools.deleteSelectedShape}
      />

      {drawTools.selectedShape && (
        <ShapeProperties
          shapeLabel={drawTools.shapeLabel}
          onLabelChange={drawTools.setShapeLabel}
          onApply={drawTools.updateShapeLabel}
        />
      )}

      <LayersPanel
        layers={layers}
        focusedArea={focusedArea}
        mode={permitAreas.mode}
        onToggleLayer={onToggleLayer}
        onClearFocus={onClearFocus}
        onToggleMode={permitAreas.toggleMode}
      />
      
      {permitAreas.mode === 'parks' && (
        <PermitAreaSearch
          searchQuery={permitAreas.searchQuery}
          onSearchChange={permitAreas.setSearchQuery}
          searchResults={permitAreas.searchResults}
          isSearching={permitAreas.isSearching}
          onSelectArea={permitAreas.focusOnPermitArea}
        />
      )}

      <PlaceableObjects
        placeableObjects={placeableObjects}
        onDragStart={dragDrop.handleObjectDragStart}
        draggedObject={dragDrop.draggedObject}
      />

      {drawTools.customShapes.length > 0 && (
        <CustomShapesList
          shapes={drawTools.customShapes}
          selectedShape={drawTools.selectedShape}
          onSelectShape={drawTools.selectShape}
        />
      )}

      {dragDrop.droppedObjects.length > 0 && (
        <DroppedObjectsList
          objects={dragDrop.droppedObjects}
          placeableObjects={placeableObjects}
          onRemove={dragDrop.removeDroppedObject}
        />
      )}
    </div>
  );
};

export default Sidebar;