import { useEffect, useRef, useState } from 'react';
import { loadMapLibraries, initializeMap } from '../utils/mapUtils';

export const useMap = (mapContainer) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current) return;

    const setupMap = async () => {
      try {
        await loadMapLibraries();
        const mapInstance = await initializeMap(mapContainer.current);
        mapRef.current = mapInstance;
        setMap(mapInstance);
        setMapLoaded(true);
      } catch (error) {
        console.error('Map setup failed:', error);
        setMapLoaded(false);
      }
    };

    setupMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMap(null);
    };
  }, [mapContainer]);

  return { map, mapLoaded };
};