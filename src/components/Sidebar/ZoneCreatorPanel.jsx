import React from 'react';
import { useZoneCreatorContext, WORKFLOW_STEPS } from '../../contexts/ZoneCreatorContext.jsx';
import { ChevronRight, RotateCcw, Check, X, MousePointer2 } from 'lucide-react';

const ZoneCreatorPanel = ({ geographyType }) => {
  const { 
    selectedNodeIds, 
    undoLastNode, 
    widthFeet, 
    setWidthFeet, 
    sidewalkClearPathFt,
    setSidewalkClearPathFt,
    pmpClassification,
    setPreviewActive, 
    workflowStep,
    previewActive
  } = useZoneCreatorContext();

  const CORRIDOR_OPTIONS = [
    { label: 'Global', value: 12, desc: '12-15ft clear path' },
    { label: 'Regional', value: 10, desc: '10-12ft clear path' },
    { label: 'Neighborhood', value: 5, desc: '5-8ft clear path' }
  ];
  
  const [showReadyTimer, setShowReadyTimer] = React.useState(false);
  const [isExiting, setIsExiting] = React.useState(false);
  
  React.useEffect(() => {
    if (workflowStep === WORKFLOW_STEPS.PREVIEW) {
      setShowReadyTimer(true);
      setIsExiting(false);
      
      // Start exit animation slightly before unmounting
      const exitTimer = setTimeout(() => {
        setIsExiting(true);
      }, 4500);

      const timer = setTimeout(() => {
        setShowReadyTimer(false);
      }, 5000);
      
      return () => {
        clearTimeout(exitTimer);
        clearTimeout(timer);
      };
    } else {
      setShowReadyTimer(false);
      setIsExiting(false);
    }
  }, [workflowStep]);

  const isIntersections = geographyType === 'intersections';

  // Only visible during creation OR during the brief "Ready" preview timer
  if (!isIntersections) return null;
  if (previewActive && !showReadyTimer) return null;

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden transition-all duration-500 ease-in-out ${isExiting ? 'opacity-0 transform -translate-y-4 max-h-0' : 'opacity-100 transform translate-y-0 max-h-[1000px]'}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tight">Zone Creator</h3>
          <div className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase">
            Intersections
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Create a custom street zone by connecting intersections.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Interactive Creation */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-800 text-[10px] text-gray-600 dark:text-gray-400">1</span>
            Build Your Zone
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
            {workflowStep === WORKFLOW_STEPS.PICK_START && (
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <MousePointer2 className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Pick a starting point</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Click any <span className="text-orange-500 font-bold">orange point</span> on the map to begin your street zone.</p>
                </div>
              </div>
            )}

            {workflowStep === WORKFLOW_STEPS.EXTEND_ZONE && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">Path In Progress</span>
                  </div>
                  <span className="text-[10px] font-mono bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400">
                    {selectedNodeIds.length} Nodes
                  </span>
                </div>

                <div className="flex flex-col space-y-3">
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                      Click the <span className="font-bold text-blue-600">blue pills</span> on the map to extend your zone block-by-block.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={undoLastNode} 
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Undo
                    </button>
                    <button 
                      onClick={() => {
                        const evt = new CustomEvent('zonecreator:reset');
                        window.dispatchEvent(evt);
                      }} 
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                      Restart
                    </button>
                  </div>
                </div>
              </div>
            )}

            {workflowStep === WORKFLOW_STEPS.PREVIEW && (
              <div className="flex flex-col items-center text-center space-y-3 animate-in fade-in zoom-in duration-500">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-bounce">
                  <Check className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Zone Ready!</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Your custom street zone has been generated. You can now add objects and infrastructure.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Zone Width & Actions */}
        {(workflowStep === WORKFLOW_STEPS.EXTEND_ZONE || workflowStep === WORKFLOW_STEPS.PICK_START) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Zone Width</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="w-16 px-2 py-1 text-sm font-mono border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  min={6}
                  max={200}
                  step={2}
                  value={widthFeet}
                  onChange={(e) => setWidthFeet(Math.max(6, Math.min(200, Number(e.target.value) || 0)))}
                />
                <span className="text-xs font-medium text-gray-500">ft</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Pedestrian Mobility (PAR)</label>
                {pmpClassification && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 animate-in fade-in slide-in-from-right-2">
                    <Check className="w-2.5 h-2.5" />
                    Auto-detected
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {CORRIDOR_OPTIONS.map(opt => {
                  const isAutoSelected = pmpClassification && pmpClassification.clearPathFt === opt.value;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => setSidewalkClearPathFt(opt.value)}
                      className={`flex flex-col items-start p-2 rounded-lg border transition-all ${
                        sidewalkClearPathFt === opt.value
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 ring-1 ring-blue-500'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-bold ${sidewalkClearPathFt === opt.value ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                            {opt.label} Corridor
                          </span>
                          {isAutoSelected && (
                            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-tighter bg-emerald-100 dark:bg-emerald-900/40 px-1 rounded">MATCH</span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono font-bold">{opt.value}ft+</span>
                      </div>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {workflowStep === WORKFLOW_STEPS.EXTEND_ZONE && (
              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white text-sm font-bold shadow-md shadow-blue-200 dark:shadow-none transition-all transform active:scale-[0.98]"
                disabled={selectedNodeIds.length < 2}
                onClick={() => {
                  const evt = new CustomEvent('zonecreator:generate');
                  window.dispatchEvent(evt);
                }}
              >
                <Check className="w-4 h-4" />
                Finish & Generate Zone
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ZoneCreatorPanel;
