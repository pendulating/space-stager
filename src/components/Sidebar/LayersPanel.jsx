// components/Sidebar/LayersPanel.jsx
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Eye, EyeOff, X, Layers, ToggleLeft, ToggleRight, ChevronDown, ChevronRight, Loader2, CheckCircle, AlertCircle, Circle, FileText, Download, Minus } from 'lucide-react';
import { LAYER_GROUPS, DISABLED_INFRASTRUCTURE_LAYERS, NON_RECOMMENDED_INFRASTRUCTURE_LAYERS } from '../../constants/layers';
import { INFRASTRUCTURE_ICONS, svgToDataUrl } from '../../utils/iconUtils';
import { getCandidateSrcs, preloadChain, firstReadyInChain } from '../../utils/spriteResolver';

import { useMapViewState } from '../../hooks/useMapViewState';

const LayersPanel = ({ 
  layers, 
  focusedArea, 
  onToggleLayer, 
  onClearFocus,
  isSitePlanMode = false,
  geographyType,
  map,
  infrastructure,
  permitAreas,
  hasSubFocus = false,
  onBeginSubFocus = null,
  onClearSubFocus = null,
  onToggleSubwayLines = null
}) => {
  const view = useMapViewState(map);
  // State for tracking which groups are expanded
  const [expandedGroups, setExpandedGroups] = useState(new Set(['public-infrastructure', 'nyc-parks'])); // Start with some groups expanded

  // Check if all recommended layers are currently requested
  const allLayersActive = useMemo(() => {
    const recommendedLayers = Object.entries(layers)
      .filter(([id, cfg]) => 
        id !== 'permitAreas' && 
        cfg && 
        !cfg.disabled && 
        !DISABLED_INFRASTRUCTURE_LAYERS.has(id) && 
        !NON_RECOMMENDED_INFRASTRUCTURE_LAYERS.has(id)
      );
    
    // If there are no recommended layers, return false
    if (recommendedLayers.length === 0) return false;
    
    // Check if all recommended layers are requested
    return recommendedLayers.every(([id, cfg]) => cfg && !!cfg.requested);
  }, [layers]);

  // Toggle all layers on/off (recommended = all)
  const handleRecommendedToggle = () => {
    const target = !allLayersActive;
    if (infrastructure && typeof infrastructure.bulkToggleAllRecommended === 'function') {
      infrastructure.bulkToggleAllRecommended(target);
    } else {
      Object.entries(layers)
        .filter(([id, cfg]) => id !== 'permitAreas' && cfg && !cfg.disabled)
        .forEach(([id, cfg]) => {
          if (!!cfg.requested !== target) onToggleLayer(id);
        });
    }
  };

  // Toggle group expansion
  const toggleGroupExpansion = (groupId) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  // Check if all layers in a group are requested
  const getEffectiveGroupLayers = (groupId) => {
    const group = LAYER_GROUPS[groupId];
    if (!group) return [];
    return group.layers.filter((layerId) => {
      const cfg = layers[layerId];
      // Hide subwayLines from UI - it's toggled automatically with subwayEntrances
      if (layerId === 'subwayLines') return false;
      return cfg && !cfg.disabled;
    });
  };

  const isGroupActive = (groupId) => {
    const effective = getEffectiveGroupLayers(groupId);
    if (effective.length === 0) return false;
    return effective.every(layerId => layers[layerId] && layers[layerId].requested);
  };

  // Toggle all layers in a group
  const handleGroupToggle = (groupId) => {
    const effective = getEffectiveGroupLayers(groupId);
    if (effective.length === 0) return;
    const groupActive = isGroupActive(groupId);
    effective.forEach(layerId => {
      const cfg = layers[layerId];
      const target = !groupActive;
      if (!!cfg.requested !== target) onToggleLayer(layerId);
    });
  };

  // Memoize sprite candidate sources to avoid redundant computation
  // Key: layerId + viewType + spriteBase (stable identifiers)
  const spriteCacheRef = React.useRef(new Map());
  const preloadRef = React.useRef(new Set());
  
  // Preload sprites for visible layers with enhanced rendering
  useEffect(() => {
    if (!view?.viewType) return;
    const viewType = view.viewType;
    const angle = viewType === 'isometric' ? 135 : 0;
    
    Object.entries(layers || {}).forEach(([layerId, config]) => {
      if (!config?.enhancedRendering?.enabled || !config?.enhancedRendering?.spriteBase) return;
      
      const spriteBase = config.enhancedRendering.spriteBase;
      const cacheKey = `${layerId}:${viewType}:${spriteBase}`;
      
      // Only preload once per cache key
      if (preloadRef.current.has(cacheKey)) return;
      
      const candidates = getCandidateSrcs(config, angle, viewType);
      if (candidates && candidates.length > 0) {
        // Preload the first candidate (primary sprite) to prevent pop-in
        preloadChain(candidates.slice(0, 2)).catch(() => {}); // Fire and forget
        preloadRef.current.add(cacheKey);
      }
    });
  }, [layers, view?.viewType]);
  
  // Render the appropriate icon for a layer
  const renderLayerIcon = useCallback((layerId, config) => {
    const icon = INFRASTRUCTURE_ICONS[layerId];
    
    // If enhanced rendering is enabled for this layer, use the shared spriteResolver
    // to build a robust fallback chain (flat and nested structures, legacy as last resort)
    if (config?.enhancedRendering?.enabled) {
      const viewType = view?.viewType || 'isometric';
      const angle = viewType === 'isometric' ? 135 : 0;
      
      // Create a stable cache key based on layer config that only changes when sprite data changes
      const spriteBase = config?.enhancedRendering?.spriteBase;
      const cacheKey = `${layerId}:${viewType}:${spriteBase || ''}`;
      
      // Check cache first - only recompute if config or view changed
      let candidates = spriteCacheRef.current.get(cacheKey);
      if (!candidates) {
        candidates = getCandidateSrcs(config, angle, viewType);
        spriteCacheRef.current.set(cacheKey, candidates);
        // Limit cache size to prevent memory leaks
        if (spriteCacheRef.current.size > 100) {
          const firstKey = spriteCacheRef.current.keys().next().value;
          spriteCacheRef.current.delete(firstKey);
        }
        // Preload immediately when computing new candidates
        if (candidates && candidates.length > 0) {
          preloadChain(candidates.slice(0, 2)).catch(() => {});
        }
      }
      
      // Use first ready image from cache to prevent pop-in, fallback to first candidate
      const readySrc = firstReadyInChain(candidates) || candidates[0] || null;
      return (
        <div 
          className={`w-6 h-6 flex items-center justify-center flex-shrink-0 ${config.loading ? 'animate-pulse' : ''}`}
          style={{ opacity: config.requested ? 1 : 0.3 }}
        >
          {readySrc ? (
            <img 
              src={readySrc}
              alt={config.name}
              className="w-7 h-7 object-contain"
              loading="eager"
              style={{
                filter: config.loading ? 'grayscale(100%)' : 'none',
                opacity: config.requested ? 1 : 0.6
              }}
              onError={(e) => {
                try {
                  const current = e.currentTarget.getAttribute('src');
                  const idx = candidates.indexOf(current);
                  const next = candidates[idx + 1];
                  if (next) {
                    e.currentTarget.src = next;
                  } else {
                    e.currentTarget.style.display = 'none';
                  }
                } catch (_) {}
              }}
            />
          ) : (
            <div className="w-6 h-6" />
          )}
        </div>
      );
    }

    if (!icon) {
      // Fallback to colored circle for layers without icons (like bikeLanes)
      return (
        <div
          className={`w-4 h-4 rounded-full flex-shrink-0 ${config.loading ? 'animate-pulse' : ''}`}
          style={{ 
            backgroundColor: config.loading ? '#9CA3AF' : config.color, 
            opacity: config.requested ? 1 : 0.3 
          }}
        />
      );
    }

    // Treat all as image-based for simplicity and to use your provided SVG assets
    if (icon.type === 'svg') {
      return (
        <div 
          className={`w-6 h-6 flex items-center justify-center flex-shrink-0 ${config.loading ? 'animate-pulse' : ''}`}
          style={{ opacity: config.requested ? 1 : 0.3 }}
        >
          <img 
            src={svgToDataUrl(icon.svg)} 
            alt={config.name}
            className="w-7 h-7 object-contain"
            style={{
              filter: config.loading ? 'grayscale(100%)' : 'none',
              opacity: config.requested ? 1 : 0.6
            }}
          />
        </div>
      );
    }

    if (icon.type === 'png') {
      // For PNG icons, render as image with color overlay using CSS filters
      return (
        <div 
          className={`w-6 h-6 flex items-center justify-center flex-shrink-0 ${config.loading ? 'animate-pulse' : ''}`}
          style={{ opacity: config.requested ? 1 : 0.3 }}
        >
          <img 
            src={icon.src} 
            alt={config.name}
            className="w-7 h-7 object-contain"
            style={{
              filter: config.loading ? 'grayscale(100%)' : 'none',
              opacity: config.requested ? 1 : 0.6
            }}
          />
        </div>
      );
    }

    // Fallback to colored circle
    return (
      <div
        className={`w-4 h-4 rounded-full flex-shrink-0 ${config.loading ? 'animate-pulse' : ''}`}
        style={{ 
          backgroundColor: config.loading ? '#9CA3AF' : config.color, 
          opacity: config.requested ? 1 : 0.3 
        }}
      />
    );
  }, [view?.viewType]);

  // Render a group header with toggle functionality
  const renderGroupHeader = (groupId, group) => {
    const isExpanded = expandedGroups.has(groupId);
    const isActive = isGroupActive(groupId);
    const isEnabled = focusedArea; // Groups only enabled when focused
    const effective = getEffectiveGroupLayers(groupId);

    return (
      <div key={groupId} className="mb-2">
        <div
          className={`flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg cursor-pointer transition-colors ${
            isEnabled ? 'hover:bg-gray-100 dark:hover:bg-gray-700/50' : 'opacity-50 cursor-not-allowed'
          }`}
          onClick={() => isEnabled && toggleGroupExpansion(groupId)}
        >
          <div className="flex items-center space-x-2">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            )}
            <span className="text-sm">{group.icon}</span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{group.name}</span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
              {effective.length}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isEnabled) handleGroupToggle(groupId);
            }}
            className={`p-1 rounded ${
              isEnabled ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600' : 'cursor-not-allowed'
            }`}
            disabled={!isEnabled}
            title={!isEnabled ? "Select a permit area first" : `${isActive ? 'Hide' : 'Show'} all ${group.name.toLowerCase()}`}
          >
            {isActive ? (
              <Eye className={`w-4 h-4 ${isEnabled ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500'}`} />
            ) : (
              <EyeOff className={`w-4 h-4 ${isEnabled ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`} />
            )}
          </button>
        </div>
        
        {isExpanded && (
          <div className="ml-4 mt-1 space-y-1">
            {effective.map(layerId => {
              const config = layers[layerId];
              return config ? renderLayerItem(layerId, config, true) : null;
            })}
          </div>
        )}
      </div>
    );
  };

  const renderLayerItem = (layerId, config, isInGroup = false) => {
    const isPermitLayer = layerId === 'permitAreas';
    // In DPR, enable permit areas or if focused area exists
    const isEnabled = (isPermitLayer || focusedArea) && !config.disabled;
    const isLoading = config.loading || false;
    const isRequested = !!config.requested;
    const isVisible = !!config.visible;
    const isLoaded = !!config.loaded;
    const isEmpty = !!config.empty;
    const isError = !!config.error;

    // Special handling for subway entrances: show both entrances and lines controls
    const isSubwayEntrances = layerId === 'subwayEntrances';
    const subwayLinesConfig = isSubwayEntrances ? layers.subwayLines : null;
    const subwayLinesRequested = subwayLinesConfig ? !!subwayLinesConfig.requested : false;
    const subwayLinesLoading = subwayLinesConfig ? !!subwayLinesConfig.loading : false;
    const subwayLinesEnabled = subwayLinesConfig ? (focusedArea && !subwayLinesConfig.disabled) : false;

    const renderStatusIcon = () => {
      if (isError) return <AlertCircle className="w-4 h-4 text-red-500" title="Error loading" />;
      if (isLoading) return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" title="Loading" />;
      if (isRequested && isLoaded && isEmpty) return (
        <div 
          className="w-3 h-3 rounded-full bg-gray-400 dark:bg-gray-500" 
          title="No data in this area"
        />
      );
      if (isRequested && isLoaded && !isEmpty) return <CheckCircle className="w-4 h-4 text-emerald-600" title="Loaded" />;
      return <Circle className="w-4 h-4 text-gray-400" title="Hidden" />;
    };
    
    return (
      <div
        key={layerId}
        className={`flex items-center justify-between ${isInGroup ? 'p-2 bg-white dark:bg-gray-800/50' : 'p-2.5 bg-gray-50 dark:bg-gray-900'} rounded-lg ${
          isEnabled ? '' : 'opacity-50 cursor-not-allowed'
        }`}
      >
        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
          {/* Eye button for subway entrances (or main layer) */}
          <button
            onClick={() => isEnabled && !config.disabled && onToggleLayer(layerId)}
            className={`p-1 rounded flex-shrink-0 ${
              isEnabled ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700' : 'cursor-not-allowed'
            }`}
            disabled={!isEnabled || isLoading}
            title={isSubwayEntrances ? "Toggle subway entrances" : undefined}
          >
            {isRequested ? (
              <Eye className={`w-4 h-4 ${isEnabled ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500'}`} />
            ) : (
              <EyeOff className={`w-4 h-4 ${isEnabled ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`} />
            )}
          </button>
          
          {/* Line button for subway lines (only shown for subway entrances) */}
          {isSubwayEntrances && onToggleSubwayLines && (
            <button
              onClick={() => subwayLinesEnabled && !subwayLinesConfig?.disabled && onToggleSubwayLines('subwayLines')}
              className={`p-1 rounded flex-shrink-0 ${
                subwayLinesEnabled ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700' : 'cursor-not-allowed'
              }`}
              disabled={!subwayLinesEnabled || subwayLinesLoading}
              title="Toggle subway lines"
            >
              <Minus className={`w-4 h-4 ${subwayLinesEnabled ? (subwayLinesRequested ? 'text-blue-600' : 'text-gray-600 dark:text-gray-300') : 'text-gray-400 dark:text-gray-500'}`} />
            </button>
          )}
          
          {renderLayerIcon(layerId, config)}
          <span className={`text-sm font-medium truncate ${
            isRequested && isEnabled ? 'text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
          }`}>
            {layerId === 'permitAreas' ? (geographyType === 'plazas' ? 'Plazas' : geographyType === 'intersections' ? 'Intersections' : 'Parks') : (config.name)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {renderStatusIcon()}
        </div>
      </div>
    );
  };

  // Separate permit areas and organize other layers by groups
  const permitAreasLayer = layers.permitAreas;
  
  // Get all layers that are in groups
  const groupedLayerIds = new Set();
  Object.values(LAYER_GROUPS).forEach(group => {
    group.layers.forEach(layerId => groupedLayerIds.add(layerId));
  });
  
  // Find ungrouped layers (should be none with current setup, but good for safety)
  const ungroupedLayers = Object.entries(layers).filter(([layerId]) => 
    layerId !== 'permitAreas' && !groupedLayerIds.has(layerId)
  );

  return (
    <div className="h-full flex flex-col layers-panel">
      {/* Compact Header Section */}
      <div className="bg-white dark:bg-gray-900 p-3 space-y-2">
        {/* Focused Area Info - Concentric Pill Design */}
        {focusedArea && geographyType !== 'intersections' && (
          <div className="relative">
            {/* Outer ring label */}
            <div className="bg-blue-600 dark:bg-blue-700 text-white text-[12px] font-medium px-2 py-0.5 rounded-t-lg">
              Designing a site plan for:
            </div>
            {/* Inner content pill */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 p-2 rounded-b-lg border border-t-0 border-blue-600 dark:border-blue-700">
              <div className="flex flex-col gap-2">
                {/* Zone name - Full width */}
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse flex-shrink-0"></div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200" title={(focusedArea.properties.name || [focusedArea.properties.FSN_1, focusedArea.properties.FSN_2, focusedArea.properties.FSN_3, focusedArea.properties.FSN_4].filter(Boolean).join(' & ') || 'Unnamed Area')}>
                    {focusedArea.properties.name || [focusedArea.properties.FSN_1, focusedArea.properties.FSN_2, focusedArea.properties.FSN_3, focusedArea.properties.FSN_4].filter(Boolean).join(' & ') || 'Unnamed Area'}
                  </p>
                </div>
                
                {/* Buttons rows */}
                <div className="flex flex-col gap-2">
                  {/* First row: Event Info and Plan Options */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('ui:show-event-info'))}
                      className="flex-1 text-[11px] px-2 py-1 rounded bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors whitespace-nowrap flex items-center justify-center gap-1"
                      title="Event Information"
                    >
                      <FileText className="w-3 h-3" />
                      Event Info
                    </button>
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('ui:show-export-options'))}
                      className="flex-1 text-[11px] px-2 py-1 rounded bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors whitespace-nowrap flex items-center justify-center gap-1"
                      title="Plan Options"
                    >
                      <Download className="w-3 h-3" />
                      Plan Options
                    </button>
                  </div>
                  {/* Second row: Sub-focus and Refocus buttons */}
                  <div className="flex items-center gap-2">
                    {/* Sub-focus button */}
                    {onBeginSubFocus && !hasSubFocus && (
                      <button
                        onClick={() => {
                          try { 
                            const evt = new CustomEvent('subfocus:arm'); 
                            window.dispatchEvent(evt); 
                          } catch (_) {}
                          onBeginSubFocus();
                        }}
                        className="flex-1 text-[11px] px-2 py-1 rounded bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors whitespace-nowrap"
                        title="Draw sub-area to focus"
                      >
                        Define Sub-Area
                      </button>
                    )}
                    {/* Refocus button */}
                    {focusedArea && (
                      <button
                        onClick={() => {
                          console.log('[REFOCUS DEBUG] Refocus button clicked', {
                            permitAreas,
                            hasRefocusFunc: !!permitAreas?.refocusActivePermitArea,
                            focusedArea,
                            allowUnrestrictedZoom: permitAreas?.allowUnrestrictedZoom
                          });
                          try { 
                            permitAreas?.refocusActivePermitArea?.(); 
                          } catch (error) {
                            console.error('[REFOCUS DEBUG] Error calling refocus:', error);
                          }
                        }}
                        disabled={!permitAreas?.allowUnrestrictedZoom}
                        className={`flex-1 text-[11px] px-2 py-1 rounded transition-colors whitespace-nowrap ${
                          permitAreas?.allowUnrestrictedZoom
                            ? 'bg-indigo-600 dark:bg-indigo-700 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 cursor-pointer'
                            : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-50'
                        }`}
                        title={permitAreas?.allowUnrestrictedZoom ? "Recenter to the focused permit area" : "Zoom out past boundary first to enable refocus"}
                      >
                        Refocus
                      </button>
                    )}
                    {onClearSubFocus && hasSubFocus && (
                      <button
                        onClick={() => {
                          try { 
                            const evt = new CustomEvent('subfocus:disarm'); 
                            window.dispatchEvent(evt); 
                          } catch (_) {}
                          onClearSubFocus();
                        }}
                        className="flex-1 text-[11px] px-2 py-1 rounded bg-emerald-600 dark:bg-emerald-700 text-white hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors whitespace-nowrap"
                        title="Clear sub-area focus"
                      >
                        Clear Sub-Area
                      </button>
                    )}
                  </div>
                  
                  {/* Second row: Exit without Saving - Full width, softer red */}
                  <button 
                    onClick={onClearFocus}
                    className="w-full flex items-center justify-center gap-1 bg-rose-500 dark:bg-rose-600 hover:bg-rose-600 dark:hover:bg-rose-700 text-white px-2.5 py-1.5 rounded font-medium transition-colors"
                    title="Clear Focus"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Exit without Saving</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {!focusedArea && (
          <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
            Select zone geometry to view layers
          </div>
        )}
      </div>

      {/* Scrollable Layers Section */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-3 pb-8">
          {/* Infrastructure Layers Header */}
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
              Infrastructure Layers
            </h3>
          </div>
          
          <div className="space-y-2.5">
            {/* All Recommended Toggle */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
              isSitePlanMode
                ? 'max-h-96 opacity-100 transform translate-y-0'
                : 'max-h-0 opacity-0 transform -translate-y-2'
            }`}>
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800/50 dark:to-gray-900/50 p-2.5 rounded-lg border border-blue-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-300">All Recommended</span>
                  </div>
                  <button
                    onClick={handleRecommendedToggle}
                    className="flex items-center space-x-1 transition-colors"
                    disabled={!focusedArea}
                    title={!focusedArea ? "Select a permit area first" : `${allLayersActive ? 'Hide' : 'Show'} all layers`}
                  >
                    {allLayersActive ? (
                      <ToggleRight className="w-5 h-5 text-blue-600" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    )}
                  </button>
                </div>
                {infrastructure && infrastructure.bulkLoading && (
                  <div className="mt-2 space-y-1">
                    <div className="text-[11px] text-blue-700 dark:text-blue-300 flex items-center justify-between">
                      <span>Loading ({infrastructure.bulkProgress.completed}/{infrastructure.bulkProgress.total})</span>
                      <button
                        type="button"
                        onClick={infrastructure.bulkCancelLoading}
                        className="text-[11px] px-2 py-0.5 rounded border border-blue-300 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-800"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="w-full h-1.5 bg-blue-100 dark:bg-gray-800 rounded overflow-hidden">
                      <div className="h-1.5 bg-blue-600 transition-all" style={{ width: `${infrastructure.bulkProgress.total > 0 ? Math.round((infrastructure.bulkProgress.completed / infrastructure.bulkProgress.total) * 100) : 0}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Render grouped layers */}
            {Object.entries(LAYER_GROUPS).map(([groupId, group]) => 
              renderGroupHeader(groupId, group)
            )}
            
            {/* Render any ungrouped layers (fallback) */}
            {ungroupedLayers.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Other</h4>
                <div className="space-y-2">
                  {ungroupedLayers.map(([layerId, config]) => 
                    renderLayerItem(layerId, config)
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LayersPanel;