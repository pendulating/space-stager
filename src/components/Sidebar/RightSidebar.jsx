import React from 'react';
import PlaceableObjectsPanel from './PlaceableObjectsPanel';
import DrawingTools from './DrawingTools';
import ShapeProperties from './ShapeProperties';
import CustomShapesList from './CustomShapesList';
import DroppedObjectsList from './DroppedObjectsList';

const RightSidebar = ({ 
  drawTools,
  dragDrop,
  placeableObjects
}) => {
  return (
    <div className="w-80 bg-white shadow-lg z-10 flex flex-col border-l border-gray-200 sidebar-right">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-blue-50">
        <h2 className="text-lg font-semibold text-blue-900">Site Plan Designer</h2>
        <p className="text-sm text-blue-700 mt-1">Design tools for focused area</p>
      </div>

      {/* Drawing Tools */}
      <DrawingTools 
        activeTool={drawTools.activeTool}
        onToolSelect={drawTools.activateDrawingTool}
        selectedShape={drawTools.selectedShape}
        onDelete={drawTools.deleteSelectedShape}
        drawAvailable={drawTools.drawInitialized}
        onRetry={drawTools.reinitializeDrawControls}
      />

      {/* Shape Properties */}
      {drawTools.selectedShape && (
        <ShapeProperties
          shapeLabel={drawTools.shapeLabel}
          onLabelChange={drawTools.setShapeLabel}
          onApply={drawTools.updateShapeLabel}
        />
      )}

      {/* Placeable Objects Panel */}
      <PlaceableObjectsPanel
        objects={placeableObjects}
        onDragStart={dragDrop.handleObjectDragStart}
      />

      {/* Custom Shapes List */}
      <CustomShapesList
        selectedShape={drawTools.selectedShape}
        onShapeSelect={drawTools.selectShape}
        draw={drawTools.draw}
        onShapeRename={drawTools.renameShape}
        showLabels={drawTools.showLabels}
        onToggleLabels={drawTools.setShowLabels}
      />

      {/* Dropped Objects List */}
      {dragDrop.droppedObjects.length > 0 && (
        <DroppedObjectsList
          objects={dragDrop.droppedObjects}
          placeableObjects={placeableObjects}
          onRemove={dragDrop.removeDroppedObject}
        />
      )}

      {/* Export Section */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 mt-auto">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Export Options</h3>
        <div className="space-y-2">
          <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            Export Site Plan
          </button>
          <button className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors">
            Save Draft
          </button>
        </div>
      </div>
    </div>
  );
};

export default RightSidebar; 