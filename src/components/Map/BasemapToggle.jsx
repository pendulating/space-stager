import React, { useState, useEffect } from 'react';
import { switchBasemap } from '../../utils/mapUtils';
import { BASEMAP_OPTIONS } from '../../constants/mapConfig';

const BasemapToggle = ({ map, onStyleChange }) => {
  const [currentBasemap, setCurrentBasemap] = useState('carto');
  const [isLoading, setIsLoading] = useState(false);

  // Sync with actual map style when map loads
  useEffect(() => {
    if (!map) return;
    
    // Check if map has a style loaded
    const checkMapStyle = () => {
      try {
        const style = map.getStyle();
        if (style && style.sources) {
          // Try to determine current basemap from style sources and layers
          if (map.getLayer('nyc-satellite-layer')) {
            setCurrentBasemap('satellite');
          } else if (style.sprite && style.sprite.includes('cartocdn')) {
            setCurrentBasemap('carto');
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
    }
  };

  if (!map) return null;

  return (
    <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-2">
      <div className="text-xs font-medium text-gray-700 mb-2">Basemap</div>
      <div className="flex space-x-1">
        {Object.entries(BASEMAP_OPTIONS).map(([key, basemap]) => (
          <button
            key={key}
            onClick={() => handleBasemapChange(key)}
            disabled={isLoading}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              currentBasemap === key
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading && currentBasemap !== key ? '...' : basemap.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default BasemapToggle; 