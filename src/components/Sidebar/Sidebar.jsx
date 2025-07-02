// src/components/Sidebar/Sidebar.jsx
import React from 'react';
import DrawingTools from './DrawingTools';
import ShapeProperties from './ShapeProperties';
import PermitAreaSearch from './PermitAreaSearch';
import LayersPanel from './LayersPanel';
import PlaceableObjects from './PlaceableObjects';
import CustomShapesList from './CustomShapesList';
import DroppedObjectsList from './DroppedObjectsList';
import BasemapToggle from './BasemapToggle';

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
  placeableObjects,
  map,
  onStyleChange
}) => {
  return (
    <div className="w-80 bg-white shadow-lg z-10 flex flex-col">
      <BasemapToggle 
        map={map}
        onStyleChange={onStyleChange}
      />

      {permitAreas.mode === 'parks' && (
        <PermitAreaSearch
          searchQuery={permitAreas.searchQuery}
          onSearchChange={permitAreas.setSearchQuery}
          searchResults={permitAreas.searchResults}
          isSearching={permitAreas.isSearching}
          onSelectArea={permitAreas.focusOnPermitArea}
          focusedArea={focusedArea}
        />
      )}

      <LayersPanel
        layers={layers}
        focusedArea={focusedArea}
        onToggleLayer={onToggleLayer}
        onClearFocus={onClearFocus}
      />

      <DrawingTools 
        activeTool={drawTools.activeTool}
        onToolSelect={drawTools.activateDrawingTool}
        selectedShape={drawTools.selectedShape}
        onDelete={drawTools.deleteSelectedShape}
        drawAvailable={drawTools.drawInitialized}
        onRetry={drawTools.reinitializeDrawControls}
      />

      {drawTools.selectedShape && (
        <ShapeProperties
          shapeLabel={drawTools.shapeLabel}
          onLabelChange={drawTools.setShapeLabel}
          onApply={drawTools.updateShapeLabel}
        />
      )}

      <PlaceableObjects
        placeableObjects={placeableObjects}
        onDragStart={dragDrop.handleObjectDragStart}
        draggedObject={dragDrop.draggedObject}
      />

      <CustomShapesList
        selectedShape={drawTools.selectedShape}
        onShapeSelect={drawTools.selectShape}
        draw={drawTools.draw}
        onShapeRename={drawTools.renameShape}
        showLabels={drawTools.showLabels}
        onToggleLabels={drawTools.setShowLabels}
      />

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