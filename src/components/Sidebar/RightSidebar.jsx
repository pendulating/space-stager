import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { ClipboardList, Download, FileImage, FileText, List, PencilRuler, Shapes } from 'lucide-react';
import DrawingTools from './DrawingTools';
import ShapeProperties from './ShapeProperties';
import PlaceableObjectsPanel from './PlaceableObjectsPanel';
import CustomShapesList from './CustomShapesList';
import DroppedObjectsList from './DroppedObjectsList';

const SECTION_CONFIG = [
  { id: 'design', label: 'Drawing & Annotations', defaultActive: true, icon: PencilRuler },
  { id: 'objects', label: 'Event Objects & Placed Items', defaultActive: false, icon: Shapes }
];

const SECTION_LOOKUP = SECTION_CONFIG.reduce((acc, section) => {
  acc[section.id] = section;
  return acc;
}, {});

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
  const [activeSection, setActiveSection] = useState(
    SECTION_CONFIG.find((section) => section.defaultActive)?.id || SECTION_CONFIG[0].id
  );

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [subSectionsExpanded, setSubSectionsExpanded] = useState({
    drawing: true,
    annotations: true,
    dropped: true,
    placed: true
  });
  const [hoverLabel, setHoverLabel] = useState('');
  const [hoverPlacedLabel, setHoverPlacedLabel] = useState('');
  const [annotationCount, setAnnotationCount] = useState(0);

  useEffect(() => {
    if (!clickToPlace) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && clickToPlace.placementMode) {
        try { clickToPlace.cancelPlacementMode(); } catch (_) {}
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clickToPlace]);

  const ensureDrawerOpen = useCallback(() => {
    if (mode === 'icon-rail' && !isOpen) {
      onToggle();
    }
  }, [mode, isOpen, onToggle]);

  const handleSectionShortcut = useCallback((id) => {
    setActiveSection(id);
    ensureDrawerOpen();

    if (mode !== 'icon-rail' && typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        const sectionEl = document.querySelector(`[data-sidebar-section="${id}"]`);
        if (sectionEl && typeof sectionEl.scrollIntoView === 'function') {
          sectionEl.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
      });
    }
  }, [ensureDrawerOpen, mode]);

  const sidebarClasses = useMemo(() => {
    const base = 'h-full bg-white dark:bg-gray-800 dark:text-gray-100 shadow-lg z-30 flex flex-col border-l border-gray-200 dark:border-gray-700 sidebar-right transition-all duration-300 ease-in-out';
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
    <div className="space-y-0">
      <div className="bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Annotation Tools</h4>
            {hoverLabel && (
              <span className="px-2 py-0.5 rounded-full bg-white/80 dark:bg-gray-800/70 border border-gray-200/60 dark:border-gray-700/60 text-gray-700 dark:text-gray-200 text-[11px] shadow-sm truncate max-w-[12rem]">
                {hoverLabel}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => toggleSubSection('drawing')}
            className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {subSectionsExpanded.drawing ? 'Hide' : 'Show'}
          </button>
        </div>
        {subSectionsExpanded.drawing && (
          <div className="px-2 pb-2 space-y-2">
            <DrawingTools
              activeTool={drawTools.activeTool}
              onToolSelect={drawTools.activateDrawingTool}
              selectedShape={drawTools.selectedShape}
              onDelete={drawTools.deleteSelectedShape}
              drawAvailable={!!drawTools.drawInitialized}
              onRetry={drawTools.reinitializeDrawControls}
              onHoverChange={(label) => setHoverLabel(label)}
            />
            <div className="flex items-center justify-end px-1">
              <button
                type="button"
                onClick={() => { try { drawTools.setShowLabels && drawTools.setShowLabels(!drawTools.showLabels); } catch (_) {} }}
                className="flex items-center gap-2 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              >
                <input type="checkbox" readOnly checked={!!drawTools.showLabels} className="pointer-events-none" />
                Show Labels
              </button>
            </div>
            {drawTools.selectedShape && (
              <ShapeProperties
                shapeLabel={drawTools.shapeLabel}
                onLabelChange={drawTools.setShapeLabel}
                onApply={drawTools.updateShapeLabel}
              />
            )}
          </div>
        )}
      </div>

      <div className={`${subSectionsExpanded.drawing ? '' : 'opacity-60 pointer-events-none'}`}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Annotations (<span>{annotationCount}</span>)</h4>
          <button
            type="button"
            onClick={() => toggleSubChild('annotations', 'drawing')}
            className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {subSectionsExpanded.annotations ? 'Hide' : 'Show'}
          </button>
        </div>
        {subSectionsExpanded.annotations && subSectionsExpanded.drawing && (
          <div className="px-2 pb-2">
            <CustomShapesList
              selectedShape={drawTools.selectedShape}
              onShapeSelect={drawTools.selectShape}
              draw={drawTools.draw}
              onShapeRename={drawTools.renameShape}
              showLabels={drawTools.showLabels}
              onToggleLabels={drawTools.setShowLabels}
              onCountChange={(n) => setAnnotationCount(n)}
            />
          </div>
        )}
      </div>
    </div>
  );

  const renderObjectsSection = () => (
    <div className="space-y-0">
      <div className="bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Event Objects</h4>
            {hoverPlacedLabel && (
              <span className="px-2 py-0.5 rounded-full bg-white/80 dark:bg-gray-800/70 border border-gray-200/60 dark:border-gray-700/60 text-gray-700 dark:text-gray-200 text-[11px] shadow-sm truncate max-w-[12rem]">
                {hoverPlacedLabel}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => toggleSubSection('dropped')}
            className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {subSectionsExpanded.dropped ? 'Hide' : 'Show'}
          </button>
        </div>
        {subSectionsExpanded.dropped && (
          <div className="px-2 pb-2">
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
        )}
      </div>

      <div className={`${subSectionsExpanded.dropped ? '' : 'opacity-60 pointer-events-none'}`}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Placed Items</h4>
          <button
            type="button"
            onClick={() => toggleSubChild('placed', 'dropped')}
            className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            disabled={!subSectionsExpanded.dropped}
          >
            {subSectionsExpanded.placed ? 'Hide' : 'Show'}
          </button>
        </div>
        {subSectionsExpanded.placed && subSectionsExpanded.dropped && (
          <div className="px-4 pb-3">
            {clickToPlace.droppedObjects.length > 0 ? (
              // Add a small inner inset so selection outlines don’t clip at the panel edge
              <div className="pl-1 pr-3">
                <DroppedObjectsList
                  objects={clickToPlace.droppedObjects}
                  placeableObjects={placeableObjects}
                  onRemove={clickToPlace.removeDroppedObject}
                />
              </div>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400">No objects placed yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderSectionBody = (id) => {
    switch (id) {
      case 'design':
        return renderDesignSection();
      case 'objects':
        return renderObjectsSection();
      default:
        return null;
    }
  };

  const renderSection = (id) => {
    const config = SECTION_LOOKUP[id];
    if (!config) return null;
    const isActive = activeSection === id;
    const sectionClasses = `bg-white dark:bg-gray-800`;

    return (
      <section data-sidebar-section={id} key={id} className={sectionClasses}>
        <div className="px-2 py-2 space-y-0">
          {renderSectionBody(id)}
        </div>
      </section>
    );
  };

  const renderExportSection = () => (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 mt-auto">
      <div className="space-y-2">
        <button
          onClick={onExport}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 export-button export-event-plan"
        >
          <Download className="w-4 h-4" />
          <span>Export Plan (JSON)</span>
        </button>
        <button
          onClick={() => onExportSiteplan('pdf')}
          disabled={!focusedArea}
          className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2 export-button export-siteplan ${
            focusedArea ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <FileImage className="w-4 h-4" />
          <span>Export Site Plan (PDF)</span>
        </button>
      </div>
    </div>
  );

  const sectionsToRender = mode === 'icon-rail' ? [activeSection] : SECTION_CONFIG.map((section) => section.id);

  const renderContent = () => (
    <div className={sidebarClasses}>
      {mode !== 'expanded' && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="text-sm font-medium">Plan Tools</div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      )}

      {mode !== 'icon-rail' && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <button
            type="button"
            className="flex-1 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-xs font-medium bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => window.dispatchEvent(new CustomEvent('ui:show-event-info'))}
          >
            Event Info
          </button>
          <button
            type="button"
            className="flex-1 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-xs font-medium bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => window.dispatchEvent(new CustomEvent('ui:show-export-options'))}
          >
            Plan Options
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-0 space-y-0">
        {sectionsToRender.map((id, idx) => (
          <React.Fragment key={id}>
            {renderSection(id)}
            {idx < sectionsToRender.length - 1 && (
              <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
            )}
          </React.Fragment>
        ))}
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

    const onWindowResize = () => updateOverlayWidthVar();
    window.addEventListener('resize', onWindowResize);

    return () => {
      try { window.removeEventListener('resize', onWindowResize); } catch (_) {}
      try { resizeObserver && resizeObserver.disconnect(); } catch (_) {}
      // Reset to 0
      try { rootEl.style.setProperty('--space-stager-right-panel-width', '0px'); } catch (_) {}
    };
  }, [mode, isOpen]);

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
            {SECTION_CONFIG.map(({ id, label, icon: Icon }) => {
              const isActive = activeSection === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={`p-2 rounded-full border transition-colors ${isActive ? 'bg-blue-600 text-white border-blue-500 shadow' : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  onClick={() => handleSectionShortcut(id)}
                  title={label}
                >
                  <Icon className="w-5 h-5" />
                </button>
              );
            })}
          </div>
          <div className="flex flex-col items-center space-y-4 mt-6">
            <button
              type="button"
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => window.dispatchEvent(new CustomEvent('ui:show-event-info'))}
              title="Event Information"
              aria-label="Event Information"
            >
              <FileText className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => window.dispatchEvent(new CustomEvent('ui:show-export-options'))}
              title="Plan Options"
              aria-label="Plan Options"
            >
              <Download className="w-5 h-5" />
            </button>
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

  return renderContent();
};

export default RightSidebar; 