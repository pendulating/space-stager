import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useWindowSize } from '../../hooks/useWindowSize';
import { useGlobalKeymap } from '../../hooks/useGlobalKeymap';
import { ClipboardList, Download, FileImage, List, PencilRuler, Shapes, ChevronDown, ChevronRight, Pencil, Package, ExternalLink } from 'lucide-react';
import DrawingTools from './DrawingTools';
import ShapeProperties from './ShapeProperties';
import PlaceableObjectsPanel from './PlaceableObjectsPanel';
import ItemBrowserModal from '../Modals/ItemBrowserModal';


const RightSidebar = ({
  mode = 'expanded',
  isOpen = true,
  onClose = () => {},
  onToggle = () => {},
  drawTools,
  clickToPlace,
  placeableObjects,
  onExport,
  onExportSiteplan,
  onImport,
  focusedArea
}) => {
  const drawerRef = useRef(null);
  const { width: windowWidth } = useWindowSize();

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [subSectionsExpanded, setSubSectionsExpanded] = useState({
    drawing: false,  // Collapsed by default to give more room to Event Objects
    dropped: true
  });
  const [hoverLabel, setHoverLabel] = useState('');
  const [hoverPlacedLabel, setHoverPlacedLabel] = useState('');
  const [annotationCount, setAnnotationCount] = useState(0);
  const [annotations, setAnnotations] = useState([]);
  
  // Modal state
  const [itemBrowserOpen, setItemBrowserOpen] = useState(false);
  const [itemBrowserMode, setItemBrowserMode] = useState('objects'); // 'objects' or 'annotations'
  
  // Sync annotations from draw
  useEffect(() => {
    if (drawTools?.draw?.current) {
      try {
        const features = drawTools.draw.current.getAll()?.features || [];
        const annotationList = features.map(f => ({
          id: f.id,
          type: f.geometry?.type,
          label: f.properties?.label
        }));
        setAnnotations(annotationList);
        setAnnotationCount(annotationList.length);
      } catch (_) {}
    }
  }, [drawTools?.draw, drawTools?.selectedShape]);

  useGlobalKeymap([
    clickToPlace && clickToPlace.placementMode ? {
      key: 'Escape',
      onEvent: () => { try { clickToPlace.cancelPlacementMode(); } catch (_) {} },
      priority: 50,
      preventDefault: false,
      stop: false
    } : null
  ]);

  const ensureDrawerOpen = useCallback(() => {
    if (mode === 'icon-rail' && !isOpen) {
      onToggle();
    }
  }, [mode, isOpen, onToggle]);


  const sidebarClasses = useMemo(() => {
    const base = 'h-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-md dark:text-gray-100 shadow-lg z-30 flex flex-col border-l border-gray-200/60 dark:border-gray-700/60 sidebar-right transition-all duration-300 ease-in-out';
    if (mode === 'icon-rail') return `${base} w-full`;
    return `${base} w-80`;
  }, [mode]);

  const toggleSubSection = useCallback((id) => {
    setSubSectionsExpanded((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (id === 'drawing' && prev[id]) {
        next.annotations = false;
      }
      if (id === 'dropped' && prev[id]) {
        next.placed = false;
      }
      if (id === 'drawing' && !prev[id]) {
        next.annotations = true;
      }
      if (id === 'dropped' && !prev[id]) {
        next.placed = true;
      }
      return next;
    });
  }, []);

  const toggleSubChild = useCallback((id, parentId) => {
    setSubSectionsExpanded((prev) => {
      if (!prev[parentId]) return prev;
      return { ...prev, [id]: !prev[id] };
    });
  }, []);

  const renderDesignSection = () => (
    <div className="space-y-3 p-3">
      {/* Drawing Tools Card */}
      <div className="bg-white/80 dark:bg-gray-800/60 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSubSection('drawing')}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors"
          aria-expanded={subSectionsExpanded.drawing}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Pencil className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Drawing Tools</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {hoverLabel || 'Point, line, and polygon'}
              </p>
            </div>
          </div>
          {subSectionsExpanded.drawing ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        {subSectionsExpanded.drawing && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-gray-700/50">
            <div className="pt-3">
              <DrawingTools
                activeTool={drawTools.activeTool}
                onToolSelect={drawTools.activateDrawingTool}
                selectedShape={drawTools.selectedShape}
                onDelete={drawTools.deleteSelectedShape}
                drawAvailable={!!drawTools.drawInitialized}
                onRetry={drawTools.reinitializeDrawControls}
                onHoverChange={(label) => setHoverLabel(label)}
              />
            </div>
            
            {/* Show Labels Toggle */}
            <button
              type="button"
              onClick={() => { try { drawTools.setShowLabels && drawTools.setShowLabels(!drawTools.showLabels); } catch (_) {} }}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/60 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
              aria-pressed={!!drawTools.showLabels}
            >
              <span className="text-sm text-gray-700 dark:text-gray-300">Show Labels on Map</span>
              <div className={`w-10 h-6 rounded-full transition-colors flex items-center ${drawTools.showLabels ? 'bg-blue-600 justify-end' : 'bg-gray-300 dark:bg-gray-600 justify-start'}`}>
                <div className="w-5 h-5 bg-white rounded-full shadow mx-0.5" />
              </div>
            </button>
            
            {drawTools.selectedShape && (
              <ShapeProperties
                selectedShape={drawTools.selectedShape}
                customShapes={(drawTools.draw?.current?.getAll()?.features || []).map(f => ({ id: f.id, type: f.geometry.type, label: f.properties?.label }))}
                draw={drawTools.draw}
                onUpdateShape={drawTools.updateShape}
                onDeleteShape={drawTools.deleteSelectedShape}
              />
            )}
          </div>
        )}
      </div>

      {/* Annotations Summary Badge */}
      {annotationCount > 0 && (
        <button
          type="button"
          onClick={() => { setItemBrowserMode('annotations'); setItemBrowserOpen(true); }}
          className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200/60 dark:border-purple-800/40 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
          aria-label="View all annotations"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <PencilRuler className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
                {annotationCount} annotation{annotationCount !== 1 ? 's' : ''} on map
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-purple-600 dark:text-purple-400">View all</span>
            <ExternalLink className="w-4 h-4 text-purple-500" />
          </div>
        </button>
      )}
    </div>
  );

  const renderObjectsSection = () => {
    const placedCount = clickToPlace.droppedObjects?.length || 0;
    const isPlacementActive = clickToPlace.placementMode || drawTools.activeRectObjectTypeId;
    
    return (
      <div className="space-y-3 p-3">
        {/* Available Objects Card */}
        <div className="bg-white/80 dark:bg-gray-800/60 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSubSection('dropped')}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors"
            aria-expanded={subSectionsExpanded.dropped}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPlacementActive ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
                <Package className={`w-5 h-5 ${isPlacementActive ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Event Objects</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {hoverPlacedLabel || (isPlacementActive ? 'Click map to place' : 'Select an object to place')}
                </p>
              </div>
            </div>
            {isPlacementActive ? (
              <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-full animate-pulse">
                Active
              </span>
            ) : (
              subSectionsExpanded.dropped ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )
            )}
          </button>
          
          {subSectionsExpanded.dropped && (
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700/50">
              <div className="pt-3">
                {/* Placement hint */}
                {isPlacementActive && (
                  <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200/60 dark:border-blue-800/40">
                    <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                      Click on the map to place the object
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                      Hold Shift for multi-place mode
                    </p>
                  </div>
                )}
                
                <PlaceableObjectsPanel
                  objects={placeableObjects}
                  onActivation={clickToPlace.activatePlacementMode}
                  placementMode={clickToPlace.placementMode}
                  onRectActivation={(obj) => drawTools.startRectObjectPlacement(obj)}
                  activeRectObjectTypeId={drawTools.activeRectObjectTypeId}
                  onCancelPlacement={typeof clickToPlace.cancelPlacementMode === 'function' ? clickToPlace.cancelPlacementMode : undefined}
                  onCancelRectPlacement={typeof drawTools.cancelRectObjectPlacement === 'function' ? drawTools.cancelRectObjectPlacement : undefined}
                />
              </div>
            </div>
          )}
        </div>

        {/* Placed Items Summary Badge */}
        {placedCount > 0 && (
          <button
            type="button"
            onClick={() => { setItemBrowserMode('objects'); setItemBrowserOpen(true); }}
            className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200/60 dark:border-amber-800/40 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
            aria-label="View all placed items"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Shapes className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  {placedCount} item{placedCount !== 1 ? 's' : ''} on map
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-600 dark:text-amber-400">View all</span>
              <ExternalLink className="w-4 h-4 text-amber-500" />
            </div>
          </button>
        )}
      </div>
    );
  };


  const renderExportSection = () => (
    <div className="p-3 border-t border-gray-200/60 dark:border-gray-700/60 bg-gradient-to-t from-gray-100/80 to-white/60 dark:from-gray-900/80 dark:to-gray-800/60 mt-auto">
      <div className="space-y-2">
        <button
          onClick={onExport}
          className="w-full bg-white/80 dark:bg-gray-800/80 border-2 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 px-4 py-3 rounded-xl text-sm font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 export-button export-event-plan"
          aria-label="Export plan as JSON file"
        >
          <Download className="w-4 h-4" />
          <span>Save Draft (JSON)</span>
        </button>
        <button
          onClick={() => onExportSiteplan('pdf')}
          disabled={!focusedArea}
          className={`w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2 export-button export-siteplan ${
            focusedArea 
              ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm' 
              : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          }`}
          aria-label={focusedArea ? "Export site plan as PDF" : "Select an area first to export"}
        >
          <FileImage className="w-4 h-4" />
          <span>Export Site Plan (PDF)</span>
        </button>
        {!focusedArea && (
          <p className="text-xs text-center text-gray-400 dark:text-gray-500">
            Create a zone to enable PDF export
          </p>
        )}
      </div>
    </div>
  );

  const renderContent = () => (
    <div className={sidebarClasses}>
      {mode !== 'expanded' && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/60 dark:border-gray-700/60 bg-gradient-to-r from-gray-50/80 to-white/60 dark:from-gray-900/80 dark:to-gray-800/60">
          <div className="flex items-center gap-2">
            <PencilRuler className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Plan Design</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Render both sections in sequence */}
        {renderDesignSection()}
        <div className="border-t border-gray-200/60 dark:border-gray-700/60 mx-3" />
        {renderObjectsSection()}
      </div>

      {mode === 'icon-rail' ? null : renderExportSection()}
    </div>
  );

  // Keep a root-level CSS variable in sync with the total right panel width
  // so map-adjacent UI (like the viewport inset) can glide alongside it.
  useEffect(() => {
    const rootEl = typeof document !== 'undefined' ? document.documentElement : null;
    if (!rootEl) return undefined;

    const updateOverlayWidthVar = () => {
      try {
        // In expanded mode, the panel has fixed width (w-80 = 320px). In icon-rail,
        // use current drawer width (w-64 = 256px) when open, else 0.
        let widthPx = 0;
        if (mode === 'icon-rail') {
          widthPx = (isOpen && drawerRef.current) ? drawerRef.current.getBoundingClientRect().width : 0;
        } else {
          widthPx = 320;
        }
        rootEl.style.setProperty('--space-stager-right-panel-width', `${Math.round(widthPx)}px`);
        try {
          const ev = new CustomEvent('space-stager:right-panel-width', { detail: { width: Math.round(widthPx) } });
          window.dispatchEvent(ev);
        } catch (_) {}
      } catch (_) {
        // ignore
      }
    };

    // Prime immediately
    updateOverlayWidthVar();

    // Observe the drawer in overlay mode so updates stream during transitions
    let resizeObserver;
    if (mode === 'icon-rail' && typeof ResizeObserver !== 'undefined' && drawerRef.current) {
      resizeObserver = new ResizeObserver(() => updateOverlayWidthVar());
      try { resizeObserver.observe(drawerRef.current); } catch (_) {}
    }

    return () => {
      try { resizeObserver && resizeObserver.disconnect(); } catch (_) {}
      // Reset to 0
      try { rootEl.style.setProperty('--space-stager-right-panel-width', '0px'); } catch (_) {}
    };
  }, [mode, isOpen, windowWidth]);

  if (mode === 'icon-rail') {
    const drawerWidthClass = isOpen ? 'w-64 max-w-[calc(100vw-5rem)]' : 'w-0';
    return (
      <div className="h-full flex">
        <div className="w-16 min-w-[4rem] h-full flex flex-col items-center justify-between py-8 px-3 bg-white/90 dark:bg-gray-900/80 border-l border-gray-200 dark:border-gray-700 shadow-lg">
          <div className="flex flex-col items-center space-y-3">
            <button
              type="button"
              className={`p-2 rounded-full transition-colors ${isOpen ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              onClick={onToggle}
              title={isOpen ? 'Hide plan tools' : 'Open plan tools'}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 mt-6">
            <button
              type="button"
              className="p-2 rounded-full border border-transparent hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={ensureDrawerOpen}
              title="Drawing Tools"
            >
              <Pencil className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="p-2 rounded-full border border-transparent hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={ensureDrawerOpen}
              title="Place Objects"
            >
              <Package className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-col items-center space-y-4 mt-6">
            <button
              type="button"
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={onExport}
              title="Export Plan (JSON)"
              aria-label="Export Plan (JSON)"
            >
              <ClipboardList className="w-5 h-5" />
            </button>
            <button
              type="button"
              disabled={!focusedArea}
              className={`p-2 rounded-full transition-colors ${focusedArea ? 'hover:bg-gray-100 dark:hover:bg-gray-700' : 'opacity-50 cursor-not-allowed'}`}
              onClick={() => focusedArea && onExportSiteplan('pdf')}
              title="Export Site Plan (PDF)"
              aria-label="Export Site Plan (PDF)"
            >
              <FileImage className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div ref={drawerRef} className={`h-full overflow-hidden transition-all duration-300 ${drawerWidthClass}`}>
          {isOpen ? renderContent() : null}
        </div>
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <>
      {renderContent()}
      <ItemBrowserModal
        isOpen={itemBrowserOpen}
        onClose={() => setItemBrowserOpen(false)}
        mode={itemBrowserMode}
        droppedObjects={clickToPlace?.droppedObjects || []}
        placeableObjects={placeableObjects}
        onRemoveObject={clickToPlace?.removeDroppedObject}
        annotations={annotations}
        onSelectAnnotation={drawTools?.selectShape}
        onDeleteAnnotation={drawTools?.deleteSelectedShape}
        selectedAnnotationId={drawTools?.selectedShape?.id}
      />
    </>
  );
};

export default RightSidebar; 