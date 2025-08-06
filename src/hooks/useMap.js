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
        
        // Wait for both map load and style load before setting mapLoaded
        const checkFullyLoaded = () => {
          if (mapInstance.loaded() && mapInstance.isStyleLoaded()) {
            console.log('Map and style fully loaded');
            setMapLoaded(true);
            setStyleLoaded(true);
          }
        };

        // Check immediately
        checkFullyLoaded();
        
        // Set up listeners for future style changes
        mapInstance.on('style.load', () => {
          console.log('Style loaded');
          setStyleLoaded(true);
          checkFullyLoaded();
        });
        
        mapInstance.on('data', (e) => {
          if (e.dataType === 'style') {
            checkFullyLoaded();
          }
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