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
  onStyleChange,
  isSitePlanMode = false
}) => {
  return (
    <div className={`${isSitePlanMode ? 'w-64' : 'w-80'} bg-white shadow-lg z-10 flex flex-col transition-all duration-300`}>
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

      {/* Only show these in non-site-plan mode */}
      {!isSitePlanMode && (
        <>
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

          <CustomShapesList
            selectedShape={drawTools.selectedShape}
            onShapeSelect={drawTools.selectShape}
            draw={drawTools.draw}
            onShapeRename={drawTools.renameShape}
            showLabels={drawTools.showLabels}
            onToggleLabels={drawTools.setShowLabels}
          />
        </>
      )}
    </div>
  );
};

export default Sidebar;