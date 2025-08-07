import { useEffect, useRef, useState } from 'react';
import { loadMapLibraries, initializeMap } from '../utils/mapUtils';

export const useMap = (mapContainer) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [styleLoaded, setStyleLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current) return;

    const setupMap = async () => {
      try {
        await loadMapLibraries();
        const mapInstance = await initializeMap(mapContainer.current);
        mapRef.current = mapInstance;
        setMap(mapInstance);
        
        // Check immediately if map is already loaded (might happen in development)
        if (mapInstance.loaded() && mapInstance.isStyleLoaded()) {
          console.log('Map already loaded during initialization');
          setMapLoaded(true);
          setStyleLoaded(true);
        }
        
        // Use the 'load' event for initial loading
        mapInstance.on('load', () => {
          console.log('Map load event fired - map and initial style are ready');
          setMapLoaded(true);
          setStyleLoaded(true);
        });
        
        // Handle style changes (like basemap switching)
        mapInstance.on('style.load', () => {
          console.log('Style load event fired');
          setStyleLoaded(true);
        });
        
      } catch (error) {
        console.error('Map setup failed:', error);
        setMapLoaded(false);
        setStyleLoaded(false);
      }
    };

    setupMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMap(null);
      setMapLoaded(false);
      setStyleLoaded(false);
    };
  }, [mapContainer]);

  return { map, mapLoaded, styleLoaded };
};