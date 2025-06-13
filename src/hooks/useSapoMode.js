import { useState, useCallback, useEffect } from 'react';

export const useSapoMode = (map, mode, drawTools) => {
  const [sapoLine, setSapoLine] = useState(null);
  const [streetBounds, setStreetBounds] = useState(null);
  const [isDrawingLine, setIsDrawingLine] = useState(false);
  const [sapoZone, setSapoZone] = useState(null);

  // Calculate buffer around line to create street view bounds
  const calculateStreetBounds = useCallback((lineCoordinates) => {
    if (!lineCoordinates || lineCoordinates.length < 2) return null;

    const bufferDistance = 0.002; // ~200 meters buffer
    let minLng = lineCoordinates[0][0];
    let minLat = lineCoordinates[0][1];
    let maxLng = lineCoordinates[0][0];
    let maxLat = lineCoordinates[0][1];

    lineCoordinates.forEach(coord => {
      minLng = Math.min(minLng, coord[0]);
      minLat = Math.min(minLat, coord[1]);
      maxLng = Math.max(maxLng, coord[0]);
      maxLat = Math.max(maxLat, coord[1]);
    });

    return [
      [minLng - bufferDistance, minLat - bufferDistance],
      [maxLng + bufferDistance, maxLat + bufferDistance]
    ];
  }, []);

  // Create rectangular zone around the street view
  const createSapoZone = useCallback((bounds) => {
    if (!bounds) return null;

    const [[minLng, minLat], [maxLng, maxLat]] = bounds;
    
    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [minLng, minLat],
          [maxLng, minLat],
          [maxLng, maxLat],
          [minLng, maxLat],
          [minLng, minLat]
        ]]
      },
      properties: {
        type: 'sapo-zone'
      }
    };
  }, []);

  // Add SAPO zone layer to map
  const addSapoZoneLayer = useCallback((zone) => {
    if (!map || !zone || !map.getStyle()) return;

    try {
      // Remove existing SAPO layers
      if (map.getLayer('sapo-zone-fill')) map.removeLayer('sapo-zone-fill');
      if (map.getLayer('sapo-zone-outline')) map.removeLayer('sapo-zone-outline');
      if (map.getSource('sapo-zone')) map.removeSource('sapo-zone');

      // Add SAPO zone source
      map.addSource('sapo-zone', {
        type: 'geojson',
        data: zone
      });

      // Add fill layer
      map.addLayer({
        id: 'sapo-zone-fill',
        type: 'fill',
        source: 'sapo-zone',
        paint: {
          'fill-color': '#10b981',
          'fill-opacity': 0.2
        }
      });

      // Add outline layer
      map.addLayer({
        id: 'sapo-zone-outline',
        type: 'line',
        source: 'sapo-zone',
        paint: {
          'line-color': '#10b981',
          'line-width': 2,
          'line-dasharray': [2, 2]
        }
      });
    } catch (error) {
      console.error('Error adding SAPO zone layer:', error);
    }
  }, [map]);

  // Start drawing line using existing draw tools
  const startDrawingLine = useCallback(() => {
    if (!drawTools || mode !== 'sapo') return;
    
    try {
      setIsDrawingLine(true);
      drawTools.activateDrawingTool('line');
      console.log('Started drawing line in SAPO mode using existing draw tools');
    } catch (error) {
      console.error('Error starting line drawing:', error);
      setIsDrawingLine(false);
    }
  }, [mode, drawTools]);

  // Handle line completion
  const handleLineComplete = useCallback((feature) => {
    if (!feature || feature.geometry.type !== 'LineString') return;

    const coordinates = feature.geometry.coordinates;
    setSapoLine(feature);
    setIsDrawingLine(false);

    // Calculate bounds and create zone
    const bounds = calculateStreetBounds(coordinates);
    setStreetBounds(bounds);

    if (bounds) {
      // Zoom to street bounds
      map.fitBounds(bounds, {
        padding: 50,
        duration: 1000
      });

      // Create and add SAPO zone
      const zone = createSapoZone(bounds);
      setSapoZone(zone);
      addSapoZoneLayer(zone);
    }
  }, [map, calculateStreetBounds, createSapoZone, addSapoZoneLayer]);

  // Clear SAPO mode
  const clearSapoMode = useCallback(() => {
    setSapoLine(null);
    setStreetBounds(null);
    setSapoZone(null);
    setIsDrawingLine(false);

    // Clear any active drawing tools
    if (drawTools) {
      drawTools.activateDrawingTool(null);
    }

    // Remove SAPO layers
    if (map && map.getStyle()) {
      try {
        if (map.getLayer('sapo-zone-fill')) map.removeLayer('sapo-zone-fill');
        if (map.getLayer('sapo-zone-outline')) map.removeLayer('sapo-zone-outline');
        if (map.getSource('sapo-zone')) map.removeSource('sapo-zone');
      } catch (error) {
        console.warn('Error removing SAPO layers:', error);
      }
    }
  }, [map, drawTools]);

  // Listen to draw events to detect line completion
  useEffect(() => {
    if (!map || mode !== 'sapo' || !isDrawingLine) return;

    const onDrawCreate = (e) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        if (feature.geometry.type === 'LineString') {
          console.log('SAPO: Line created via draw event');
          handleLineComplete(feature);
        }
      }
    };

    map.on('draw.create', onDrawCreate);

    return () => {
      map.off('draw.create', onDrawCreate);
    };
  }, [map, mode, isDrawingLine, handleLineComplete]);

  // Clean up when mode changes away from SAPO
  useEffect(() => {
    if (mode !== 'sapo') {
      clearSapoMode();
    }
  }, [mode, clearSapoMode]);

  return {
    sapoLine,
    streetBounds,
    isDrawingLine,
    sapoZone,
    startDrawingLine,
    clearSapoMode
  };
};
