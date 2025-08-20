import React, { useState } from 'react';
import { FileImage, FileText, Download } from 'lucide-react';
import PlaceableObjectsPanel from './PlaceableObjectsPanel';
import DrawingTools from './DrawingTools';
import ShapeProperties from './ShapeProperties';
import CustomShapesList from './CustomShapesList';
import DroppedObjectsList from './DroppedObjectsList';

const RightSidebar = ({ 
  drawTools,
  clickToPlace,
  placeableObjects,
  onExport,
  onExportSiteplan,
  onImport,
  focusedArea
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  return (
    <>
      <div className="w-80 h-full bg-white dark:bg-gray-800 dark:text-gray-100 shadow-lg z-10 flex flex-col border-l border-gray-200 dark:border-gray-700 sidebar-right">

      {/* Middle scroll area with flexible Event Objects panel */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Drawing Tools */}
        <DrawingTools 
          activeTool={drawTools.activeTool}
          onToolSelect={drawTools.activateDrawingTool}
          selectedShape={drawTools.selectedShape}
          onDelete={drawTools.deleteSelectedShape}
          drawAvailable={Boolean(drawTools.draw?.current)}
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

        {/* Placeable Objects Panel (reserve space for at least 3 rows) */}
        <div className="flex-1 min-h-[20rem] overflow-y-auto">
          <PlaceableObjectsPanel
            objects={placeableObjects}
            onActivation={clickToPlace.activatePlacementMode}
            placementMode={clickToPlace.placementMode}
            activeRectObjectTypeId={drawTools.activeRectObjectTypeId}
            onRectActivation={(obj) => drawTools.startRectObjectPlacement(obj)}
          />
        </div>

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
        {clickToPlace.droppedObjects.length > 0 && (
          <DroppedObjectsList
            objects={clickToPlace.droppedObjects}
            placeableObjects={placeableObjects}
            onRemove={clickToPlace.removeDroppedObject}
          />
        )}
      </div>


      {/* Export Section */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 mt-auto">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Export Options</h3>
        {/* Split row with Event Information and Export Options */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            className="px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => window.dispatchEvent(new CustomEvent('ui:show-event-info'))}
          >
            Event Information
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => window.dispatchEvent(new CustomEvent('ui:show-export-options'))}
          >
            Export Options
          </button>
        </div>
        <div className="space-y-2">
          {/* Export Event Plan */}
          <button 
            onClick={onExport}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 export-button export-event-plan"
          >
            <Download className="w-4 h-4" />
            <span>Export Event Plan</span>
          </button>
          
          {/* Export Siteplan Menu */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!focusedArea}
              className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2 export-button export-siteplan ${
                focusedArea 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <FileImage className="w-4 h-4" />
              <span>Export Site Plan</span>
            </button>
            
            {showExportMenu && focusedArea && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[9999]">
                <div className="p-2">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">Export Site Plan</div>
                  <button
                    type="button"
                    onClick={() => {
                      console.log('Exporting PNG...', { focusedArea, onExportSiteplan });
                      onExportSiteplan('png');
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center space-x-2 cursor-pointer"
                  >
                    <FileImage className="w-4 h-4" />
                    <span>PNG Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      console.log('Exporting JPG...', { focusedArea, onExportSiteplan });
                      onExportSiteplan('jpg');
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center space-x-2 cursor-pointer"
                  >
                    <FileImage className="w-4 h-4" />
                    <span>JPG Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      console.log('Exporting PDF...', { focusedArea, onExportSiteplan });
                      onExportSiteplan('pdf');
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center space-x-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>PDF Document</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          
          
        </div>
      </div>
    </div>


  </>
  );
};

export default RightSidebar; 