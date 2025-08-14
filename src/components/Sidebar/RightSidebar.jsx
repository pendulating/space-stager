import React, { useState, useRef } from 'react';
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
  const fileInputRef = useRef(null);
  return (
    <>
      <div className="w-80 bg-white dark:bg-gray-800 dark:text-gray-100 shadow-lg z-10 flex flex-col border-l border-gray-200 dark:border-gray-700 sidebar-right">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-300">Site Plan Designer</h2>
        <p className="text-sm text-blue-700 dark:text-blue-300/80 mt-1">Design tools for focused area</p>
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
        onActivation={clickToPlace.activatePlacementMode}
        placementMode={clickToPlace.placementMode}
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
      {clickToPlace.droppedObjects.length > 0 && (
        <DroppedObjectsList
          objects={clickToPlace.droppedObjects}
          placeableObjects={placeableObjects}
          onRemove={clickToPlace.removeDroppedObject}
        />
      )}


      {/* Export Section */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 mt-auto">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Export Options</h3>
        <div className="space-y-2">
          {/* Import Plan (JSON) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              if (onImport) onImport(e);
              // allow re-uploading the same file
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          />
          <button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors flex items-center justify-center space-x-2"
          >
            <span>Import Plan (JSON)</span>
          </button>

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
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-lg border border-gray-200 z-[9999]">
                <div className="p-2">
                  <div className="text-xs font-medium text-gray-500 mb-2 px-2">Export Site Plan</div>
                  <button
                    type="button"
                    onClick={() => {
                      console.log('Exporting PNG...', { focusedArea, onExportSiteplan });
                      onExportSiteplan('png');
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center space-x-2 cursor-pointer"
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
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center space-x-2 cursor-pointer"
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
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center space-x-2 cursor-pointer"
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