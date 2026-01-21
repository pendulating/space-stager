import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useZoneCreatorContext, WORKFLOW_STEPS } from '../../contexts/ZoneCreatorContext.jsx';
import { ChevronRight, RotateCcw, Check, X, MousePointer2, Settings2, ChevronDown, Info } from 'lucide-react';

const ZoneCreatorPanel = ({ geographyType, showExpanded = false }) => {
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
    { label: 'Global', value: 12, desc: '12-15ft pedestrian clear path', shortDesc: '12-15ft' },
    { label: 'Regional', value: 10, desc: '10-12ft pedestrian clear path', shortDesc: '10-12ft' },
    { label: 'Neighborhood', value: 5, desc: '5-8ft pedestrian clear path', shortDesc: '5-8ft' }
  ];
  
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [dimensionsExpanded, setDimensionsExpanded] = useState(false); // Hidden by default
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          buttonRef.current && !buttonRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Update dropdown position on scroll/resize when open
  useEffect(() => {
    if (!dropdownOpen || !buttonRef.current) return;
    
    const updatePosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPos({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width
        });
      }
    };
    
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [dropdownOpen]);
  
  const selectedCorridor = CORRIDOR_OPTIONS.find(opt => opt.value === sidewalkClearPathFt) || CORRIDOR_OPTIONS[0];
  const isAutoDetected = pmpClassification && pmpClassification.clearPathFt === sidewalkClearPathFt;
  
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
    <div className={`flex flex-col bg-white dark:bg-gray-900 overflow-hidden transition-all duration-500 ease-in-out ${
      isExiting 
        ? 'opacity-0 transform -translate-y-4 max-h-0' 
        : showExpanded 
          ? 'opacity-100 transform translate-y-0 h-full' 
          : 'opacity-100 transform translate-y-0 max-h-[1000px]'
    }`}>
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

      <div className={`flex-1 overflow-y-auto p-4 space-y-6 ${showExpanded ? 'min-h-0' : ''}`}>
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

        {/* Zone Dimensions Card - Combined Width & PAR */}
        {(workflowStep === WORKFLOW_STEPS.EXTEND_ZONE || workflowStep === WORKFLOW_STEPS.PICK_START) && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-800 dark:to-gray-850 rounded-xl border border-gray-200 dark:border-gray-700">
              {/* Card Header - Clickable to toggle */}
              <button
                onClick={() => setDimensionsExpanded(!dimensionsExpanded)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-white/50 dark:bg-gray-900/30 rounded-t-xl hover:bg-white/80 dark:hover:bg-gray-900/50 transition-colors"
              >
                <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${dimensionsExpanded ? 'rotate-90' : ''}`} />
                <Settings2 className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Zone Dimensions</span>
                {/* Collapsed summary */}
                {!dimensionsExpanded && (
                  <span className="ml-auto text-[10px] font-mono text-gray-500 dark:text-gray-400">
                    {widthFeet}ft • {selectedCorridor.label}
                  </span>
                )}
                {dimensionsExpanded && isAutoDetected && (
                  <div className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                    <Check className="w-2.5 h-2.5" />
                    Auto
                  </div>
                )}
              </button>
              
              {/* Collapsible Controls */}
              <div className={`transition-all duration-200 ease-in-out overflow-hidden ${dimensionsExpanded ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  {/* Width Control */}
                  <div className="flex-1 min-w-0">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Width</label>
                    <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5">
                      <input
                        type="number"
                        className="w-12 text-sm font-mono font-semibold bg-transparent text-gray-900 dark:text-gray-100 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        min={6}
                        max={200}
                        step={2}
                        value={widthFeet}
                        onChange={(e) => setWidthFeet(Math.max(6, Math.min(200, Number(e.target.value) || 0)))}
                      />
                      <span className="text-[11px] font-medium text-gray-400">ft</span>
                    </div>
                  </div>
                  
                  {/* Divider */}
                  <div className="w-px h-10 bg-gray-200 dark:bg-gray-700" />
                  
                  {/* Clearance Dropdown */}
                  <div className="flex-1 min-w-0">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Clearance</label>
                    <button
                      ref={buttonRef}
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className={`w-full flex items-center justify-between gap-2 bg-white dark:bg-gray-800 rounded-lg border px-2.5 py-1.5 transition-all ${
                        dropdownOpen 
                          ? 'border-blue-500 ring-1 ring-blue-500' 
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {selectedCorridor.label}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {/* Dropdown Menu - Portal to escape overflow clipping */}
                    {dropdownOpen && createPortal(
                      <div 
                        ref={dropdownRef}
                        className="fixed z-[9999] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
                        style={{
                          top: dropdownPos.top,
                          left: dropdownPos.left,
                          width: dropdownPos.width
                        }}
                      >
                        {CORRIDOR_OPTIONS.map(opt => {
                          const isMatch = pmpClassification && pmpClassification.clearPathFt === opt.value;
                          const isSelected = sidewalkClearPathFt === opt.value;
                          return (
                            <button
                              key={opt.label}
                              onClick={() => {
                                setSidewalkClearPathFt(opt.value);
                                setDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 transition-colors ${
                                isSelected 
                                  ? 'bg-blue-50 dark:bg-blue-900/20' 
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                  {opt.label}
                                </span>
                                {isMatch && (
                                  <span className="text-[9px] font-bold uppercase tracking-tight px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                                    Match
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{opt.shortDesc}</span>
                            </button>
                          );
                        })}
                      </div>,
                      document.body
                    )}
                  </div>
                </div>
                
                {/* Info Line */}
                <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-gray-200/60 dark:border-gray-700/60">
                  <Info className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-gray-600 dark:text-gray-300">{selectedCorridor.label}:</span>{' '}
                    {selectedCorridor.desc}
                  </p>
                </div>
              </div>
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
