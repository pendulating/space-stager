// hooks/usePermitAreas.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { loadPermitAreas as loadPermitAreasService, searchPermitAreas, highlightOverlappingAreas, clearOverlapHighlights } from '../services/permitAreaService';
import bbox from '@turf/bbox';

// Minimal oriented minimum bounding box (rotating calipers) implementation
function getOrientedMinBBox(coords) {
  // Flatten all coordinates
  const points = coords.flat();
  // Convex hull (Graham scan)
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of points) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  // Rotating calipers for min area rectangle
  let minArea = Infinity, bestRect = null, bestAngle = 0;
  for (let i = 0; i < hull.length; i++) {
    const p1 = hull[i], p2 = hull[(i + 1) % hull.length];
    const edgeAngle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    const cos = Math.cos(-edgeAngle), sin = Math.sin(-edgeAngle);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of hull) {
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      minX = Math.min(minX, rx);
      minY = Math.min(minY, ry);
      maxX = Math.max(maxX, rx);
      maxY = Math.max(maxY, ry);
    }
    const area = (maxX - minX) * (maxY - minY);
    if (area < minArea) {
      minArea = area;
      bestAngle = edgeAngle * 180 / Math.PI;
      // Rectangle corners in rotated space
      bestRect = [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
        [minX, minY]
      ].map(([x, y]) => [
        x * Math.cos(edgeAngle) - y * Math.sin(edgeAngle),
        x * Math.sin(edgeAngle) + y * Math.cos(edgeAngle)
      ]);
    }
  }
  return { rect: bestRect, angle: bestAngle };
}

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
  const focusedAreaRef = useRef(focusedArea);

  useEffect(() => {
    focusedAreaRef.current = focusedArea;
  }, [focusedArea]);

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
    // Prevent re-focusing if already focused (use ref for latest value)
    if (
      focusedAreaRef.current &&
      focusedAreaRef.current.properties &&
      permitArea.properties &&
      focusedAreaRef.current.properties.system === permitArea.properties.system
    ) {
      return;
    }
    // Defensive: ensure map is loaded and style is ready
    if (!map.isStyleLoaded || (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded())) {
      console.warn('Map style not loaded, delaying focus/zoom');
      setTimeout(() => focusOnPermitArea(permitArea), 100);
      return;
    }
    console.log('Focusing on permit area:', permitArea.properties);
    setFocusedArea(permitArea);
    setShowFocusInfo(true);
    // Use the 'system' property as the unique identifier
    const areaSystem = permitArea.properties.system;
    console.log('Focusing on permit area with system:', areaSystem);
    if (areaSystem) {
      if (map.getLayer('permit-areas-focused-fill')) {
        map.setFilter('permit-areas-focused-fill', ['==', ['get', 'system'], areaSystem]);
        map.setFilter('permit-areas-focused-outline', ['==', ['get', 'system'], areaSystem]);
      }
    }
    // Fit map to oriented minimum bounding box of the focused area
    try {
      const geom = permitArea.geometry;
      if (!geom) throw new Error('No geometry');
      let coords = [];
      if (geom.type === 'Polygon') {
        coords = geom.coordinates;
      } else if (geom.type === 'MultiPolygon') {
        coords = geom.coordinates.flat();
      }
      if (coords.length < 1) throw new Error('No coordinates');
      const { rect, angle } = getOrientedMinBBox(coords);
      // Compute bbox of the rectangle
      const xs = rect.map(([x, y]) => x);
      const ys = rect.map(([x, y]) => y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const orientedBbox = [[minX, minY], [maxX, maxY]];
      
      // Calculate the optimal zoom level to fill the viewport
      const mapCanvas = map.getCanvas();
      const viewportWidth = mapCanvas.width;
      const viewportHeight = mapCanvas.height;
      
      // Calculate the bounding box dimensions in degrees
      const bboxWidth = maxX - minX;
      const bboxHeight = maxY - minY;
      
      // Calculate the center point
      const centerLng = (minX + maxX) / 2;
      const centerLat = (minY + maxY) / 2;
      
      // Calculate zoom levels for both width and height
      // Use a more direct approach: calculate zoom needed to fit bbox in viewport
      const padding = 40; // pixels of padding
      const effectiveWidth = viewportWidth - (padding * 2);
      const effectiveHeight = viewportHeight - (padding * 2);
      
      // Convert degrees to pixels at different zoom levels to find the right one
      let optimalZoom = 14; // start with a reasonable zoom
      
      for (let zoom = 14; zoom <= 22; zoom++) {
        const pixelsPerDegree = Math.pow(2, zoom) * 256 / 360;
        const bboxWidthPixels = bboxWidth * pixelsPerDegree;
        const bboxHeightPixels = bboxHeight * pixelsPerDegree;
        
        // If the bbox fits in the viewport at this zoom, use it
        if (bboxWidthPixels <= effectiveWidth && bboxHeightPixels <= effectiveHeight) {
          optimalZoom = zoom;
        } else {
          // If it doesn't fit, use the previous zoom level
          optimalZoom = Math.max(14, zoom - 1);
          break;
        }
      }
      
      console.log('Calculated optimal zoom:', {
        bboxWidth,
        bboxHeight,
        viewportWidth,
        viewportHeight,
        effectiveWidth,
        effectiveHeight,
        optimalZoom
      });
      
      // Use fitBounds with the calculated zoom level
      map.fitBounds(orientedBbox, {
        padding: 20,
        maxZoom: optimalZoom,
        minZoom: optimalZoom,
        duration: 1000,
        bearing: -angle
      });
      
      setTimeout(() => {
        if (map.getBearing && map.getBearing() !== -angle) {
          map.rotateTo(-angle, { duration: 500 });
        }
      }, 1100);
    } catch (error) {
      console.error('Error fitting oriented bounds:', error);
      // Fallback: fit to regular bounds with dynamic zoom calculation
      const bounds = calculateGeometryBounds(permitArea.geometry);
      if (bounds) {
        const mapCanvas = map.getCanvas();
        const viewportWidth = mapCanvas.width;
        const viewportHeight = mapCanvas.height;
        
        const bboxWidth = bounds[1][0] - bounds[0][0];
        const bboxHeight = bounds[1][1] - bounds[0][1];
        
        // Use the Web Mercator projection formula for zoom calculation
        const zoomForWidth = Math.log2(viewportWidth / (bboxWidth * 256));
        const zoomForHeight = Math.log2(viewportHeight / (bboxHeight * 256));
        const optimalZoom = Math.min(zoomForWidth, zoomForHeight);
        const clampedZoom = Math.max(14, Math.min(22, optimalZoom));
        
        map.fitBounds(bounds, { 
          padding: 20, 
          maxZoom: clampedZoom, 
          minZoom: clampedZoom, 
          duration: 1000 
        });
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

  // Helper function to check if drawing is active
  const isDrawingActive = useCallback(() => {
    if (!map) return false;
    const drawControl = map.getControl && map.getControl('MapboxDraw');
    return drawControl && drawControl.getMode && drawControl.getMode() !== 'simple_select';
  }, [map]);

  // Clear tooltip when drawing mode changes
  useEffect(() => {
    if (!map) return;
    
    const checkDrawingMode = () => {
      if (isDrawingActive()) {
        setTooltip(prev => ({ ...prev, visible: false }));
      }
    };

    // Check immediately
    checkDrawingMode();
    
    // Set up a listener for draw mode changes
    const handleDrawModeChange = () => {
      checkDrawingMode();
    };

    // Listen for draw events that indicate mode changes
    map.on('draw.modechange', handleDrawModeChange);
    map.on('draw.create', handleDrawModeChange);
    map.on('draw.update', handleDrawModeChange);
    map.on('draw.delete', handleDrawModeChange);
    map.on('draw.selectionchange', handleDrawModeChange);
    
    return () => {
      map.off('draw.modechange', handleDrawModeChange);
      map.off('draw.create', handleDrawModeChange);
      map.off('draw.update', handleDrawModeChange);
      map.off('draw.delete', handleDrawModeChange);
      map.off('draw.selectionchange', handleDrawModeChange);
    };
  }, [map, isDrawingActive]);

  // Setup tooltip event listeners for permit areas
  const setupTooltipListeners = useCallback(() => {
    if (!map) return;
    
    console.log('Setting up permit area tooltip listeners');
    
    map.on('mouseenter', 'permit-areas-fill', () => {
      // Check if draw tools are active - if so, don't show tooltip
      if (isDrawingActive()) {
        return; // Don't change cursor or show tooltip when drawing
      }
      
      map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', 'permit-areas-fill', () => {
      map.getCanvas().style.cursor = '';
      setTooltip(prev => ({ ...prev, visible: false }));
    });
    
    map.on('mousemove', 'permit-areas-fill', (e) => {
      if (e.features.length === 0) return;
      
      // Check if draw tools are active - if so, don't show tooltip
      if (isDrawingActive()) {
        setTooltip(prev => ({ ...prev, visible: false }));
        return; // Don't show tooltip when drawing
      }
      
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
  }, [map, buildTooltipContent, isDrawingActive]);

  // Enhanced permit area click handling with overlap detection
  const setupPermitAreaClickListeners = useCallback(() => {
    if (!map) return;
    
    console.log('Setting up permit area click listeners');
    
    map.on('click', 'permit-areas-fill', (e) => {
      if (e.features.length === 0) return;
      
      // Only prevent default if we're not in a drawing mode
      const drawControl = map.getControl && map.getControl('MapboxDraw');
      if (drawControl && drawControl.getMode && drawControl.getMode() !== 'simple_select') {
        return; // Let draw tools handle the click
      }
      
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
      
      // Only prevent default if we're not in a drawing mode
      const drawControl = map.getControl && map.getControl('MapboxDraw');
      if (drawControl && drawControl.getMode && drawControl.getMode() !== 'simple_select') {
        return; // Let draw tools handle the double-click
      }
      
      e.preventDefault();
      console.log('Double-click detected, focusing on top feature');
      const feature = e.features[0];
      focusOnPermitArea(feature);
      setShowOverlapSelector(false);
      clearOverlapHighlights(map);
    });
    
    map.on('click', (e) => {
      // Only handle general clicks if we're not in a drawing mode
      const drawControl = map.getControl && map.getControl('MapboxDraw');
      if (drawControl && drawControl.getMode && drawControl.getMode() !== 'simple_select') {
        return; // Let draw tools handle the click
      }
      
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
      console.log('PermitAreas: No map instance available for loading', { map });
      return;
    }
    console.log('PermitAreas: loadPermitAreas called', { mapLoaded, mapExists: !!map });
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

    const requiredLayers = ['permit-areas-fill', 'permit-areas-outline'];

    const attemptLoad = async () => {
      try {
        // Add a small delay to ensure map is fully ready
        await new Promise(resolve => setTimeout(resolve, 100));
        // Double-check map is still available and ready
        if (!map || !map.getStyle() || !map.loaded()) {
          throw new Error('Map not ready for layer loading');
        }
        console.log('PermitAreas: Calling loadPermitAreasService', { mapLoaded, mapExists: !!map });
        const features = await loadPermitAreasService(map);
        // Verify layers were actually added and are visible
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
        // Defensive polling: after 2s, check if layers are present, retry if not (up to 2 more times)
        let pollTries = 0;
        const pollForLayers = () => {
          pollTries++;
          let allPresent = requiredLayers.every(layerId => map.getLayer(layerId));
          console.log(`PermitAreas: Polling for layers (try ${pollTries}):`, requiredLayers.map(id => ({ id, present: !!map.getLayer(id) })));
          if (!allPresent && pollTries < 3) {
            setTimeout(() => {
              if (!requiredLayers.every(layerId => map.getLayer(layerId))) {
                console.warn('PermitAreas: Defensive reload triggered');
                attemptLoad();
              }
            }, 2000);
          }
        };
        setTimeout(pollForLayers, 2000);
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
  }, [map, mapLoaded, setupTooltipListeners, setupPermitAreaClickListeners]);

  // Clear focus function
  const clearFocus = useCallback(() => {
    console.log('Clearing focus');
    
    setFocusedArea(null);
    setShowFocusInfo(false);
    setShowOverlapSelector(false);
    clearOverlapHighlights(map);
    
    if (map && map.getLayer('permit-areas-focused-fill')) {
      map.setFilter('permit-areas-focused-fill', ['==', ['get', 'system'], '']);
      map.setFilter('permit-areas-focused-outline', ['==', ['get', 'system'], '']);
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

  // Function to select from overlapping areas
  const selectOverlappingArea = useCallback((index) => {
    const selected = overlappingAreas[index];
    if (selected) {
      console.log('Selecting overlapping area at index:', index);
      setSelectedOverlapIndex(index);
      // Always use the canonical area from permitAreas (by system property)
      let canonical = null;
      if (selected.properties && selected.properties.system) {
        canonical = permitAreas.find(
          a => a.properties && a.properties.system === selected.properties.system
        );
      }
      if (!canonical) {
        console.warn('Canonical area not found for system:', selected.properties?.system, 'Falling back to selected feature.');
        canonical = selected;
      }
      focusOnPermitArea(canonical);
      setShowOverlapSelector(false);
      clearOverlapHighlights(map);
    }
  }, [overlappingAreas, permitAreas, focusOnPermitArea, map]);

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
    clearOverlapSelector,
    loadPermitAreas
  };
};