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
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 rounded-xl border border-purple-200 dark:border-purple-800/50 overflow-hidden">
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
        {/* Visibility Toggle Row */}
        <div className="px-3 py-2 border-b border-purple-100 dark:border-purple-800/30 flex items-center justify-between">
          <span className="text-xs text-gray-600 dark:text-gray-400">Show on Map</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleVisibility();
            }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
              isVisible
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/40'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            title={isVisible ? 'Hide layer on map' : 'Show layer on map'}
          >
            {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {isVisible ? 'On' : 'Off'}
          </button>
        </div>

        <div className="p-3">

        {loading ? (
          <div className="flex items-center justify-center py-6 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <p className="text-xs">Loading...</p>
          </div>
        ) : error ? (
          <div className="p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg flex gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs">{error}</p>
          </div>
        ) : !isVisible ? (
          <div className="text-center py-4">
            <MapIcon className="w-6 h-6 mx-auto mb-2 text-purple-300 dark:text-purple-600" />
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              Enable to see Open Streets in the current view
            </p>
            <button
              onClick={toggleVisibility}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors"
            >
              Show on Map
            </button>
          </div>
        ) : activeFeatures.length === 0 ? (
          <div className="text-center py-4">
            <MapIcon className="w-6 h-6 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {focusedArea 
                ? 'No Open Streets in this area'
                : 'Pan/zoom to explore Open Streets citywide'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Stats Row */}
            <div className="flex gap-2">
              <div className="flex-1 bg-white dark:bg-gray-800 p-2 rounded-lg text-center border border-purple-100 dark:border-purple-800/30">
                <span className="block text-lg font-bold text-purple-700 dark:text-purple-400">{activeFeatures.length}</span>
                <span className="text-[9px] uppercase font-semibold text-purple-500 dark:text-purple-500">Segments</span>
              </div>
              <div className="flex-1 bg-white dark:bg-gray-800 p-2 rounded-lg text-center border border-emerald-100 dark:border-emerald-800/30">
                <span className="block text-lg font-bold text-emerald-700 dark:text-emerald-400">{activeTodayCount}</span>
                <span className="text-[9px] uppercase font-semibold text-emerald-500 dark:text-emerald-500">Active Today</span>
              </div>
            </div>

            {/* Compact Legend */}
            <div className="flex items-center gap-1 text-[9px] text-gray-500 dark:text-gray-400 justify-center flex-wrap">
              <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-purple-500"></span>Daily</span>
              <span>•</span>
              <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-orange-500"></span>Frequent</span>
              <span>•</span>
              <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-orange-300"></span>Weekend</span>
              <span>•</span>
              <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-orange-200"></span>Occasional</span>
            </div>

            {/* Collapsible Segments List */}
            <div>
              <button
                onClick={() => setSegmentsExpanded(!segmentsExpanded)}
                className="w-full flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 py-1"
              >
                <span className="font-medium">Nearby Segments ({activeFeatures.length})</span>
                {segmentsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
              
              {segmentsExpanded && (
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto mt-1">
                  {activeFeatures.slice(0, 10).map((f, idx) => (
                    <div key={idx} className="p-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-xs font-medium text-gray-900 dark:text-gray-100 line-clamp-1">{f.properties.appronstre}</p>
                        {f.properties.is_active_today && (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">{f.properties.apprfromst} - {f.properties.apprtostre}</p>
                      {f.properties.orgname && (
                        <p className="text-[9px] text-blue-600 dark:text-blue-400 mt-0.5 line-clamp-1">🏢 {f.properties.orgname}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <div className="h-1 flex-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-purple-500" 
                            style={{ width: `${(f.properties.activation_density / 7) * 100}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-medium text-purple-600 dark:text-purple-400">
                          {f.properties.activation_density}/7
                        </span>
                      </div>
                    </div>
                  ))}
                  {activeFeatures.length > 10 && (
                    <p className="text-[10px] text-center text-gray-400 py-1">
                      +{activeFeatures.length - 10} more segments
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
      </div>
    </div>
  );
};

export default OpenStreetsPanel;

