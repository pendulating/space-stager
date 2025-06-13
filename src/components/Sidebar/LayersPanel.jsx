// components/Sidebar/LayersPanel.jsx
import React from 'react';
import { Eye, EyeOff, X, MapPin, Route } from 'lucide-react';

const LayersPanel = ({ 
  layers, 
  focusedArea, 
  mode,
  onToggleLayer, 
  onClearFocus,
  onToggleMode
}) => {
  const renderLayerItem = (layerId, config) => {
    const isPermitLayer = layerId === 'permitAreas';
    // In SAPO mode, disable permit areas; in parks mode, enable permit areas or if focused area exists
    const isEnabled = mode === 'sapo' ? !isPermitLayer : (isPermitLayer || focusedArea);
    const isLoading = config.loading || false;
    
    return (
      <div
        key={layerId}
        className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg ${
          isEnabled ? '' : 'opacity-50 cursor-not-allowed'
        }`}
      >
        <div className="flex items-center space-x-3">
          <button
            onClick={() => isEnabled && onToggleLayer(layerId)}
            className={`p-1 rounded ${
              isEnabled ? 'cursor-pointer hover:bg-gray-200' : 'cursor-not-allowed'
            }`}
            disabled={!isEnabled || isLoading}
          >
            {config.visible ? (
              <Eye className={`w-5 h-5 ${isEnabled ? 'text-blue-600' : 'text-gray-400'}`} />
            ) : (
              <EyeOff className={`w-5 h-5 ${isEnabled ? 'text-gray-600' : 'text-gray-400'}`} />
            )}
          </button>
          <div
            className={`w-4 h-4 rounded-full ${isLoading ? 'animate-pulse' : ''}`}
            style={{ 
              backgroundColor: isLoading ? '#9CA3AF' : config.color, 
              opacity: config.visible && isEnabled ? 1 : 0.3 
            }}
          />
          <span className={`text-sm font-medium ${
            config.visible && isEnabled ? 'text-gray-800' : 'text-gray-500'
          }`}>
            {config.name}
            {isLoading && (
              <span className="ml-1 text-xs text-gray-500">(Loading...)</span>
            )}
            {mode === 'sapo' && isPermitLayer && (
              <span className="ml-1 text-xs text-gray-400">(Disabled in SAPO mode)</span>
            )}
          </span>
        </div>
        {config.error && (
          <span className="text-xs text-red-500 ml-2">Error</span>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          NYC Infrastructure Layers
        </h3>
        
        {/* Mode Toggle */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">Planning Mode</span>
          </div>
          <div className="flex bg-white rounded-md p-1 border">
            <button
              onClick={onToggleMode}
              className={`flex-1 flex items-center justify-center px-3 py-2 text-xs font-medium rounded transition-colors ${
                mode === 'parks'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <MapPin className="w-3 h-3 mr-1" />
              Parks & Rec
            </button>
            <button
              onClick={onToggleMode}
              className={`flex-1 flex items-center justify-center px-3 py-2 text-xs font-medium rounded transition-colors ${
                mode === 'sapo'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Route className="w-3 h-3 mr-1" />
              SAPO
            </button>
          </div>
        </div>
        
        {focusedArea && mode === 'parks' && (
          <div className="mb-3 bg-blue-50 p-2 rounded-md text-xs text-blue-700 flex justify-between items-center">
            <div>
              <span className="font-medium">Focus active:</span> {
                focusedArea.properties.name || 'Unnamed Area'
              }
            </div>
            <button 
              onClick={onClearFocus}
              className="text-blue-600 hover:text-blue-800 p-1"
              title="Clear Focus"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {!focusedArea && mode === 'parks' && (
          <div className="mb-3 bg-amber-50 p-2 rounded-md text-xs text-amber-700">
            Click on permit areas to explore overlapping zones. 
            Multiple areas? Use the selector popup.
          </div>
        )}
        
        {mode === 'sapo' && (
          <div className="mb-3 bg-green-50 p-2 rounded-md text-xs text-green-700">
            SAPO mode: Plan events between any two intersections.
            Click map locations to set start and end points.
          </div>
        )}
        
        <div className="space-y-2">
          {Object.entries(layers).map(([layerId, config]) => 
            renderLayerItem(layerId, config)
          )}
        </div>
      </div>
    </div>
  );
};

export default LayersPanel;