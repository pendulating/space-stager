// hooks/usePermitAreas.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { searchPermitAreas, highlightOverlappingAreas, clearOverlapHighlights } from '../services/permitAreaService';
import { loadPolygonAreas, loadPointAreas } from '../services/geographyService';
import { ensureBaseLayers as ensureGeoBaseLayers, setBaseVisibility as setGeoBaseVisibility, unload as unloadGeo } from '../services/geographyLayerManager';
import { GEOGRAPHIES } from '../constants/geographies';
import { useZoneCreatorContext } from '../contexts/ZoneCreatorContext.jsx';
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

export const usePermitAreas = (map, mapLoaded, options = {}) => {
  const [permitAreas, setPermitAreas] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [focusedArea, setFocusedArea] = useState(null);
  const [showFocusInfo, setShowFocusInfo] = useState(false);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: null });
  // Persistent click popover for parks mode (single at a time)
  const [clickedTooltip, setClickedTooltip] = useState({ visible: false, x: 0, y: 0, lngLat: null, content: null, featureId: null });
  const [overlappingAreas, setOverlappingAreas] = useState([]);
  const [selectedOverlapIndex, setSelectedOverlapIndex] = useState(0);
  const [showOverlapSelector, setShowOverlapSelector] = useState(false);
  const [clickPosition, setClickPosition] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [mode, setMode] = useState(options.mode || 'parks');
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef(null);
  const cachedDataRef = useRef({}); // keyed by idPrefix -> GeoJSON
  const [initialFocusZoom, setInitialFocusZoom] = useState(null); // Track initial zoom when focused
  const [minAllowedZoom, setMinAllowedZoom] = useState(null); // Minimum zoom when focused
  const [isCameraAnimating, setIsCameraAnimating] = useState(false); // Track camera animation state
  const focusedAreaRef = useRef(focusedArea);
  const prevPermitVisibilityRef = useRef({ fill: null, outline: null });
  // Store and restore map interaction/constraints when entering/exiting focus
  const prevConstraintsRef = useRef({
    minZoom: null,
    maxBounds: null,
    rotation: { dragRotate: null, touchRotate: null }
  });
  const listenerRefs = useRef({
    mouseenterFill: null,
    mouseleaveFill: null,
    mousemoveFill: null,
    clickPermitFill: null,
    dblclickPermitFill: null,
    clickGeneral: null
  });
  // Track the currently hovered intersection feature id so we can smoothly revert the previous one
  const hoveredIntersectionIdRef = useRef(null);
  // Track currently hovered polygon id (parks/plazas)
  const hoveredPolygonIdRef = useRef(null);
  // Mirror clicked popover visibility in a ref to avoid effect dependency churn
  const clickedTooltipVisibleRef = useRef(false);
  useEffect(() => {
    clickedTooltipVisibleRef.current = !!(clickedTooltip && clickedTooltip.visible);
  }, [clickedTooltip.visible]);
  // Zone Creator state for gating interactions in intersections mode
  const zoneCreator = useZoneCreatorContext();
  // Cached events-by-CEMSID lookup for parks usage stats
  const eventsByCemsidRef = useRef(null);
  const eventsFetchInFlightRef = useRef(false);
  const eventsDistributionsRef = useRef({ avg: [], total: [] });

  useEffect(() => {
    focusedAreaRef.current = focusedArea;
  }, [focusedArea]);

  // Respond to external mode changes
  useEffect(() => {
    if (!options || !options.mode) return;
    if (options.mode === mode) return;
    // Clear focus and unload previous layers when switching modes
    clearFocus();
    // Remove any hover overlay for previous mode
    try {
      const prevIdPrefix = mode === 'parks' ? 'permit-areas' : (mode === 'plazas' ? 'plaza-areas' : 'intersections');
      const hoverOutlineId = `${prevIdPrefix}-hover-outline`;
      if (map && map.getLayer && map.getLayer(hoverOutlineId)) map.removeLayer(hoverOutlineId);
    } catch (_) {}
    // Dismiss any open click popover when mode changes
    setClickedTooltip({ visible: false, x: 0, y: 0, lngLat: null, content: null, featureId: null });
    try {
      // Abort any in-flight fetches
      if (abortControllerRef.current) { try { abortControllerRef.current.abort(); } catch (_) {} }
      // Unload previous geography layers using manager
      unloadGeo(map, mode === 'parks' ? 'permit-areas' : (mode === 'plazas' ? 'plaza-areas' : 'intersections'));
    } catch (_) {}
    setPermitAreas([]);
    setMode(options.mode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.mode]);

  // Preload CEMSID events stats when in parks mode (idempotent)
  useEffect(() => {
    const activeMode = options.mode || mode;
    if (activeMode !== 'parks') return;
    if (eventsByCemsidRef.current || eventsFetchInFlightRef.current) return;
    eventsFetchInFlightRef.current = true;
    try {
      fetch('/data/events_by_cemsid.json', { cache: 'force-cache' })
        .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
        .then(json => {
          eventsByCemsidRef.current = json || {};
          try {
            const entries = Object.values(json || {});
            const avgs = entries.map(e => Number(e?.a)).filter(n => isFinite(n));
            const totals = entries.map(e => Number(e?.t)).filter(n => isFinite(n));
            eventsDistributionsRef.current = { avg: avgs, total: totals };
          } catch (_) { eventsDistributionsRef.current = { avg: [], total: [] }; }
        })
        .catch(() => {})
        .finally(() => { eventsFetchInFlightRef.current = false; });
    } catch (_) { eventsFetchInFlightRef.current = false; }
  }, [mode, options.mode]);

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

  // Helper to apply temporary camera/interaction constraints after focus settles
  const applyFocusConstraints = useCallback((rawBounds, finalZoom) => {
    if (!map || !rawBounds) return;
    try {
      // Save previous state once
      if (prevConstraintsRef.current.minZoom === null) {
        try { prevConstraintsRef.current.minZoom = typeof map.getMinZoom === 'function' ? map.getMinZoom() : 0; } catch (_) {}
        try { prevConstraintsRef.current.maxBounds = typeof map.getMaxBounds === 'function' ? map.getMaxBounds() : null; } catch (_) {}
      }
      // Compute padded bounds (25% padding)
      const sw = rawBounds[0];
      const ne = rawBounds[1];
      const padLng = (ne[0] - sw[0]) * 0.25;
      const padLat = (ne[1] - sw[1]) * 0.25;
      const padded = [[sw[0] - padLng, sw[1] - padLat], [ne[0] + padLng, ne[1] + padLat]];
      try { if (map.setMaxBounds) map.setMaxBounds(padded); } catch (_) {}
      // Set a floor slightly below the focused zoom to prevent zooming too far out
      const minZoomFloor = Math.max(1, (typeof finalZoom === 'number' ? finalZoom : map.getZoom ? map.getZoom() : 16) - 2);
      try { if (map.setMinZoom) map.setMinZoom(minZoomFloor); } catch (_) {}
      // Disable rotation interactions in focus to reduce accidental orientation changes
      try { if (map.dragRotate && map.dragRotate.disable) map.dragRotate.disable(); } catch (_) {}
      try {
        if (map.touchZoomRotate && map.touchZoomRotate.disableRotation) {
          map.touchZoomRotate.disableRotation();
        }
      } catch (_) {}
    } catch (_) {}
  }, [map]);

  // Function to focus on a specific permit area
  const focusOnPermitArea = useCallback((permitArea) => {
    if (!map || !permitArea) return;
    // Any time we enter focus mode, dismiss the clicked popover
    try { setClickedTooltip({ visible: false, x: 0, y: 0, lngLat: null, content: null, featureId: null }); } catch (_) {}
    // Prevent re-focusing if already focused (use ref for latest value)
    try {
      const activeMode = options.mode || mode;
      const cfg = GEOGRAPHIES[activeMode];
      const ff = cfg?.focusFilter || { type: 'id' };
      const prev = focusedAreaRef.current;
      const same = (() => {
        if (!prev || !prev.properties || !permitArea.properties) return false;
        if (ff.type === 'property') {
          const key = ff.key;
          return (prev.properties?.[key] || '') === (permitArea.properties?.[key] || '');
        }
        return (prev.id || '') === (permitArea.id || '');
      })();
      if (same) return;
    } catch (_) {}
    // Defensive: ensure map is loaded and style is ready
    if (!map.isStyleLoaded || (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded())) {
      console.warn('Map style not loaded, delaying focus/zoom');
      setTimeout(() => focusOnPermitArea(permitArea), 100);
      return;
    }
    console.log('Focusing on area:', permitArea.properties);
    setFocusedArea(permitArea);
    setShowFocusInfo(true);
    // Focus filtering and base layer visibility handling by mode
    const activeMode = options.mode || mode;
    const cfg = GEOGRAPHIES[activeMode];
    const idPrefix = cfg.idPrefix;
    const isPoint = permitArea?.geometry?.type === 'Point';
    try {
      // Ensure base layers exist to avoid races when clicking before load finishes
      try { ensureGeoBaseLayers(map, idPrefix, cfg.type); } catch (_) {}
      if (isPoint) {
        if (map.getLayer(`${idPrefix}-focused-points`)) {
          map.setFilter(`${idPrefix}-focused-points`, ['==', ['id'], permitArea.id || '']);
        }
        if (map.getLayer(`${idPrefix}-points`)) {
          prevPermitVisibilityRef.current.fill = map.getLayoutProperty(`${idPrefix}-points`, 'visibility') || 'visible';
          map.setLayoutProperty(`${idPrefix}-points`, 'visibility', 'none');
        }
      } else {
        if (map.getLayer(`${idPrefix}-focused-fill`)) {
          const ff = cfg.focusFilter || { type: 'id' };
          if (ff.type === 'property') {
            const val = permitArea.properties?.[ff.key] || '';
            map.setFilter(`${idPrefix}-focused-fill`, ['==', ['get', ff.key], val]);
            if (map.getLayer(`${idPrefix}-focused-outline`)) map.setFilter(`${idPrefix}-focused-outline`, ['==', ['get', ff.key], val]);
          } else {
            const featureId = permitArea.id || '';
            map.setFilter(`${idPrefix}-focused-fill`, ['==', ['id'], featureId]);
            if (map.getLayer(`${idPrefix}-focused-outline`)) map.setFilter(`${idPrefix}-focused-outline`, ['==', ['id'], featureId]);
          }
        }
        // Hide base polygon layers
        try {
          if (map.getLayer(`${idPrefix}-fill`)) {
            prevPermitVisibilityRef.current.fill = map.getLayoutProperty(`${idPrefix}-fill`, 'visibility') || 'visible';
            map.setLayoutProperty(`${idPrefix}-fill`, 'visibility', 'none');
          }
          if (map.getLayer(`${idPrefix}-outline`)) {
            prevPermitVisibilityRef.current.outline = map.getLayoutProperty(`${idPrefix}-outline`, 'visibility') || 'visible';
            map.setLayoutProperty(`${idPrefix}-outline`, 'visibility', 'none');
          }
          if (map.getLayer(`${idPrefix}-focused-fill`)) map.setLayoutProperty(`${idPrefix}-focused-fill`, 'visibility', 'visible');
          if (map.getLayer(`${idPrefix}-focused-outline`)) map.setLayoutProperty(`${idPrefix}-focused-outline`, 'visibility', 'visible');
        } catch (_) {}
      }
    } catch (_) {}

    // Fit/zoom behavior
    try {
      const geom = permitArea.geometry;
      if (!geom) throw new Error('No geometry');
      if (geom.type === 'Point') {
        setIsCameraAnimating(true);
        // Smoothly move to the point at a sensible zoom
        const targetZoom = 18;
        try { if (typeof map.stop === 'function') map.stop(); } catch (_) {}
        map.easeTo({ center: geom.coordinates, zoom: targetZoom, duration: 1100, essential: true, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) });
        // Apply constraints when camera settles
        map.once('idle', () => {
          try {
            const finalZoom = map.getZoom ? map.getZoom() : targetZoom;
            setInitialFocusZoom(finalZoom);
            setMinAllowedZoom(Math.max(1, finalZoom - 2));
            // Build a synthetic bounds around point based on pixels to ensure useful panning clamp
            const ptPx = map.project({ lng: geom.coordinates[0], lat: geom.coordinates[1] });
            const padPx = 200;
            const sw = map.unproject([ptPx.x - padPx, ptPx.y + padPx]).toArray();
            const ne = map.unproject([ptPx.x + padPx, ptPx.y - padPx]).toArray();
            applyFocusConstraints([sw, ne], finalZoom);
          } catch (_) {}
          setIsCameraAnimating(false);
        });
        return;
      }
      let coords = [];
      if (geom.type === 'Polygon') {
        coords = geom.coordinates;
      } else if (geom.type === 'MultiPolygon') {
        coords = geom.coordinates.flat();
      }
      if (coords.length < 1) throw new Error('No coordinates');
      const { rect, angle } = getOrientedMinBBox(coords);
      // Compute simple axis-aligned bbox for constraints and oriented bbox for view
      const xs = rect.map(([x, y]) => x);
      const ys = rect.map(([x, y]) => y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const orientedBbox = [[minX, minY], [maxX, maxY]];

      setIsCameraAnimating(true);
      // Prefer cameraForBounds if available to compute a single smooth camera
      try {
        const padding = options.focusPadding || 20;
        if (typeof map.cameraForBounds === 'function') {
          const camera = map.cameraForBounds(orientedBbox, { padding });
          const finalCamera = { ...camera, bearing: -angle, duration: 1200, essential: true, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) };
          try { if (typeof map.stop === 'function') map.stop(); } catch (_) {}
          map.easeTo(finalCamera);
        } else {
          try { if (typeof map.stop === 'function') map.stop(); } catch (_) {}
          map.fitBounds(orientedBbox, { padding, duration: 1200 });
          // Follow with a single rotate to target bearing if needed
          if (map.getBearing && map.getBearing() !== -angle) {
            map.rotateTo(-angle, { duration: 400 });
          }
        }
      } catch (_) {
        // Fallback to basic fitBounds
        try { if (typeof map.stop === 'function') map.stop(); } catch (_) {}
        map.fitBounds(orientedBbox, { padding: 20, duration: 1200 });
      }

      // When the camera settles, record zoom and apply constraints
      map.once('idle', () => {
        try {
          const finalZoom = map.getZoom ? map.getZoom() : 16;
          setInitialFocusZoom(finalZoom);
          setMinAllowedZoom(Math.max(1, finalZoom - 2));
          applyFocusConstraints([[minX, minY], [maxX, maxY]], finalZoom);
        } catch (_) {}
        setIsCameraAnimating(false);
      });
    } catch (error) {
      console.error('Error fitting oriented bounds:', error);
      // Fallback: fit to regular bounds with dynamic zoom calculation
      const bounds = calculateGeometryBounds(permitArea.geometry);
      if (bounds) {
        const padding = options.focusPadding || 20;
        try { if (typeof map.stop === 'function') map.stop(); } catch (_) {}
        map.fitBounds(bounds, { padding, duration: 1200 });
        map.once('idle', () => {
          try {
            const finalZoom = map.getZoom ? map.getZoom() : 16;
            setInitialFocusZoom(finalZoom);
            setMinAllowedZoom(Math.max(1, finalZoom - 2));
            applyFocusConstraints(bounds, finalZoom);
          } catch (_) {}
          setIsCameraAnimating(false);
        });
      }
    }
    console.log('Permit area focused successfully');
  }, [map, calculateGeometryBounds, mode]);



  // Build tooltip content based on available properties
  const buildTooltipContent = useCallback((properties, { includeStats = false } = {}) => {
    if (!properties) return null;
    
    const fields = [];
    const activeMode = options.mode || mode;
    
    // Prioritize FSN fields for plazas and intersections
    if (activeMode === 'plazas' || activeMode === 'intersections') {
      const fsnParts = [properties.FSN_1, properties.FSN_2, properties.FSN_3, properties.FSN_4]
        .filter((p) => !!p);
      if (fsnParts.length) {
        fields.push({ label: 'Streets', value: fsnParts.join(' & ') });
      }
    }
    
    // Parks or additional metadata if present
    if (properties.propertyname) {
      fields.push({ label: 'Property', value: properties.propertyname });
    }
    
    if (properties.subpropertyname) {
      fields.push({ label: 'Sub-Property', value: properties.subpropertyname });
    }
    
    if (properties.name) {
      fields.push({ label: 'Name', value: properties.name });
    }
    
    // Stats rows are not added to the text content; charts and numbers are rendered in the popover component
    
    return fields.length > 0 ? fields : null;
  }, [mode, options.mode]);

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
    
    const activeMode = options.mode || mode;
    console.log('Setting up area tooltip listeners for mode', activeMode);
    // Clean up old handlers if present
    if (listenerRefs.current.mouseenterFill) {
      try { map.off('mouseenter', 'permit-areas-fill', listenerRefs.current.mouseenterFill); } catch {}
      try { map.off('mouseenter', 'plaza-areas-fill', listenerRefs.current.mouseenterFill); } catch {}
      try { map.off('mouseenter', 'intersections-points', listenerRefs.current.mouseenterFill); } catch {}
    }
    if (listenerRefs.current.mouseleaveFill) {
      try { map.off('mouseleave', 'permit-areas-fill', listenerRefs.current.mouseleaveFill); } catch {}
      try { map.off('mouseleave', 'plaza-areas-fill', listenerRefs.current.mouseleaveFill); } catch {}
      try { map.off('mouseleave', 'intersections-points', listenerRefs.current.mouseleaveFill); } catch {}
    }
    if (listenerRefs.current.mousemoveFill) {
      try { map.off('mousemove', 'permit-areas-fill', listenerRefs.current.mousemoveFill); } catch {}
      try { map.off('mousemove', 'plaza-areas-fill', listenerRefs.current.mousemoveFill); } catch {}
      try { map.off('mousemove', 'intersections-points', listenerRefs.current.mousemoveFill); } catch {}
    }

    const idPrefix = activeMode === 'parks' ? 'permit-areas' : (activeMode === 'plazas' ? 'plaza-areas' : 'intersections');
    const hoverLayerId = activeMode === 'intersections' ? `${idPrefix}-points` : `${idPrefix}-fill`;

    const onMouseEnter = (e) => {
      // Check if draw tools are active - if so, don't show tooltip
      if (isDrawingActive()) {
        return; // Don't change cursor or show tooltip when drawing
      }
      
      // In intersections mode, block hover/selection prompting until Zone Creator is active
      // In intersections mode, Zone Creator is mandatory; still allow hover cursor
      if (activeMode === 'intersections' && (!zoneCreator)) {
        map.getCanvas().style.cursor = '';
        return;
      }
      map.getCanvas().style.cursor = 'pointer';
      if (activeMode === 'intersections' && e?.features?.length) {
        try {
          const id = e.features[0].id;
          if (id !== undefined && id !== null) {
            // Revert previous hovered point if different
            const prevId = hoveredIntersectionIdRef.current;
            if (prevId !== null && prevId !== undefined && prevId !== id) {
              animateHoverProgress(map, 'intersections', prevId, 0);
            }
            // Start smooth progress animation to 1 for current
            animateHoverProgress(map, 'intersections', id, 1);
            hoveredIntersectionIdRef.current = id;
          }
        } catch (_) {}
      }
    };
    const onMouseLeave = () => {
      map.getCanvas().style.cursor = '';
      setTooltip(prev => ({ ...prev, visible: false }));
      // Clear polygon hover outline when leaving polygon layer
      try {
        if (activeMode !== 'intersections') {
          const idPrefix = activeMode === 'parks' ? 'permit-areas' : (activeMode === 'plazas' ? 'plaza-areas' : '');
          if (idPrefix) {
            const hoverOutlineId = `${idPrefix}-hover-outline`;
            if (map.getLayer(hoverOutlineId)) map.setFilter(hoverOutlineId, ['==', ['id'], '']);
          }
          hoveredPolygonIdRef.current = null;
        }
      } catch (_) {}
      if (activeMode === 'intersections') {
        try {
          const prevId = hoveredIntersectionIdRef.current;
          if (prevId !== null && prevId !== undefined) {
            animateHoverProgress(map, 'intersections', prevId, 0);
          }
          hoveredIntersectionIdRef.current = null;
        } catch (_) {}
      }
    };
    const onMouseMove = (e) => {
      if (e.features.length === 0) return;
      
      // Check if draw tools are active - if so, don't show tooltip
      if (isDrawingActive()) {
        setTooltip(prev => ({ ...prev, visible: false }));
        return; // Don't show tooltip when drawing
      }
      // Suppress transient hover tooltip if a clicked popover is visible
      if (clickedTooltipVisibleRef.current) {
        setTooltip(prev => ({ ...prev, visible: false }));
        return;
      }
      if (activeMode === 'intersections') {
        // Prompt the user via tooltip to use Zone Creator first (always required in intersections mode)
        if (!zoneCreator) {
          setTooltip({ visible: true, x: e.point.x, y: e.point.y, content: [{ label: 'Tip', value: 'Use Zone Creator to select nodes' }] });
          return;
        }
        try {
          const id = e.features[0].id;
          if (id !== undefined && id !== null) {
            // Only animate the new feature in and the previous one out if changed
            const prevId = hoveredIntersectionIdRef.current;
            if (prevId !== null && prevId !== undefined && prevId !== id) {
              animateHoverProgress(map, 'intersections', prevId, 0);
            }
            animateHoverProgress(map, 'intersections', id, 1);
            hoveredIntersectionIdRef.current = id;
          }
        } catch (_) {}
      }
      
      const feature = e.features[0].properties;
      // Hover: do NOT include park stats
      const tooltipContent = buildTooltipContent(feature, { includeStats: false });
      
      if (tooltipContent) {
        setTooltip({
          visible: true,
          x: e.point.x,
          y: e.point.y,
          content: tooltipContent
        });
      }

      // Highlight smallest overlapping polygon under cursor (parks/plazas)
      if (activeMode !== 'intersections') {
        try {
          const idPrefix = activeMode === 'parks' ? 'permit-areas' : (activeMode === 'plazas' ? 'plaza-areas' : '');
          if (idPrefix) {
            const layerId = `${idPrefix}-fill`;
            const feats = map.queryRenderedFeatures([e.point.x, e.point.y], { layers: [layerId] }) || [];
            if (feats.length) {
              const smallest = feats
                .map(f => ({ f, area: calculateGeometryArea(f.geometry) }))
                .sort((a, b) => a.area - b.area)[0].f;
              const newId = smallest?.id || '';
              const hoverOutlineId = `${idPrefix}-hover-outline`;
              if (newId && map.getLayer(hoverOutlineId)) {
                if (hoveredPolygonIdRef.current !== newId) {
                  map.setFilter(hoverOutlineId, ['==', ['id'], newId]);
                  hoveredPolygonIdRef.current = newId;
                }
              }
            }
          }
        } catch (_) {}
      }
    };

    map.on('mouseenter', hoverLayerId, onMouseEnter);
    map.on('mouseleave', hoverLayerId, onMouseLeave);
    map.on('mousemove', hoverLayerId, onMouseMove);

    listenerRefs.current.mouseenterFill = onMouseEnter;
    listenerRefs.current.mouseleaveFill = onMouseLeave;
    listenerRefs.current.mousemoveFill = onMouseMove;
  }, [map, buildTooltipContent, isDrawingActive, mode, options.mode, zoneCreator?.isActive]);

  // Smoothly animate feature-state hoverProgress between 0 and 1
  const animateHoverProgress = useCallback((mapInstance, sourceId, featureId, toValue) => {
    try {
      const key = `${sourceId}:${featureId}`;
      if (!animateHoverProgress.anim) animateHoverProgress.anim = new Map();
      const existing = animateHoverProgress.anim.get(key);
      if (existing && existing.to === toValue) return; // already animating to same target
      if (existing && existing.raf) cancelAnimationFrame(existing.raf);

      const from = (existing && typeof existing.value === 'number') ? existing.value : 0;
      const start = performance.now();
      const duration = 220; // slightly longer for bounce

      function step(now) {
        const t = Math.min(1, (now - start) / duration);
        // easeOutBack for a bouncy feel
        const c1 = 1.70158;
        const c3 = c1 + 1;
        const eased = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        const val = from + (toValue - from) * eased;
        try { mapInstance.setFeatureState({ source: sourceId, id: featureId }, { hoverProgress: val }); } catch (_) {}
        animateHoverProgress.anim.set(key, { to: toValue, value: val, raf: null });
        if (t < 1) {
          const raf = requestAnimationFrame(step);
          animateHoverProgress.anim.set(key, { to: toValue, value: val, raf });
        } else {
          // snap to target to avoid drift
          try { mapInstance.setFeatureState({ source: sourceId, id: featureId }, { hoverProgress: toValue }); } catch (_) {}
          animateHoverProgress.anim.delete(key);
        }
      }

      const raf = requestAnimationFrame(step);
      animateHoverProgress.anim.set(key, { to: toValue, value: from, raf });
    } catch (_) {}
  }, []);

  // Enhanced permit area click handling with overlap detection
  const setupPermitAreaClickListeners = useCallback(() => {
    if (!map) return;
    
    const activeMode = options.mode || mode;
    console.log('Setting up area click listeners for mode', activeMode);
    // Remove previous handlers if they exist
    if (listenerRefs.current.clickPermitFill) {
      try { map.off('click', 'permit-areas-fill', listenerRefs.current.clickPermitFill); } catch {}
      try { map.off('click', 'plaza-areas-fill', listenerRefs.current.clickPermitFill); } catch {}
      try { map.off('click', 'intersections-points', listenerRefs.current.clickPermitFill); } catch {}
    }
    if (listenerRefs.current.dblclickPermitFill) {
      try { map.off('dblclick', 'permit-areas-fill', listenerRefs.current.dblclickPermitFill); } catch {}
      try { map.off('dblclick', 'plaza-areas-fill', listenerRefs.current.dblclickPermitFill); } catch {}
      try { map.off('dblclick', 'intersections-points', listenerRefs.current.dblclickPermitFill); } catch {}
    }
    if (listenerRefs.current.clickGeneral) {
      try { map.off('click', listenerRefs.current.clickGeneral); } catch {}
    }

    const hoverLayerId = activeMode === 'intersections' ? 'intersections-points' : (activeMode === 'plazas' ? 'plaza-areas-fill' : 'permit-areas-fill');

    const onClickPermitFill = (e) => {
      if (e.features.length === 0) return;
      
      // In intersections mode, disable default focus/click selection; Zone Creator handles interactions
      if (activeMode === 'intersections') {
        return;
      }
      
      // Only prevent default if we're not in a drawing mode
      const drawControl = map.getControl && map.getControl('MapboxDraw');
      if (drawControl && drawControl.getMode && drawControl.getMode() !== 'simple_select') {
        return; // Let draw tools handle the click
      }
      
      e.preventDefault();
      
      const point = [e.point.x, e.point.y];
      const allFeatures = map.queryRenderedFeatures(point, {
        layers: [hoverLayerId]
      });
      
      console.log(`Found ${allFeatures.length} overlapping features at click point`);
      
      if (allFeatures.length > 1) {
        const sortedFeatures = mode === 'intersections'
          ? allFeatures // points: keep order
          : allFeatures
            .map(feature => ({ ...feature, calculatedArea: calculateGeometryArea(feature.geometry) }))
            .sort((a, b) => a.calculatedArea - b.calculatedArea);
        
        console.log('Multiple areas detected, showing selector with smallest areas first');
        setOverlappingAreas(sortedFeatures);
        setSelectedOverlapIndex(0);
        setShowOverlapSelector(true);
        setClickPosition({ x: e.point.x, y: e.point.y });
        
      if (activeMode === 'parks') highlightOverlappingAreas(map, sortedFeatures);
      } else {
        const top = allFeatures[0];
        if (activeMode === 'parks') {
          // Show a persistent click popover anchored to click point
          try {
            const lngLat = e.lngLat || map.unproject([e.point.x, e.point.y]);
            const content = buildTooltipContent(top.properties, { includeStats: false });
            setClickedTooltip({
              visible: !!content,
              x: e.point.x,
              y: e.point.y,
              lngLat: lngLat ? { lng: lngLat.lng, lat: lngLat.lat } : null,
              content,
              featureId: (top.properties?.system ?? null),
              stats: (() => {
                const id = (top.properties?.CEMSID || top.properties?.cemsid || top.properties?.CEMS_ID || top.properties?.cems_id || '').toString();
                const dict = eventsByCemsidRef.current || {};
                return id && dict[id] ? dict[id] : null;
              })(),
              distributions: eventsDistributionsRef.current
            });
            // Hide transient hover tooltip when click popover opens
            setTooltip(prev => ({ ...prev, visible: false }));
          } catch (_) {}
          setShowOverlapSelector(false);
        } else {
          console.log('Single area detected, focusing directly');
          focusOnPermitArea(top);
          setShowOverlapSelector(false);
        }
      }
    };

      const onDblClickPermitFill = (e) => {
      if (e.features.length === 0) return;
      
        // In intersections mode, disable double-click focus behavior
        if (activeMode === 'intersections') return;
      
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
      if (activeMode === 'parks') clearOverlapHighlights(map);
      // Hide any open click popover upon entering focus
      setClickedTooltip({ visible: false, x: 0, y: 0, lngLat: null, content: null, featureId: null });
    };

    const onClickGeneral = (e) => {
      // Disable permit area selection if we're focused on an area (design mode)
      if (focusedAreaRef.current) {
        return;
      }
      
      // Only handle general clicks if we're not in a drawing mode
      const drawControl = map.getControl && map.getControl('MapboxDraw');
      if (drawControl && drawControl.getMode && drawControl.getMode() !== 'simple_select') {
        return; // Let draw tools handle the click
      }
      
      const features = map.queryRenderedFeatures(e.point, {
        layers: [hoverLayerId]
      });
      
      if (features.length === 0) {
        console.log('Clicked outside permit areas, hiding selector');
        setShowOverlapSelector(false);
        if (mode === 'parks') {
          clearOverlapHighlights(map);
          // Also hide any open click popover when clicking outside
          setClickedTooltip({ visible: false, x: 0, y: 0, lngLat: null, content: null, featureId: null });
        }
      }
    };

    map.on('click', hoverLayerId, onClickPermitFill);
    map.on('dblclick', hoverLayerId, onDblClickPermitFill);
    map.on('click', onClickGeneral);

    listenerRefs.current.clickPermitFill = onClickPermitFill;
    listenerRefs.current.dblclickPermitFill = onDblClickPermitFill;
    listenerRefs.current.clickGeneral = onClickGeneral;
  }, [map, calculateGeometryArea, focusOnPermitArea, mode, options.mode, buildTooltipContent]);

  // Function to load permit areas using the service
  const loadInFlightRef = useRef(false);
  const loadPermitAreas = useCallback(async () => {
    if (loadInFlightRef.current) {
      console.log('PermitAreas: Load already in progress, skipping concurrent call');
      return;
    }
    if (!map) {
      console.log('PermitAreas: No map instance available for loading', { map });
      return;
    }
    
    console.log('PermitAreas: loadPermitAreas called', { mapLoaded, mapExists: !!map });
    
    // No early-exit check; mode may change datasets
    
    console.log('PermitAreas: Starting to load permit areas using service');
    loadInFlightRef.current = true;
    // Start a new generation and abort previous
    const reqId = ++requestIdRef.current;
    if (abortControllerRef.current) {
      try { abortControllerRef.current.abort(); } catch (_) {}
    }
    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setLoadError(null);

    try {
      // Use a more defensive approach - wait for map to be truly ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for map to be ready'));
        }, 10000);
        
        const checkReady = () => {
          if (map && map.loaded() && map.isStyleLoaded() && map.getStyle()) {
            clearTimeout(timeout);
            resolve();
          } else {
            setTimeout(checkReady, 50);
          }
        };
        
        checkReady();
      });

      const activeMode = options.mode || mode;
      console.log('PermitAreas: Map confirmed ready, loading via unified geography service for mode', activeMode);

      const cfg = GEOGRAPHIES[activeMode];
      const idPrefix = cfg.idPrefix;
      const type = cfg.type;

      // Proactively unload non-active geographies to prevent stray visibility
      const allPrefixes = ['permit-areas', 'plaza-areas', 'intersections'];
      for (const p of allPrefixes) {
        if (p !== idPrefix) {
          try { unloadGeo(map, p); } catch (_) {}
        }
      }

      // Use unified geography loaders for all modes (polygon and point)
      // They safely add sources/layers if missing and update data with cache-busting
      let features = [];
      if (type === 'polygon') {
        const res = await loadPolygonAreas(map, { idPrefix, url: cfg.datasetUrl, signal: abortControllerRef.current.signal });
        features = res.features;
        // Ensure hover outline exists (empty filter) for polygon modes
        try {
          const hoverOutlineId = `${idPrefix}-hover-outline`;
          if (map.getLayer(hoverOutlineId)) {
            map.setFilter(hoverOutlineId, ['==', ['id'], '']);
          } else {
            let beforeId;
            try { if (map.getLayer(`${idPrefix}-focused-outline`)) beforeId = `${idPrefix}-focused-outline`; } catch (_) {}
            try { if (!beforeId && map.getLayer(`${idPrefix}-outline`)) beforeId = `${idPrefix}-outline`; } catch (_) {}
            map.addLayer({
              id: hoverOutlineId,
              type: 'line',
              source: idPrefix,
              filter: ['==', ['id'], ''],
              layout: { visibility: 'visible' },
              paint: { 'line-color': '#2563eb', 'line-width': 3, 'line-opacity': 0.9 }
            }, beforeId);
          }
        } catch (_) {}
      } else if (type === 'point') {
        const res = await loadPointAreas(map, { idPrefix, url: cfg.datasetUrl, signal: abortControllerRef.current.signal });
        features = res.features;
      }

      // Normalize display name for search/results
      try {
        const normalized = (features || []).map((feat) => {
          const p = feat.properties || {};
          let name = p.name;
          if ((options.mode || mode) === 'plazas') {
            const parts = [p.FSN_1, p.FSN_2, p.FSN_3, p.FSN_4].filter(Boolean);
            if (parts.length > 0) name = parts.join(' & ');
          } else if ((options.mode || mode) === 'intersections') {
            const parts = [p.FSN_1, p.FSN_2].filter(Boolean);
            if (parts.length > 0) name = parts.join(' & ');
          }
          return name ? { ...feat, properties: { ...p, name } } : feat;
        });
        features = normalized;
      } catch (_) {}

      // Cache data for future style reloads
      try {
        cachedDataRef.current[idPrefix] = { type: 'FeatureCollection', features: Array.isArray(features) ? features : [] };
      } catch (_) {}

      // Stale request guard
      if (reqId !== requestIdRef.current) return;

      setPermitAreas(Array.isArray(features) ? features : []);
      console.log(`Areas: Successfully loaded ${features.length} features for mode ${activeMode}`);
      
      // Set up event listeners after successful load
      setupTooltipListeners();
      setupPermitAreaClickListeners();
      setIsLoading(false);

      // If a focus selection exists, re-apply focused filters/visibility now that layers/data are ready
      try {
        const fa = focusedAreaRef.current;
        if (fa) {
          if (type === 'point') {
            if (map.getLayer(`${idPrefix}-focused-points`)) {
              const featureId = fa.id || '';
              map.setFilter(`${idPrefix}-focused-points`, ['==', ['id'], featureId]);
              map.setLayoutProperty(`${idPrefix}-focused-points`, 'visibility', 'visible');
            }
            if (map.getLayer(`${idPrefix}-points`)) map.setLayoutProperty(`${idPrefix}-points`, 'visibility', 'none');
          } else {
            if (map.getLayer(`${idPrefix}-focused-fill`)) {
              const ff = cfg.focusFilter || { type: 'id' };
              if (ff.type === 'property') {
                const val = fa.properties?.[ff.key] || '';
                map.setFilter(`${idPrefix}-focused-fill`, ['==', ['get', ff.key], val]);
                if (map.getLayer(`${idPrefix}-focused-outline`)) map.setFilter(`${idPrefix}-focused-outline`, ['==', ['get', ff.key], val]);
              } else {
                const featureId = fa.id || '';
                map.setFilter(`${idPrefix}-focused-fill`, ['==', ['id'], featureId]);
                if (map.getLayer(`${idPrefix}-focused-outline`)) map.setFilter(`${idPrefix}-focused-outline`, ['==', ['id'], featureId]);
              }
              map.setLayoutProperty(`${idPrefix}-focused-fill`, 'visibility', 'visible');
              if (map.getLayer(`${idPrefix}-focused-outline`)) map.setLayoutProperty(`${idPrefix}-focused-outline`, 'visibility', 'visible');
            }
            if (map.getLayer(`${idPrefix}-fill`)) map.setLayoutProperty(`${idPrefix}-fill`, 'visibility', 'none');
            if (map.getLayer(`${idPrefix}-outline`)) map.setLayoutProperty(`${idPrefix}-outline`, 'visibility', 'none');
          }
        }
      } catch (_) {}
      
    } catch (error) {
      console.error('PermitAreas: Failed to load permit areas:', error);
      setLoadError(error.message);
      setIsLoading(false);
      
      // Clean up on failure
      try {
        unloadGeo(map, 'plaza-areas');
        unloadGeo(map, 'intersections');
        unloadGeo(map, 'permit-areas');
      } catch (cleanupError) {
        console.warn('Error during cleanup:', cleanupError);
      }
    } finally {
      loadInFlightRef.current = false;
    }
  }, [map, mapLoaded, setupTooltipListeners, setupPermitAreaClickListeners, mode, options.mode]);

  // Watchdog: verify permit area layers shortly after mount/style changes and retry if missing
  useEffect(() => {
    if (!map) return;
    let canceled = false;
    let requiredLayers = [];
    const activeMode = options.mode || mode;
    if (activeMode === 'parks') {
      requiredLayers = ['permit-areas-fill','permit-areas-outline','permit-areas-focused-fill','permit-areas-focused-outline'];
    } else if (activeMode === 'plazas') {
      requiredLayers = ['plaza-areas-fill','plaza-areas-outline','plaza-areas-focused-fill','plaza-areas-focused-outline'];
    } else {
      requiredLayers = ['intersections-points','intersections-focused-points'];
    }
    let attempts = 0;
    const maxAttempts = 4;

    const verifyAndRepair = async () => {
      if (canceled) return;
      const hasSource = !!(map.getSource && map.getSource(activeMode === 'parks' ? 'permit-areas' : (activeMode === 'plazas' ? 'plaza-areas' : 'intersections')));
      const allLayers = requiredLayers.every(id => map.getLayer && map.getLayer(id));
      if (hasSource && allLayers) return; // all good
      if (attempts >= maxAttempts) return; // give up silently
      attempts += 1;
      try { await loadPermitAreas(); } catch (_) {}
      setTimeout(() => { if (!canceled) verifyAndRepair(); }, 300);
    };

    const t = setTimeout(verifyAndRepair, 200);
    return () => { canceled = true; clearTimeout(t); };
  }, [map, loadPermitAreas, mode, options.mode]);

  // Rehydrate on style load externally via SpaceStager -> this hook exposes helpers
  const rehydrateActiveGeography = useCallback(() => {
    if (!map) return;
    const activeMode = options.mode || mode;
    const cfg = GEOGRAPHIES[activeMode];
    const idPrefix = cfg.idPrefix;
    const type = cfg.type;

    // Proactively unload non-active geographies to prevent stray visibility
    const allPrefixes = ['permit-areas', 'plaza-areas', 'intersections'];
    for (const p of allPrefixes) {
      if (p !== idPrefix) {
        try { unloadGeo(map, p); } catch (_) {}
      }
    }
    ensureGeoBaseLayers(map, idPrefix, type);
    setGeoBaseVisibility(map, idPrefix, type, true);
    const cached = cachedDataRef.current[idPrefix];
    if (cached && map.getSource(idPrefix)) {
      try { map.getSource(idPrefix).setData(cached); } catch (_) {}
      // Re-apply focused filter and visibility if a selection exists
      try {
        const fa = focusedAreaRef.current;
        if (fa) {
          if (type === 'point') {
            if (map.getLayer(`${idPrefix}-focused-points`)) {
              const featureId = fa.id || '';
              map.setFilter(`${idPrefix}-focused-points`, ['==', ['id'], featureId]);
              map.setLayoutProperty(`${idPrefix}-focused-points`, 'visibility', 'visible');
            }
            if (map.getLayer(`${idPrefix}-points`)) map.setLayoutProperty(`${idPrefix}-points`, 'visibility', 'none');
          } else {
            if (map.getLayer(`${idPrefix}-focused-fill`)) {
              const ff = cfg.focusFilter || { type: 'id' };
              if (ff.type === 'property') {
                const val = fa.properties?.[ff.key] || '';
                map.setFilter(`${idPrefix}-focused-fill`, ['==', ['get', ff.key], val]);
                if (map.getLayer(`${idPrefix}-focused-outline`)) map.setFilter(`${idPrefix}-focused-outline`, ['==', ['get', ff.key], val]);
              } else {
                const featureId = fa.id || '';
                map.setFilter(`${idPrefix}-focused-fill`, ['==', ['id'], featureId]);
                if (map.getLayer(`${idPrefix}-focused-outline`)) map.setFilter(`${idPrefix}-focused-outline`, ['==', ['id'], featureId]);
              }
              map.setLayoutProperty(`${idPrefix}-focused-fill`, 'visibility', 'visible');
              if (map.getLayer(`${idPrefix}-focused-outline`)) map.setLayoutProperty(`${idPrefix}-focused-outline`, 'visibility', 'visible');
            }
            if (map.getLayer(`${idPrefix}-fill`)) map.setLayoutProperty(`${idPrefix}-fill`, 'visibility', 'none');
            if (map.getLayer(`${idPrefix}-outline`)) map.setLayoutProperty(`${idPrefix}-outline`, 'visibility', 'none');
          }
        }
      } catch (_) {}
    } else {
      // Fire a fresh load if no cache
      setTimeout(() => { try { loadPermitAreas(); } catch (_) {} }, 0);
    }
  }, [map, mode, options.mode, loadPermitAreas]);

  // Clear focus function
  const clearFocus = useCallback(() => {
    console.log('Clearing focus');
    
    setFocusedArea(null);
    setShowFocusInfo(false);
    setShowOverlapSelector(false);
    setInitialFocusZoom(null);
    setMinAllowedZoom(null);
    setIsCameraAnimating(false);
    clearOverlapHighlights(map);
    // Restore map constraints and interactions
    try {
      if (map) {
        try { if (map.setMaxBounds) map.setMaxBounds(prevConstraintsRef.current.maxBounds || null); } catch (_) {}
        try {
          if (typeof prevConstraintsRef.current.minZoom === 'number' && map.setMinZoom) {
            map.setMinZoom(prevConstraintsRef.current.minZoom);
          }
        } catch (_) {}
        try { if (map.dragRotate && map.dragRotate.enable) map.dragRotate.enable(); } catch (_) {}
        try {
          if (map.touchZoomRotate) {
            if (map.touchZoomRotate.enableRotation) map.touchZoomRotate.enableRotation();
            else if (map.touchZoomRotate.enable) map.touchZoomRotate.enable();
          }
        } catch (_) {}
      }
      // Reset stored previous values
      prevConstraintsRef.current = { minZoom: null, maxBounds: null, rotation: { dragRotate: null, touchRotate: null } };
    } catch (_) {}
    
    const activeMode = options.mode || mode;
    const idPrefix = activeMode === 'parks' ? 'permit-areas' : (activeMode === 'plazas' ? 'plaza-areas' : 'intersections');
    // Reset focused filters
    try {
      if (map && map.getLayer(`${idPrefix}-focused-fill`)) map.setFilter(`${idPrefix}-focused-fill`, ['==', ['id'], '']);
      if (map && map.getLayer(`${idPrefix}-focused-outline`)) map.setFilter(`${idPrefix}-focused-outline`, ['==', ['id'], '']);
      if (map && map.getLayer(`${idPrefix}-focused-points`)) map.setFilter(`${idPrefix}-focused-points`, ['==', ['id'], '']);
    } catch (_) {}
    // Restore base layers when exiting focus but keep focused overlays visible reset
    try {
      if (map && map.getLayer(`${idPrefix}-fill`)) {
        const vis = prevPermitVisibilityRef.current.fill ?? 'visible';
        map.setLayoutProperty(`${idPrefix}-fill`, 'visibility', vis);
      }
      if (map && map.getLayer(`${idPrefix}-outline`)) {
        const vis = prevPermitVisibilityRef.current.outline ?? 'visible';
        map.setLayoutProperty(`${idPrefix}-outline`, 'visibility', vis);
      }
      if (map && map.getLayer(`${idPrefix}-points`)) {
        const vis = prevPermitVisibilityRef.current.fill ?? 'visible';
        map.setLayoutProperty(`${idPrefix}-points`, 'visibility', vis);
      }
      if (map && map.getLayer(`${idPrefix}-focused-fill`)) map.setLayoutProperty(`${idPrefix}-focused-fill`, 'visibility', 'visible');
      if (map && map.getLayer(`${idPrefix}-focused-outline`)) map.setLayoutProperty(`${idPrefix}-focused-outline`, 'visibility', 'visible');
      if (map && map.getLayer(`${idPrefix}-focused-points`)) map.setLayoutProperty(`${idPrefix}-focused-points`, 'visibility', 'visible');
    } catch (_) {}
  }, [map, mode]);

  // Enforce hiding base geometry while focused, in case UI toggles attempt to show them
  useEffect(() => {
    if (!map) return;
    if (!focusedArea) return;
    const activeMode = options.mode || mode;
    const cfg = GEOGRAPHIES[activeMode];
    const idPrefix = cfg?.idPrefix;
    if (!idPrefix) return;
    try {
      if (map.getLayer(`${idPrefix}-fill`)) {
        map.setLayoutProperty(`${idPrefix}-fill`, 'visibility', 'none');
      }
      if (map.getLayer(`${idPrefix}-outline`)) {
        map.setLayoutProperty(`${idPrefix}-outline`, 'visibility', 'none');
      }
      if (map.getLayer(`${idPrefix}-points`)) {
        map.setLayoutProperty(`${idPrefix}-points`, 'visibility', 'none');
      }
    } catch (_) {}
  }, [map, focusedArea, mode, options.mode]);

  // Search functionality using the service
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    const timer = setTimeout(() => {
      let results = [];
      if (mode === 'parks') {
        results = searchPermitAreas(permitAreas, searchQuery);
      } else {
        const keys = GEOGRAPHIES[mode]?.searchKeys || [];
        const query = searchQuery.toLowerCase().trim();
        results = permitAreas.filter(area => keys.some(k => ((area.properties?.[k] || '').toString().toLowerCase()).includes(query))).slice(0, 10);
      }
      setSearchResults(results);
      setIsSearching(false);
    }, 250);
    
    return () => clearTimeout(timer);
  }, [searchQuery, permitAreas, mode]);

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
      if ((options.mode || mode) === 'parks') {
        // Convert last click position into lngLat for anchoring
        try {
          const lngLat = map && map.unproject ? map.unproject([clickPosition.x, clickPosition.y]) : null;
          const content = buildTooltipContent(canonical.properties, { includeStats: false });
          setClickedTooltip({
            visible: !!content,
            x: clickPosition.x,
            y: clickPosition.y,
            lngLat: lngLat ? { lng: lngLat.lng, lat: lngLat.lat } : null,
            content,
            featureId: (canonical.properties?.system ?? null),
            stats: (() => {
              const id = (canonical.properties?.CEMSID || canonical.properties?.cemsid || canonical.properties?.CEMS_ID || canonical.properties?.cems_id || '').toString();
              const dict = eventsByCemsidRef.current || {};
              return id && dict[id] ? dict[id] : null;
            })(),
            distributions: eventsDistributionsRef.current
          });
          setTooltip(prev => ({ ...prev, visible: false }));
        } catch (_) {}
        setShowOverlapSelector(false);
        clearOverlapHighlights(map);
      } else {
        focusOnPermitArea(canonical);
        setShowOverlapSelector(false);
        clearOverlapHighlights(map);
      }
    }
  }, [overlappingAreas, permitAreas, focusOnPermitArea, map, clickPosition, mode, options.mode, buildTooltipContent]);

  // Function to clear overlap selector
  const clearOverlapSelector = useCallback(() => {
    console.log('Clearing overlap selector');
    setShowOverlapSelector(false);
    setOverlappingAreas([]);
    setSelectedOverlapIndex(0);
    clearOverlapHighlights(map);
  }, [map]);

  // Keep clicked popover anchored as camera changes
  useEffect(() => {
    if (!map) return;
    if (!clickedTooltip.visible || !clickedTooltip.lngLat) return;
    const update = () => {
      try {
        const p = map.project(clickedTooltip.lngLat);
        setClickedTooltip(prev => ({ ...prev, x: p.x, y: p.y }));
      } catch (_) {}
    };
    map.on('move', update);
    map.on('zoom', update);
    map.on('resize', update);
    // Initialize immediately
    update();
    return () => {
      map.off('move', update);
      map.off('zoom', update);
      map.off('resize', update);
    };
  }, [map, clickedTooltip.visible, clickedTooltip.lngLat]);

  // Accessibility: ESC closes clicked popover
  useEffect(() => {
    if (!clickedTooltip.visible) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setClickedTooltip({ visible: false, x: 0, y: 0, lngLat: null, content: null, featureId: null });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [clickedTooltip.visible]);

  // Expose helpers for popover UX
  const dismissClickedTooltip = useCallback(() => {
    setClickedTooltip({ visible: false, x: 0, y: 0, lngLat: null, content: null, featureId: null });
  }, []);

  const focusClickedTooltipArea = useCallback(() => {
    try {
      const id = clickedTooltip.featureId;
      if (!id) return;
      const activeMode = options.mode || mode;
      const list = permitAreas || [];
      let feature = null;
      if (activeMode === 'parks') {
        feature = list.find(f => (f.id === id) || (f.properties && (f.properties.system === id)) ) || null;
      } else {
        feature = list.find(f => f.id === id) || null;
      }
      if (feature) focusOnPermitArea(feature);
    } catch (_) {}
  }, [clickedTooltip.featureId, permitAreas, focusOnPermitArea, mode, options.mode]);



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
    clickedTooltip,
    overlappingAreas,
    selectedOverlapIndex,
    showOverlapSelector,
    clickPosition,
    isLoading,
    loadError,
    mode,
    focusOnPermitArea,
    clearFocus,
    selectOverlappingArea,
    clearOverlapSelector,
    loadPermitAreas,
    initialFocusZoom,
    minAllowedZoom,
    isCameraAnimating,
    rehydrateActiveGeography,
    dismissClickedTooltip,
    focusClickedTooltipArea
  };
};