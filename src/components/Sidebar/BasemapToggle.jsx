import React, { useState, useEffect } from 'react';
import { Map, Loader2 } from 'lucide-react';
import { switchBasemap } from '../../utils/mapUtils';
import { BASEMAP_OPTIONS } from '../../constants/mapConfig';

const BasemapToggle = ({ map, onStyleChange }) => {
  const [currentBasemap, setCurrentBasemap] = useState('arcgis');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingKey, setLoadingKey] = useState(null);

  // Sync with actual map style when map loads
  useEffect(() => {
    if (!map) return;
    
    // Check if map has a style loaded
    const checkMapStyle = () => {
      try {
        // Prefer explicit app-level tracker if available
        if (map.__currentBasemap) {
          setCurrentBasemap(map.__currentBasemap);
          return;
        }

        const style = map.getStyle();
        if (style && style.sources) {
          // Try to determine current basemap from style sources and layers
          if (map.getLayer('nyc-satellite-layer')) {
            setCurrentBasemap('satellite');
          } else if (style.sprite && style.sprite.includes('cartocdn')) {
            setCurrentBasemap('carto');
          } else if (style.sprite && style.sprite.includes('arcgis')) {
            setCurrentBasemap('arcgis');
          }
        }
      } catch (error) {
        console.log('Could not determine current map style:', error);
      }
    };

    // Check immediately if map is already loaded
    if (map.isStyleLoaded()) {
      checkMapStyle();
    } else {
      // Wait for style to load
      map.once('style.load', checkMapStyle);
    }
  }, [map]);

  const handleBasemapChange = async (basemapKey) => {
    if (!map || basemapKey === currentBasemap || isLoading) return;
    
    console.log(`Switching basemap from ${currentBasemap} to ${basemapKey}`);
    setIsLoading(true);
    setLoadingKey(basemapKey);
    
    // Store the previous basemap for potential rollback
    const previousBasemap = currentBasemap;
    
    try {
      setCurrentBasemap(basemapKey);
      await switchBasemap(map, basemapKey, onStyleChange);
      console.log(`Successfully switched to ${basemapKey} basemap`);
    } catch (error) {
      console.error(`Failed to switch to ${basemapKey} basemap:`, error);
      // Revert the state if switching failed
      setCurrentBasemap(previousBasemap);
    } finally {
      setIsLoading(false);
      setLoadingKey(null);
    }
  };

  if (!map) return null;

  return (
    <div className="px-3 py-2.5 border-b border-gray-200/60 dark:border-gray-700/60 bg-gradient-to-r from-gray-50/80 to-white/60 dark:from-gray-900/80 dark:to-gray-800/60">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Map className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Map Style</span>
      </div>
      
      {/* Basemap Options */}
      <div className="flex gap-1.5">
        {Object.entries(BASEMAP_OPTIONS).map(([key, basemap]) => {
          const isActive = currentBasemap === key;
          const isLoadingThis = loadingKey === key;
          
          return (
            <button
              key={key}
              onClick={() => handleBasemapChange(key)}
              disabled={isLoading}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-2 rounded-xl transition-all active:scale-95 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200/60 dark:border-gray-700/60'
              } ${isLoading && !isActive ? 'opacity-60 cursor-not-allowed' : ''}`}
              aria-label={`Switch to ${basemap.name} map style`}
              title={basemap.description}
            >
              {isLoadingThis ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span className="text-base leading-none">{basemap.icon}</span>
              )}
              <span className="text-xs font-medium">{basemap.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BasemapToggle; 