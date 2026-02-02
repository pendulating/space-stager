// components/Sidebar/LayersPanel.jsx
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Eye, EyeOff, X, Layers, ToggleLeft, ToggleRight, ChevronDown, ChevronRight, Loader2, CheckCircle, AlertCircle, Circle, FileText, Download, Minus, Pencil, Check } from 'lucide-react';
import { LAYER_GROUPS, DISABLED_INFRASTRUCTURE_LAYERS, NON_RECOMMENDED_INFRASTRUCTURE_LAYERS } from '../../constants/layers';
import { INFRASTRUCTURE_ICONS, svgToDataUrl } from '../../utils/iconUtils';
import { getCandidateSrcs, preloadChain, firstReadyInChain } from '../../utils/spriteResolver';

import { useMapViewState } from '../../hooks/useMapViewState';
import { useZoneCreatorContext } from '../../contexts/ZoneCreatorContext';
import { AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';

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
  const { complianceStatus } = useZoneCreatorContext();
  const safetyData = focusedArea?.properties?.safety;
  const view = useMapViewState(map);
  // State for tracking which groups are expanded - start collapsed to reduce clutter
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  
  // State for infrastructure section collapse - expanded only when focused
  const [infrastructureExpanded, setInfrastructureExpanded] = useState(false);
  
  // State for safety compliance section collapse - collapsed by default
  const [safetyComplianceExpanded, setSafetyComplianceExpanded] = useState(false);
  
  // State for editing the zone name
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const nameInputRef = useRef(null);
  
  // Auto-expand infrastructure when a focused area is selected
  useEffect(() => {
    if (focusedArea && !infrastructureExpanded) {
      setInfrastructureExpanded(true);
    }
  }, [focusedArea]);
  
  // Focus the input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);
  
  // Get the current display name
  const getDisplayName = () => {
    return focusedArea?.properties?.name || 
      [focusedArea?.properties?.FSN_1, focusedArea?.properties?.FSN_2, focusedArea?.properties?.FSN_3, focusedArea?.properties?.FSN_4].filter(Boolean).join(' & ') || 
      'Unnamed Area';
  };
  
  // Start editing the name
  const handleStartEditName = () => {
    setEditedName(getDisplayName());
    setIsEditingName(true);
  };
  
  // Save the edited name
  const handleSaveName = () => {
    const trimmedName = editedName.trim();
    if (trimmedName && permitAreas?.updateFocusedAreaName) {
      permitAreas.updateFocusedAreaName(trimmedName);
    }
    setIsEditingName(false);
  };
  
  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditedName('');
  };
  
  // Handle key presses in the input
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

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
          className={`flex items-center justify-between p-3 bg-white/80 dark:bg-gray-800/60 rounded-xl border-2 transition-all ${
            isEnabled 
              ? 'border-gray-200/60 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer' 
              : 'border-gray-100 dark:border-gray-800 opacity-50 cursor-not-allowed'
          }`}
          onClick={() => isEnabled && toggleGroupExpansion(groupId)}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8">
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              )}
            </div>
            <span className="text-lg">{group.icon}</span>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{group.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{effective.length} layers</p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isEnabled) handleGroupToggle(groupId);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
              !isEnabled 
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed' 
                : isActive 
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600'
            }`}
            disabled={!isEnabled}
            aria-label={!isEnabled ? "Select an area first" : isActive ? "Hide all" : "Show all"}
          >
            {isActive ? 'On' : 'Off'}
          </button>
        </div>
        
        {isExpanded && (
          <div className="ml-4 mt-2 space-y-1.5 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
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
        className={`flex items-center justify-between ${isInGroup ? 'p-2.5 bg-white/60 dark:bg-gray-800/40' : 'p-3 bg-gray-50/80 dark:bg-gray-900/50'} rounded-xl border border-gray-200/40 dark:border-gray-700/40 ${
          isEnabled ? '' : 'opacity-50 cursor-not-allowed'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {renderLayerIcon(layerId, config)}
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium truncate ${
              isRequested && isEnabled ? 'text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
            }`}>
              {layerId === 'permitAreas' ? (geographyType === 'plazas' ? 'Plazas' : geographyType === 'intersections' ? 'Intersections' : 'Parks') : (config.name)}
            </p>
            {/* Status indicator text */}
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {isLoading ? 'Loading...' : isError ? 'Error' : isRequested && isLoaded && isEmpty ? 'No data' : isRequested && isLoaded ? 'Loaded' : 'Hidden'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Subway lines toggle (only for subway entrances) */}
          {isSubwayEntrances && onToggleSubwayLines && (
            <button
              onClick={() => subwayLinesEnabled && !subwayLinesConfig?.disabled && onToggleSubwayLines('subwayLines')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                !subwayLinesEnabled 
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed' 
                  : subwayLinesRequested 
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
              }`}
              disabled={!subwayLinesEnabled || subwayLinesLoading}
              aria-label="Toggle subway lines"
            >
              Lines
            </button>
          )}
          
          {/* Main toggle button */}
          <button
            onClick={() => isEnabled && !config.disabled && onToggleLayer(layerId)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
              !isEnabled 
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed' 
                : isRequested 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600'
            }`}
            disabled={!isEnabled || isLoading}
            aria-label={isRequested ? "Hide layer" : "Show layer"}
          >
            {isRequested ? 'On' : 'Off'}
          </button>
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
  // Also exclude disabled layers from showing in the "Other" section
  const ungroupedLayers = Object.entries(layers).filter(([layerId]) => 
    layerId !== 'permitAreas' && 
    !groupedLayerIds.has(layerId) && 
    !DISABLED_INFRASTRUCTURE_LAYERS.has(layerId)
  );

  return (
    <div className="h-full flex flex-col layers-panel">
      {/* Compact Header Section */}
      <div className="bg-white/50 dark:bg-gray-900/50 p-3 space-y-2">
        {/* Focused Area Info - Concentric Pill Design */}
        {focusedArea && (
          <div className="relative">
            {/* Outer ring label */}
            <div className="bg-blue-600 dark:bg-blue-700 text-white text-[12px] font-medium px-2 py-0.5 rounded-t-lg">
              Designing a {geographyType === 'intersections' ? 'SAPO / Open Streets' : 'Parks'} site plan for:
            </div>
            {/* Inner content pill */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 p-2 rounded-b-lg border border-t-0 border-blue-600 dark:border-blue-700">
              <div className="flex flex-col gap-2">
                {/* Zone name - Editable in place */}
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse flex-shrink-0"></div>
                  {isEditingName ? (
                    <div className="flex-1 flex items-center gap-1.5">
                      <input
                        ref={nameInputRef}
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleSaveName}
                        className="flex-1 px-2 py-1 text-sm font-medium text-blue-800 dark:text-blue-200 bg-white dark:bg-gray-800 border-2 border-blue-400 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter zone name..."
                        aria-label="Edit zone name"
                      />
                      <button
                        onClick={handleSaveName}
                        className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                        aria-label="Save name"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleStartEditName}
                      className="flex-1 flex items-center gap-2 group text-left hover:bg-blue-100/50 dark:hover:bg-blue-900/30 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors"
                      title="Click to edit zone name"
                      aria-label="Click to edit zone name"
                    >
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200 truncate">
                        {getDisplayName()}
                      </p>
                      <Pencil className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </button>
                  )}
                </div>
                
                {/* Action Buttons - Larger touch targets */}
                <div className="flex flex-col gap-2">
                  {/* Primary Actions Row */}
                  <div className="flex items-stretch gap-2">
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('ui:show-event-info'))}
                      className="flex-1 px-3 py-2 rounded-xl bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-all active:scale-95 shadow-sm flex flex-col items-center justify-center leading-tight"
                      aria-label="Open event information form"
                    >
                      <span className="text-sm font-medium">Event</span>
                      <span className="text-sm font-medium">Info</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('ui:show-export-options'))}
                      className="flex-1 px-3 py-2 rounded-xl bg-indigo-600 dark:bg-indigo-700 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all active:scale-95 shadow-sm flex flex-col items-center justify-center leading-tight"
                      aria-label="Open plan export options"
                    >
                      <span className="text-sm font-medium">Export</span>
                      <span className="text-sm font-medium">Options</span>
                    </button>
                  </div>
                  {/* Secondary Actions Row */}
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
                        className="flex-1 px-3 py-2 rounded-xl bg-white/80 dark:bg-gray-800/80 border-2 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all active:scale-95 text-sm font-medium flex flex-col items-center leading-tight"
                        aria-label="Draw a sub-area to focus on"
                      >
                        <span>Define</span>
                        <span>Sub-Area</span>
                      </button>
                    )}
                    {/* Refocus button */}
                    {focusedArea && (
                      <button
                        onClick={() => {
                          try { 
                            permitAreas?.refocusActivePermitArea?.(); 
                          } catch (error) {
                            console.error('[REFOCUS] Error:', error);
                          }
                        }}
                        disabled={!permitAreas?.allowUnrestrictedZoom}
                        className={`flex-1 px-3 py-2 rounded-xl transition-all text-sm font-medium ${
                          permitAreas?.allowUnrestrictedZoom
                            ? 'bg-white/80 dark:bg-gray-800/80 border-2 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 active:scale-95'
                            : 'bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        }`}
                        aria-label={permitAreas?.allowUnrestrictedZoom ? "Recenter map to focused area" : "Zoom out first to enable refocus"}
                      >
                        Recenter Map
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
                        className="flex-1 px-3 py-2 rounded-xl bg-white/80 dark:bg-gray-800/80 border-2 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all active:scale-95 text-sm font-medium"
                        aria-label="Clear sub-area selection"
                      >
                        Clear Sub-Area
                      </button>
                    )}
                  </div>
                  
                  {/* Exit Button - Clear danger styling */}
                  <button 
                    onClick={onClearFocus}
                    className="w-full flex items-center justify-center gap-2 bg-white/80 dark:bg-gray-800/80 border-2 border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 px-4 py-2.5 rounded-xl font-medium transition-all active:scale-95"
                    aria-label="Exit design mode without saving"
                  >
                    <X className="w-5 h-5" />
                    <span className="text-sm">Exit Without Saving</span>
                  </button>
                </div>

                {/* Safety Compliance Section (SAPO specific) */}
                {geographyType === 'intersections' && (
                  <div className="mt-4 pt-4 border-t-2 border-blue-200 dark:border-blue-800">
                    {/* Section Header with Overall Status - Clickable to expand/collapse */}
                    <button
                      type="button"
                      onClick={() => setSafetyComplianceExpanded(!safetyComplianceExpanded)}
                      className="w-full flex items-center justify-between gap-2 mb-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group text-left overflow-hidden"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-blue-500 to-indigo-600 flex-shrink-0" />
                        {safetyComplianceExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                        )}
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide truncate">
                          Safety
                        </span>
                      </div>
                      {complianceStatus.isLaneClear ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 flex-shrink-0">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">VALID</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 animate-pulse flex-shrink-0">
                          <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          <span className="text-xs font-bold text-rose-700 dark:text-rose-300">ISSUE</span>
                        </div>
                      )}
                    </button>
                    
                    {/* Compliance Check Cards - Collapsible */}
                    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      safetyComplianceExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                    }`}>
                    <div className="space-y-2">
                      {/* Access & Infrastructure Check */}
                      <div className={`p-3 rounded-xl border-2 ${
                        complianceStatus.isLaneClear 
                          ? 'bg-white/80 dark:bg-gray-800/80 border-emerald-200 dark:border-emerald-800/50' 
                          : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/50'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              complianceStatus.isLaneClear 
                                ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                                : 'bg-rose-100 dark:bg-rose-900/30'
                            }`}>
                              {complianceStatus.isLaneClear ? (
                                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Emergency Access</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Fire lanes & hydrants</p>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                            complianceStatus.isLaneClear 
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' 
                              : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                          }`}>
                            {complianceStatus.isLaneClear ? 'CLEAR' : 'BLOCKED'}
                          </span>
                        </div>
                        
                        {/* Obstruction Details */}
                        {!complianceStatus.isLaneClear && complianceStatus.obstructions.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-rose-200 dark:border-rose-800/50 space-y-2">
                            <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 mb-2">Issues Found:</p>
                            {complianceStatus.obstructions.map((obs, idx) => (
                              <div key={`${obs.id}-${idx}`} className="flex items-start gap-2 p-2 bg-rose-100/50 dark:bg-rose-900/20 rounded-lg">
                                <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                                  {obs.violation === 'emergency-lane' && <><strong>Emergency Lane:</strong> {obs.name} is obstructing access.</>}
                                  {obs.violation === 'hydrant' && <><strong>Fire Hydrant:</strong> {obs.name} is within 5ft clearance zone.</>}
                                  {obs.violation === 'bike-lane' && <><strong>Bike Lane:</strong> {obs.name} is blocking the cycle path.</>}
                                  {obs.violation === 'transit-access' && <><strong>Transit Access:</strong> {obs.name} is blocking access.</>}
                                  {obs.violation === 'sidewalk-clear-path' && <><strong>Sidewalk:</strong> {obs.name} may block pedestrian path.</>}
                                  {!obs.violation && <><strong>Obstruction:</strong> {obs.name} is blocking access.</>}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Vehicle Turn Radius Check */}
                      {safetyData?.turnAnalysis && (
                        <div className={`p-3 rounded-xl border-2 ${
                          safetyData.turnAnalysis.isValid 
                            ? 'bg-white/80 dark:bg-gray-800/80 border-emerald-200 dark:border-emerald-800/50' 
                            : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/50'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                safetyData.turnAnalysis.isValid 
                                  ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                                  : 'bg-rose-100 dark:bg-rose-900/30'
                              }`}>
                                {safetyData.turnAnalysis.isValid ? (
                                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Vehicle Turns</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Fire truck swept path</p>
                              </div>
                            </div>
                            <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                              safetyData.turnAnalysis.isValid 
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' 
                                : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                            }`}>
                              {safetyData.turnAnalysis.isValid ? 'PASS' : 'FAIL'}
                            </span>
                          </div>
                          
                          {safetyData.turnAnalysis.isValid === false && (
                            <div className="mt-3 pt-3 border-t border-rose-200 dark:border-rose-800/50">
                              <div className="flex items-start gap-2 p-2 bg-rose-100/50 dark:bg-rose-900/20 rounded-lg">
                                <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                                  <strong>Turn Analysis Failed:</strong> Some turns may be too sharp for emergency vehicles. Consider widening the path.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Help Tip - Only show when there's a violation */}
                      {(!complianceStatus.isLaneClear || safetyData?.turnAnalysis?.isValid === false) && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200/60 dark:border-amber-800/40">
                          <span className="text-base">💡</span>
                          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                            <strong>How to fix:</strong> Move or remove the items marked above. Fire lanes and hydrant areas must stay clear for safety approval.
                          </p>
                        </div>
                      )}
                    </div>
                    </div>
                  </div>
                )}
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
          {/* Infrastructure Layers Header - Collapsible */}
          <button 
            type="button"
            className="w-full mb-4 flex items-center justify-start gap-3 cursor-pointer group p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
            onClick={() => setInfrastructureExpanded(!infrastructureExpanded)}
          >
            <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-emerald-500 to-teal-600 flex-shrink-0" />
            {infrastructureExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
            )}
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
              Infrastructure Layers
            </h3>
            {!infrastructureExpanded && (
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 ml-auto">
                Expand
              </span>
            )}
          </button>
          
          {/* Collapsible Infrastructure Content */}
          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
            infrastructureExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
          }`}>
          <div className="space-y-3">
            {/* All Recommended Toggle - Card style with clear action */}
            <div className={`transition-all duration-300 ${!focusedArea ? 'opacity-60' : 'opacity-100'}`}>
              <div className={`p-4 rounded-2xl border-2 ${
                focusedArea 
                  ? 'bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-gray-800/60 dark:to-gray-900/60 border-blue-200 dark:border-blue-800/50'
                  : 'bg-gray-50/80 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      focusedArea ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-800'
                    }`}>
                      <Layers className={`w-5 h-5 ${focusedArea ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${focusedArea ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
                        Load All Layers
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Hydrants, bus stops, trees, etc.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRecommendedToggle}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                      !focusedArea 
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed' 
                        : allLayersActive 
                          ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' 
                          : 'bg-white dark:bg-gray-800 border-2 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                    }`}
                    disabled={!focusedArea}
                    aria-label={!focusedArea ? "Select an area first" : allLayersActive ? "Hide all layers" : "Show all layers"}
                  >
                    {allLayersActive ? 'On' : 'Off'}
                  </button>
                </div>
                
                {/* Helpful message when no focused area */}
                {!focusedArea && (
                  <div className="mt-3 flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <span className="text-sm">💡</span>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Create a zone first, then you can load infrastructure layers
                    </p>
                  </div>
                )}
                
                {/* Loading progress */}
                {infrastructure && infrastructure.bulkLoading && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        Loading... {infrastructure.bulkProgress.completed} of {infrastructure.bulkProgress.total}
                      </p>
                      <button
                        type="button"
                        onClick={infrastructure.bulkCancelLoading}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="w-full h-3 bg-blue-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-3 bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 rounded-full" 
                        style={{ width: `${infrastructure.bulkProgress.total > 0 ? Math.round((infrastructure.bulkProgress.completed / infrastructure.bulkProgress.total) * 100) : 0}%` }} 
                      />
                    </div>
                  </div>
                )}
                
                {/* Success state when all layers are active */}
                {focusedArea && allLayersActive && !infrastructure?.bulkLoading && (
                  <div className="mt-3 flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200/60 dark:border-emerald-800/40">
                    <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">All layers loaded!</p>
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
          
          {/* Collapsed state hint */}
          {!infrastructureExpanded && focusedArea && (
            <div className="text-center py-4">
              <button
                onClick={() => setInfrastructureExpanded(true)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Show {Object.keys(LAYER_GROUPS).length} layer groups
              </button>
            </div>
          )}
          
          {/* Data Source Attribution */}
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-[9px] text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
              <span className="inline-block w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
              Data sources: NYC Open Data, OpenStreetMap
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LayersPanel;