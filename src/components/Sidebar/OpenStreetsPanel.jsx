// src/components/Sidebar/OpenStreetsPanel.jsx
import React, { useState } from 'react';
import { Calendar, Info, Loader2, AlertTriangle, CheckCircle2, Map as MapIcon, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useOpenStreetsContext } from '../../contexts/OpenStreetsContext';

const OpenStreetsPanel = ({ focusedArea = null }) => {
  const { openStreetsData, loading, error, isVisible, toggleVisibility } = useOpenStreetsContext();
  const [segmentsExpanded, setSegmentsExpanded] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false); // Hidden by default

  const activeFeatures = openStreetsData?.features || [];
  const activeTodayCount = activeFeatures.filter(f => f.properties.is_active_today).length;

  return (
    <div className="open-streets-panel bg-gradient-to-br from-purple-50/80 to-indigo-50/80 dark:from-purple-950/40 dark:to-indigo-950/40 rounded-xl border border-purple-200/60 dark:border-purple-800/40 overflow-hidden">
      {/* Header - Clickable to toggle */}
      <button
        onClick={() => setPanelExpanded(!panelExpanded)}
        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-700 dark:to-indigo-700 px-3 py-2 hover:from-purple-500 hover:to-indigo-500 dark:hover:from-purple-600 dark:hover:to-indigo-600 transition-all"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChevronRight className={`w-3.5 h-3.5 text-white/70 transition-transform duration-200 ${panelExpanded ? 'rotate-90' : ''}`} />
            <Calendar className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white">Open Streets Events</h3>
          </div>
          {/* Collapsed summary */}
          {!panelExpanded && (
            <span className="flex items-center gap-2 text-[10px] text-white/70">
              {isVisible ? (
                <>
                  <Eye className="w-3 h-3" />
                  <span>{activeFeatures.length} segments</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3" />
                  <span>Off</span>
                </>
              )}
            </span>
          )}
        </div>
      </button>

      {/* Collapsible Content */}
      <div className={`transition-all duration-200 ease-in-out overflow-hidden ${panelExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        {/* Visibility Toggle Row - Larger touch target */}
        <div className="px-3 py-3 border-b border-purple-100 dark:border-purple-800/30 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show on Map</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleVisibility();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
              isVisible
                ? 'bg-purple-600 text-white shadow-sm hover:bg-purple-700'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
            }`}
            aria-label={isVisible ? 'Click to hide Open Streets layer' : 'Click to show Open Streets layer'}
          >
            {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {isVisible ? 'Visible' : 'Hidden'}
          </button>
        </div>

        <div className="p-3">

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-purple-500" />
            <p className="text-sm font-medium">Loading Open Streets data...</p>
            <p className="text-xs text-gray-400 mt-1">This may take a moment</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border-2 border-red-200 dark:border-red-800/40">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">Unable to Load Data</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
              </div>
            </div>
          </div>
        ) : !isVisible ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <MapIcon className="w-7 h-7 text-purple-500 dark:text-purple-400" />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Open Streets Layer is Hidden
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-[200px] mx-auto">
              Click below to see Open Streets events on the map
            </p>
            <button
              onClick={toggleVisibility}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-sm"
            >
              Show Open Streets
            </button>
          </div>
        ) : activeFeatures.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <MapIcon className="w-7 h-7 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {focusedArea 
                ? 'No Open Streets in This Area'
                : 'Zoom In to See Open Streets'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-[200px] mx-auto">
              {focusedArea 
                ? 'Try selecting a different location'
                : 'Pan and zoom the map to explore Open Streets citywide'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats Cards - Larger, clearer */}
            <div className="flex gap-3">
              <div className="flex-1 bg-white/80 dark:bg-gray-800/80 p-3 rounded-xl text-center border-2 border-purple-200/60 dark:border-purple-800/40 shadow-sm">
                <span className="block text-2xl font-bold text-purple-700 dark:text-purple-400">{activeFeatures.length}</span>
                <span className="text-xs font-medium text-purple-600 dark:text-purple-500">Street Segments</span>
              </div>
              <div className="flex-1 bg-white/80 dark:bg-gray-800/80 p-3 rounded-xl text-center border-2 border-emerald-200/60 dark:border-emerald-800/40 shadow-sm">
                <span className="block text-2xl font-bold text-emerald-700 dark:text-emerald-400">{activeTodayCount}</span>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-500">Active Today</span>
              </div>
            </div>

            {/* Legend - Clearer labels */}
            <div className="bg-gray-50/80 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200/60 dark:border-gray-700/60">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Map Colors:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-purple-500"></span><span className="text-gray-700 dark:text-gray-300">Daily events</span></span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500"></span><span className="text-gray-700 dark:text-gray-300">Frequent</span></span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-300"></span><span className="text-gray-700 dark:text-gray-300">Weekends</span></span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-200"></span><span className="text-gray-700 dark:text-gray-300">Occasional</span></span>
              </div>
            </div>

            {/* Segments List - Larger touch targets */}
            <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl border-2 border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
              <button
                onClick={() => setSegmentsExpanded(!segmentsExpanded)}
                className="w-full flex items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-300 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                aria-expanded={segmentsExpanded}
              >
                <span>Nearby Segments ({activeFeatures.length})</span>
                {segmentsExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </button>
              
              {segmentsExpanded && (
                <div className="border-t border-gray-200/60 dark:border-gray-700/60 max-h-[240px] overflow-y-auto">
                  {activeFeatures.slice(0, 10).map((f, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const id = f.properties?.object_id || f.id;
                        window.dispatchEvent(new CustomEvent('openstreet:click', { 
                          detail: { properties: f.properties, id } 
                        }));
                      }}
                      className="w-full text-left p-3 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors cursor-pointer active:bg-purple-100 dark:active:bg-purple-900/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">{f.properties.appronstre}</p>
                        {f.properties.is_active_today && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold flex-shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{f.properties.apprfromst} → {f.properties.apprtostre}</p>
                      {f.properties.orgname && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                          <span>🏢</span> {f.properties.orgname}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="h-2 flex-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-purple-500 rounded-full" 
                            style={{ width: `${(f.properties.activation_density / 7) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 min-w-[35px]">
                          {f.properties.activation_density}/7 days
                        </span>
                      </div>
                    </button>
                  ))}
                  {activeFeatures.length > 10 && (
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400 py-3 bg-gray-50 dark:bg-gray-800/50">
                      +{activeFeatures.length - 10} more segments available
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Info footer */}
            <div className="flex gap-1.5 pt-2 border-t border-purple-100 dark:border-purple-800/30">
              <Info className="w-3 h-3 text-purple-400 flex-shrink-0 mt-0.5" />
              <p className="text-[9px] text-purple-600 dark:text-purple-400 leading-tight">
                Hover/click segments on map for schedule details
              </p>
            </div>
          </div>
        )}
        </div>
        
        {/* Data Source Attribution */}
        <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900/50 border-t border-purple-100 dark:border-purple-800/30">
          <p className="text-[9px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            Data: NYC Open Data Portal
          </p>
        </div>
      </div>
    </div>
  );
};

export default OpenStreetsPanel;

