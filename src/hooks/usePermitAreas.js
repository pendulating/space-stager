// hooks/usePermitAreas.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { loadPermitAreas as loadPermitAreasService, searchPermitAreas, highlightOverlappingAreas, clearOverlapHighlights } from '../services/permitAreaService';

export const usePermitAreas = (map, mapLoaded) => {
  const [permitAreas, setPermitAreas] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [focusedArea, setFocusedArea] = useState(null);
  const [showFocusInfo, setShowFocusInfo] = useState(false);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: null });
  const [overlappingAreas, setOverlappingAreas] = useState([]);
  const [selectedOverlapIndex, setSelectedOverlapIndex] = useState(0);
  const [showOverlapSelector, setShowOverlapSelector] = useState(false);
  const [clickPosition, setClickPosition] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [mode, setMode] = useState('parks'); // 'parks' or 'sapo'

  // Calculate area of a geometry to determine layering order
  const calculateGeometryArea = useCallback((geometry) => {
    if (!geometry || !geometry.coordinates) return 0;
    
    let totalArea = 0;
    
    if (geometry.type === 'Polygon') {
      totalArea = calculatePolygonArea(geometry.coordinates[0]);
    } else if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach(polygon => {
        totalArea += calculatePolygonArea(polygon[0]);
      });
    }
    
    return Math.abs(totalArea);
  }, []);

  // Calculate polygon area using shoelace formula
  const calculatePolygonArea = (coordinates) => {
    if (!coordinates || coordinates.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const [x1, y1] = coordinates[i];
      const [x2, y2] = coordinates[i + 1];
      area += (x1 * y2 - x2 * y1);
    }
    return area / 2;
  };

  // Calculate bounds for a geometry
  const calculateGeometryBounds = useCallback((geometry) => {
    if (!geometry || !geometry.coordinates) return null;
    
    let coordinates = [];
    
    if (geometry.type === 'Polygon') {
      coordinates = geometry.coordinates[0];
    } else if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach(polygon => {
        coordinates = coordinates.concat(polygon[0]);
      });
    } else {
      return null;
    }
    
    if (coordinates.length === 0) return null;
    
    let minX = coordinates[0][0];
    let minY = coordinates[0][1];
    let maxX = coordinates[0][0];
    let maxY = coordinates[0][1];
    
    coordinates.forEach(coord => {
      minX = Math.min(minX, coord[0]);
      minY = Math.min(minY, coord[1]);
      maxX = Math.max(maxX, coord[0]);
      maxY = Math.max(maxY, coord[1]);
    });
    
    return [[minX, minY], [maxX, maxY]];
  }, []);

  // Function to focus on a specific permit area
  const focusOnPermitArea = useCallback((permitArea) => {
    if (!map || !permitArea) return;
    
    console.log('Focusing on permit area:', permitArea.properties);
    
    setFocusedArea(permitArea);
    setShowFocusInfo(true);
    
    const areaId = permitArea.id || permitArea.properties.id || permitArea.properties.OBJECTID;
    
    if (areaId) {
      if (map.getLayer('permit-areas-focused-fill')) {
        map.setFilter('permit-areas-focused-fill', ['==', 'id', areaId]);
        map.setFilter('permit-areas-focused-outline', ['==', 'id', areaId]);
      }
    }
    
    const bounds = calculateGeometryBounds(permitArea.geometry);
    if (bounds) {
      const padding = 50;
      
      try {
        map.fitBounds(bounds, {
          padding: padding,
          maxZoom: 18,
          duration: 1000
        });
      } catch (error) {
        console.error('Error fitting bounds:', error);
        if (permitArea.geometry && permitArea.geometry.type === 'Point') {
          map.flyTo({
            center: permitArea.geometry.coordinates,
            zoom: 16,
            duration: 1000
          });
        }
      }
    }
    
    console.log('Permit area focused successfully');
  }, [map, calculateGeometryBounds]);

  // Build tooltip content based on available properties
  const buildTooltipContent = useCallback((properties) => {
    if (!properties) return null;
    
    const fields = [];
    
    if (properties.propertyname) {
      fields.push({ label: 'Property', value: properties.propertyname });
    }
    
    if (properties.subpropertyname) {
      fields.push({ label: 'Sub-Property', value: properties.subpropertyname });
    }
    
    if (properties.name) {
      fields.push({ label: 'Name', value: properties.name });
    }
    
    return fields.length > 0 ? fields : null;
  }, []);

  // Setup tooltip event listeners for permit areas
  const setupTooltipListeners = useCallback(() => {
    if (!map) return;
    
    console.log('Setting up permit area tooltip listeners');
    
    map.on('mouseenter', 'permit-areas-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', 'permit-areas-fill', () => {
      map.getCanvas().style.cursor = '';
      setTooltip(prev => ({ ...prev, visible: false }));
    });
    
    map.on('mousemove', 'permit-areas-fill', (e) => {
      if (e.features.length === 0) return;
      
      const feature = e.features[0].properties;
      const tooltipContent = buildTooltipContent(feature);
      
      if (tooltipContent) {
        setTooltip({
          visible: true,
          x: e.point.x,
          y: e.point.y,
          content: tooltipContent
        });
      }
    });
  }, [map, buildTooltipContent]);

  // Enhanced permit area click handling with overlap detection
  const setupPermitAreaClickListeners = useCallback(() => {
    if (!map) return;
    
    console.log('Setting up permit area click listeners');
    
    map.on('click', 'permit-areas-fill', (e) => {
      if (e.features.length === 0) return;
      
      e.preventDefault();
      
      const point = [e.point.x, e.point.y];
      const allFeatures = map.queryRenderedFeatures(point, {
        layers: ['permit-areas-fill']
      });
      
      console.log(`Found ${allFeatures.length} overlapping features at click point`);
      
      if (allFeatures.length > 1) {
        const sortedFeatures = allFeatures
          .map(feature => ({
            ...feature,
            calculatedArea: calculateGeometryArea(feature.geometry)
          }))
          .sort((a, b) => a.calculatedArea - b.calculatedArea);
        
        console.log('Multiple areas detected, showing selector with smallest areas first');
        setOverlappingAreas(sortedFeatures);
        setSelectedOverlapIndex(0);
        setShowOverlapSelector(true);
        setClickPosition({ x: e.point.x, y: e.point.y });
        
        highlightOverlappingAreas(map, sortedFeatures);
      } else {
        console.log('Single area detected, focusing directly');
        focusOnPermitArea(allFeatures[0]);
        setShowOverlapSelector(false);
      }
    });
    
    map.on('dblclick', 'permit-areas-fill', (e) => {
      if (e.features.length === 0) return;
      
      e.preventDefault();
      console.log('Double-click detected, focusing on top feature');
      const feature = e.features[0];
      focusOnPermitArea(feature);
      setShowOverlapSelector(false);
      clearOverlapHighlights(map);
    });
    
    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['permit-areas-fill']
      });
      
      if (features.length === 0) {
        console.log('Clicked outside permit areas, hiding selector');
        setShowOverlapSelector(false);
        clearOverlapHighlights(map);
      }
    });
  }, [map, calculateGeometryArea, focusOnPermitArea]);

  // Function to load permit areas using the service
  const loadPermitAreas = useCallback(async () => {
    if (!map) {
      console.log('PermitAreas: No map instance available for loading');
      return;
    }
    
    // Check if already loaded to prevent duplicate loading
    if (map.getSource('permit-areas')) {
      console.log('PermitAreas: Already loaded, skipping');
      return;
    }
    
    console.log('PermitAreas: Starting to load permit areas using service');
    setIsLoading(true);
    setLoadError(null);
    
    const maxRetries = 3;
    let retryCount = 0;
    
    const attemptLoad = async () => {
      try {
        // Add a small delay to ensure map is fully ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Double-check map is still available and ready
        if (!map || !map.getStyle() || !map.loaded()) {
          throw new Error('Map not ready for layer loading');
        }
        
        const features = await loadPermitAreasService(map);
        
        // Verify layers were actually added and are visible
        const requiredLayers = ['permit-areas-fill', 'permit-areas-outline'];
        for (const layerId of requiredLayers) {
          if (!map.getLayer(layerId)) {
            throw new Error(`Layer not found after service call: ${layerId}`);
          }
          
          const visibility = map.getLayoutProperty(layerId, 'visibility');
          if (visibility !== 'visible') {
            console.log(`PermitAreas: Layer ${layerId} not visible, fixing...`);
            map.setLayoutProperty(layerId, 'visibility', 'visible');
          }
        }
        
        // Set up periodic visibility checks
        const visibilityChecker = setInterval(() => {
          if (!map || !map.getLayer) return;
          
          let needsRepaint = false;
          for (const layerId of requiredLayers) {
            if (map.getLayer(layerId)) {
              const visibility = map.getLayoutProperty(layerId, 'visibility');
              if (visibility !== 'visible') {
                console.log(`PermitAreas: Restoring visibility for ${layerId}`);
                map.setLayoutProperty(layerId, 'visibility', 'visible');
                needsRepaint = true;
              }
            }
          }
          
          if (needsRepaint) {
            map.triggerRepaint();
          }
        }, 1000);
        
        // Clear the checker after 10 seconds
        setTimeout(() => clearInterval(visibilityChecker), 10000);
        
        // Additional verification: check if we can query features
        setTimeout(() => {
          try {
            const testFeatures = map.querySourceFeatures('permit-areas', {
              sourceLayer: null
            });
            console.log(`PermitAreas: Verification - found ${testFeatures.length} features in source`);
            
            if (testFeatures.length === 0) {
              console.warn('PermitAreas: No features found in source after loading');
            }
            
            // Try to query rendered features at the center of the map
            const center = map.getCenter();
            const point = map.project(center);
            const renderedFeatures = map.queryRenderedFeatures(point, {
              layers: ['permit-areas-fill']
            });
            console.log(`PermitAreas: Found ${renderedFeatures.length} rendered features at map center`);
            
          } catch (e) {
            console.warn('PermitAreas: Could not verify features:', e.message);
          }
        }, 200);
        
        setPermitAreas(features);
        console.log(`PermitAreas: Loaded ${features.length} permit areas using service`);
        
        // Set up event listeners after successful load
        setupTooltipListeners();
        setupPermitAreaClickListeners();
        
        setIsLoading(false);
        console.log('PermitAreas: Loading completed successfully');
        
      } catch (error) {
        retryCount++;
        console.warn(`PermitAreas: Load attempt ${retryCount} failed:`, error.message);
        
        if (retryCount < maxRetries) {
          console.log(`PermitAreas: Retrying in ${retryCount * 500}ms...`);
          setTimeout(() => attemptLoad(), retryCount * 500);
        } else {
          console.error('PermitAreas: All retry attempts failed:', error);
          setLoadError(error.message);
          setIsLoading(false);
        }
      }
    };
    
    await attemptLoad();
  }, [map, setupTooltipListeners, setupPermitAreaClickListeners]);

  // Clear focus function
  const clearFocus = useCallback(() => {
    console.log('Clearing focus');
    
    setFocusedArea(null);
    setShowFocusInfo(false);
    setShowOverlapSelector(false);
    clearOverlapHighlights(map);
    
    if (map && map.getLayer('permit-areas-focused-fill')) {
      map.setFilter('permit-areas-focused-fill', ['==', 'id', '']);
      map.setFilter('permit-areas-focused-outline', ['==', 'id', '']);
    }
  }, [map]);

  // Search functionality using the service
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    const timer = setTimeout(() => {
      const results = searchPermitAreas(permitAreas, searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    }, 250);
    
    return () => clearTimeout(timer);
  }, [searchQuery, permitAreas]);

  // Load permit areas when map is ready with additional safety checks
  useEffect(() => {
    console.log('PermitAreas: Map state changed', { 
      hasMap: !!map, 
      mapLoaded,
      mapLoadedInternal: map?.loaded?.(),
      hasStyle: !!map?.getStyle?.()
    });
    
    if (map && mapLoaded && map.getStyle()) {
      console.log('PermitAreas: Map is ready, loading permit areas');
      // Add a small delay to ensure everything is settled
      const timer = setTimeout(() => {
        loadPermitAreas();
      }, 200); // Reverted back to 200ms
      
      return () => clearTimeout(timer);
    }
  }, [map, mapLoaded, loadPermitAreas]);

  // Function to select from overlapping areas
  const selectOverlappingArea = useCallback((index) => {
    if (overlappingAreas[index]) {
      console.log('Selecting overlapping area at index:', index);
      setSelectedOverlapIndex(index);
      focusOnPermitArea(overlappingAreas[index]);
      setShowOverlapSelector(false);
      clearOverlapHighlights(map);
    }
  }, [overlappingAreas, focusOnPermitArea, map]);

  // Function to clear overlap selector
  const clearOverlapSelector = useCallback(() => {
    console.log('Clearing overlap selector');
    setShowOverlapSelector(false);
    setOverlappingAreas([]);
    setSelectedOverlapIndex(0);
    clearOverlapHighlights(map);
  }, [map]);

  // Function to toggle between modes
  const toggleMode = useCallback(() => {
    const newMode = mode === 'parks' ? 'sapo' : 'parks';
    setMode(newMode);
    
    // Clear any existing focus when switching modes
    if (newMode === 'sapo') {
      clearFocus();
      
      // Hide permit area layers when switching to SAPO mode
      if (map && map.getLayer && map.getStyle()) {
        const permitLayers = ['permit-areas-fill', 'permit-areas-outline', 'permit-areas-focused-fill', 'permit-areas-focused-outline'];
        permitLayers.forEach(layerId => {
          try {
            if (map.getLayer(layerId)) {
              map.setLayoutProperty(layerId, 'visibility', 'none');
            }
          } catch (error) {
            console.warn(`Error hiding layer ${layerId}:`, error);
          }
        });
      }
    } else {
      // Show permit area layers when switching back to parks mode
      if (map && map.getLayer && map.getStyle()) {
        const permitLayers = ['permit-areas-fill', 'permit-areas-outline'];
        permitLayers.forEach(layerId => {
          try {
            if (map.getLayer(layerId)) {
              map.setLayoutProperty(layerId, 'visibility', 'visible');
            }
          } catch (error) {
            console.warn(`Error showing layer ${layerId}:`, error);
          }
        });
      }
    }
    
    console.log('Mode switched to:', newMode);
  }, [mode, clearFocus, map]);

  return {
    permitAreas,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    focusedArea,
    showFocusInfo,
    setShowFocusInfo,
    tooltip,
    overlappingAreas,
    selectedOverlapIndex,
    showOverlapSelector,
    clickPosition,
    isLoading,
    loadError,
    mode,
    toggleMode,
    focusOnPermitArea,
    clearFocus,
    selectOverlappingArea,
    clearOverlapSelector
  };
};