import { useEffect, useRef, useState } from 'react';
import { loadMapLibraries, initializeMap } from '../utils/mapUtils';

export const useMap = (mapContainer) => {
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current) return;

    const setupMap = async () => {
      try {
        await loadMapLibraries();
        const mapInstance = await initializeMap(mapContainer.current);
        map.current = mapInstance;
        setMapLoaded(true);
      } catch (error) {
        console.error('Map setup failed:', error);
        setMapLoaded(false);
      }
    };

    setupMap();

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapContainer]);

  return { map: map.current, mapLoaded };
};