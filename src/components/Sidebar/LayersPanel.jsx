// components/Sidebar/LayersPanel.jsx
import React, { useState, useMemo } from 'react';
import { Eye, EyeOff, X, Layers, ToggleLeft, ToggleRight, ChevronDown, ChevronRight } from 'lucide-react';
import {LAYER_GROUPS } from '../../constants/layers';
import { INFRASTRUCTURE_ICONS, svgToDataUrl } from '../../utils/iconUtils';

const LayersPanel = ({ 
  layers, 
  focusedArea, 
  onToggleLayer, 
  onClearFocus,
  isSitePlanMode = false,
  geographyType
}) => {
  // State for tracking which groups are expanded
  const [expandedGroups, setExpandedGroups] = useState(new Set(['public-infrastructure', 'nyc-parks'])); // Start with some groups expanded

  // Check if all layers are currently visible (recommended = all layers)
  const allLayersActive = useMemo(() => {
    return Object.entries(layers)
      .filter(([id]) => id !== 'permitAreas')
      .every(([id, cfg]) => cfg && cfg.visible);
  }, [layers]);

  // Toggle all layers on/off (recommended = all)
  const handleRecommendedToggle = () => {
    Object.entries(layers)
      .filter(([id]) => id !== 'permitAreas')
      .forEach(([id, cfg]) => {
        if (cfg && cfg.visible === allLayersActive) {
          onToggleLayer(id);
        }
      });
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

  // Check if all layers in a group are visible
  const isGroupActive = (groupId) => {
    const group = LAYER_GROUPS[groupId];
    if (!group) return false;
    return group.layers.every(layerId => 
      layers[layerId] && layers[layerId].visible
    );
  };

  // Toggle all layers in a group
  const handleGroupToggle = (groupId) => {
    const group = LAYER_GROUPS[groupId];
    if (!group) return;
    
    const groupActive = isGroupActive(groupId);
    group.layers.forEach(layerId => {
      if (layers[layerId] && layers[layerId].visible === groupActive) {
        onToggleLayer(layerId);
      }
    });
  };

  // Render the appropriate icon for a layer
  const renderLayerIcon = (layerId, config) => {
    const icon = INFRASTRUCTURE_ICONS[layerId];
    
    if (!icon) {
      // Fallback to colored circle for layers without icons (like bikeLanes)
      return (
        <div
          className={`w-4 h-4 rounded-full ${config.loading ? 'animate-pulse' : ''}`}
          style={{ 
            backgroundColor: config.loading ? '#9CA3AF' : config.color, 
            opacity: config.visible ? 1 : 0.3 
          }}
        />
      );
    }

    // Treat all as image-based for simplicity and to use your provided SVG assets
    if (icon.type === 'svg') {
      return (
        <div 
          className={`w-6 h-6 flex items-center justify-center ${config.loading ? 'animate-pulse' : ''}`}
          style={{ opacity: config.visible ? 1 : 0.3 }}
        >
          <img 
            src={svgToDataUrl(icon.svg)} 
            alt={config.name}
            className="w-8 h-8 object-contain"
            style={{
              filter: config.loading ? 'grayscale(100%)' : 'none',
              opacity: config.visible ? 1 : 0.6
            }}
          />
        </div>
      );
    }

    if (icon.type === 'png') {
      // For PNG icons, render as image with color overlay using CSS filters
      return (
        <div 
          className={`w-6 h-6 flex items-center justify-center ${config.loading ? 'animate-pulse' : ''}`}
          style={{ opacity: config.visible ? 1 : 0.3 }}
        >
          <img 
            src={icon.src} 
            alt={config.name}
            className="w-8 h-8 object-contain"
            style={{
              filter: config.loading ? 'grayscale(100%)' : 'none',
              opacity: config.visible ? 1 : 0.6
            }}
          />
        </div>
      );
    }

    // Fallback to colored circle
    return (
      <div
        className={`w-4 h-4 rounded-full ${config.loading ? 'animate-pulse' : ''}`}
        style={{ 
          backgroundColor: config.loading ? '#9CA3AF' : config.color, 
          opacity: config.visible ? 1 : 0.3 
        }}
      />
    );
  };

  // Render a group header with toggle functionality
  const renderGroupHeader = (groupId, group) => {
    const isExpanded = expandedGroups.has(groupId);
    const isActive = isGroupActive(groupId);
    const isEnabled = focusedArea; // Groups only enabled when focused

    return (
      <div key={groupId} className="mb-2">
        <div
          className={`flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-lg cursor-pointer transition-colors ${
            isEnabled ? 'hover:bg-gray-200 dark:hover:bg-gray-700' : 'opacity-50 cursor-not-allowed'
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
            <span className="text-xs text-gray-500 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
              {group.layers.length}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isEnabled) handleGroupToggle(groupId);
            }}
            className={`p-1 rounded ${
              isEnabled ? 'cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-700' : 'cursor-not-allowed'
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
            {group.layers.map(layerId => {
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
    const isEnabled = isPermitLayer || focusedArea;
    const isLoading = config.loading || false;
    
    return (
      <div
        key={layerId}
        className={`flex items-center justify-between ${isInGroup ? 'p-2 bg-white dark:bg-gray-800' : 'p-3 bg-gray-50 dark:bg-gray-900'} rounded-lg ${
          isEnabled ? '' : 'opacity-50 cursor-not-allowed'
        }`}
      >
        <div className="flex items-center space-x-3">
          <button
            onClick={() => isEnabled && onToggleLayer(layerId)}
            className={`p-1 rounded ${
              isEnabled ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700' : 'cursor-not-allowed'
            }`}
            disabled={!isEnabled || isLoading}
          >
            {config.visible ? (
              <Eye className={`w-5 h-5 ${isEnabled ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500'}`} />
            ) : (
              <EyeOff className={`w-5 h-5 ${isEnabled ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`} />
            )}
          </button>
          {renderLayerIcon(layerId, config)}
          <span className={`text-sm font-medium ${
            config.visible && isEnabled ? 'text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
          }`}>
            {layerId === 'permitAreas' ? (geographyType === 'plazas' ? 'Plazas' : geographyType === 'intersections' ? 'Intersections' : 'Parks') : (config.name)}
            {isLoading && (
              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">(Loading...)</span>
            )}
          </span>
        </div>
        {config.error && (
          <span className="text-xs text-red-500 ml-2">Error</span>
        )}
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
      {/* Fixed Header Section */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">
          NYC Infrastructure Layers
        </h3>
        
        {/* All Recommended moved below focus panel in scroll area */}

      {/* Zone geometry - Always Fixed */}
      {permitAreasLayer && renderLayerItem('permitAreas', permitAreasLayer)}
        
        {/* Focus Area Info - Enhanced (hidden in intersections mode) */}
        {focusedArea && geographyType !== 'intersections' && (
          <div className="bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-950 dark:to-blue-900 p-3 rounded-lg border-2 border-blue-200 dark:border-blue-900 shadow-sm">
            <div className="flex justify-between items-center">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold text-blue-900 dark:text-blue-200 tracking-wide">
                    Focus Active
                  </span>
                </div>
                <div className="mt-1 text-sm font-medium text-blue-800 dark:text-blue-200 truncate" title={(focusedArea.properties.name || [focusedArea.properties.FSN_1, focusedArea.properties.FSN_2, focusedArea.properties.FSN_3, focusedArea.properties.FSN_4].filter(Boolean).join(' & ') || 'Unnamed Area')}>
                  {focusedArea.properties.name || [focusedArea.properties.FSN_1, focusedArea.properties.FSN_2, focusedArea.properties.FSN_3, focusedArea.properties.FSN_4].filter(Boolean).join(' & ') || 'Unnamed Area'}
                </div>
              </div>
              <button 
                onClick={onClearFocus}
                className="ml-3 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-700 border border-blue-300 dark:border-blue-900 hover:border-blue-400 dark:hover:border-blue-800 rounded-md p-2 text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 transition-all duration-150 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                title="Clear Focus and Return to Map View"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        
        {!focusedArea && (
          <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded-md text-xs text-amber-700 dark:text-amber-300">
            Click on the zone geometry to explore overlapping areas.
            Multiple areas? Use the selector popup.
          </div>
        )}
      </div>

      {/* Scrollable Layers Section */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4 pb-8">
          <div className="space-y-3">
            {/* All Recommended Toggle - placed above group toggles */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
              isSitePlanMode
                ? 'max-h-96 opacity-100 transform translate-y-0'
                : 'max-h-0 opacity-0 transform -translate-y-2'
            }`}>
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 p-3 rounded-lg border border-blue-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-300">All Recommended</span>
                  </div>
                  <button
                    onClick={handleRecommendedToggle}
                    className="flex items-center space-x-1 text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200 transition-colors"
                    disabled={!focusedArea}
                    title={!focusedArea ? "Select a permit area first" : `${allLayersActive ? 'Hide' : 'Show'} all layers`}
                  >
                    {allLayersActive ? (
                      <ToggleRight className="w-5 h-5 text-blue-600" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    )}
                    <span className="text-xs font-medium">
                      {allLayersActive ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Toggle all recommended layers across groups.
                </p>
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