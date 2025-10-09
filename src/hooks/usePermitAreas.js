// hooks/usePermitAreas.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { useMapEvents } from './useMapEvents';
import { searchPermitAreas, highlightOverlappingAreas, clearOverlapHighlights } from '../services/permitAreaService';
import { loadPolygonAreas, loadPointAreas } from '../services/geographyService';
import { ensureBaseLayers as ensureGeoBaseLayers, setBaseVisibility as setGeoBaseVisibility, unload as unloadGeo } from '../services/geographyLayerManager';
import { GEOGRAPHIES } from '../constants/geographies';
import { useZoneCreatorContext } from '../contexts/ZoneCreatorContext.jsx';
import bbox from '@turf/bbox';
import { snapToNearest, quantizeToSlices } from '../utils/enhancedRenderingUtils';
import { computeAreaOrientation, snapCameraBearingToArea, getSnappedBearing, getCenterOffsetForPitch } from '../utils/bearingUtils';
import { intersect as turfIntersect, booleanIntersects as turfBooleanIntersects } from '@turf/turf';

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
  const [subFocusArea, setSubFocusArea] = useState(null); // Optional polygon scoping within focused area
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
  const initialFocusCameraRef = useRef(null); // Store initial camera state (center, zoom, bearing, pitch) for refocus
  const [showZoomBoundaryWarning, setShowZoomBoundaryWarning] = useState(false); // Show zoom boundary nudge
  const [allowUnrestrictedZoom, setAllowUnrestrictedZoom] = useState(false); // User confirmed they want to zoom out further
  const [zoomBoundaryReady, setZoomBoundaryReady] = useState(false); // Track when boundary is set and handler should attach
  const focusedAreaRef = useRef(focusedArea);
  const zoomBoundaryThreshold = useRef(null); // Store the zoom boundary level
  const isBouncingRef = useRef(false); // Prevent multiple bounces during animation
  const showZoomBoundaryWarningRef = useRef(false); // Ref for modal state to avoid handler re-registration
  const isRefocusingRef = useRef(false); // Guard to prevent zoom boundary during refocus animation
  const prevZoomRef = useRef(null); // Track previous zoom to detect direction
  const prevPermitVisibilityRef = useRef({ fill: null, outline: null });
  // Store and restore map interaction/constraints when entering/exiting focus
  const prevConstraintsRef = useRef({
    minZoom: null,
    maxBounds: null,
    rotation: { dragRotate: null, touchRotate: null }
  });
  // Temporarily store map zoom interaction states while boundary modal is open
  const prevZoomInteractionsRef = useRef(null);
  const listenerRefs = useRef({
    mouseenterFill: null,
    mouseleaveFill: null,
    mousemoveFill: null,
    clickPermitFill: null,
    dblclickPermitFill: null,
    clickGeneral: null
  });
  // Smoothly animate feature-state hoverProgress between 0 and 1 (defined early for use in handlers)
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
  // Track the currently hovered intersection feature id so we can smoothly revert the previous one
  const hoveredIntersectionIdRef = useRef(null);
  // Track currently hovered polygon id (parks/plazas)
  const hoveredPolygonIdRef = useRef(null);
  // Track last mouse position in screen pixels to validate hover during camera moves
  const lastPointerRef = useRef(null);
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

  // Keep ref in sync with state for zoom handler
  useEffect(() => {
    showZoomBoundaryWarningRef.current = showZoomBoundaryWarning;
  }, [showZoomBoundaryWarning]);

  // Clear sub-focus whenever the main focused area changes
  useEffect(() => {
    try { setSubFocusArea(null); } catch (_) {}
  }, [focusedArea?.id]);

  // Render/remove sub-focus overlay layers when subFocusArea changes
  useEffect(() => {
    if (!map) return;
    const srcId = 'sub-focus';
    const fillId = 'sub-focus-fill';
    const lineId = 'sub-focus-outline';

    const addLayers = () => {
      try {
        if (!subFocusArea || !subFocusArea.geometry) return;
        // Source
        try { if (map.getSource(srcId)) map.removeSource(srcId); } catch (_) {}
        map.addSource(srcId, { type: 'geojson', data: subFocusArea });
        // Insert before draw layers if present to keep draw UI on top
        let beforeId;
        try {
          const style = map.getStyle ? map.getStyle() : null;
          const drawLayer = style && Array.isArray(style.layers)
            ? style.layers.find(l => typeof l.id === 'string' && (l.id.startsWith('mapbox-gl-draw') || l.id.startsWith('gl-draw')))
            : null;
          beforeId = drawLayer ? drawLayer.id : undefined;
        } catch (_) {}
        // Fill
        try { if (map.getLayer(fillId)) map.removeLayer(fillId); } catch (_) {}
        map.addLayer({
          id: fillId,
          type: 'fill',
          source: srcId,
          paint: { 'fill-color': '#10b981', 'fill-opacity': 0.18 }
        }, beforeId);
        // Outline
        try { if (map.getLayer(lineId)) map.removeLayer(lineId); } catch (_) {}
        map.addLayer({
          id: lineId,
          type: 'line',
          source: srcId,
          paint: { 'line-color': '#10b981', 'line-width': 3, 'line-opacity': 0.9 }
        }, beforeId);
      } catch (_) {}
    };

    const removeLayers = () => {
      try { if (map.getLayer(fillId)) map.removeLayer(fillId); } catch (_) {}
      try { if (map.getLayer(lineId)) map.removeLayer(lineId); } catch (_) {}
      try { if (map.getSource(srcId)) map.removeSource(srcId); } catch (_) {}
    };

    if (subFocusArea && subFocusArea.geometry) {
      addLayers();
    } else {
      removeLayers();
    }

    // Re-add on style changes
    const onStyle = () => {
      removeLayers();
      if (subFocusArea && subFocusArea.geometry) addLayers();
    };
    map.on('style.load', onStyle);
    return () => {
      try { map.off('style.load', onStyle); } catch (_) {}
      // Do not remove here; rely on state change cleanup
    };
  }, [map, subFocusArea]);

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
      // Union with the current viewport so applying maxBounds never recenters the map
      let union = padded;
      try {
        const b = (typeof map.getBounds === 'function') ? map.getBounds() : null;
        if (b && typeof b.getWest === 'function') {
          const cur = [[b.getWest(), b.getSouth()], [b.getEast(), b.getNorth()]];
          const epsLng = Math.max(1e-6, (cur[1][0] - cur[0][0]) * 0.01);
          const epsLat = Math.max(1e-6, (cur[1][1] - cur[0][1]) * 0.01);
          union = [
            [Math.min(padded[0][0], cur[0][0]) - epsLng, Math.min(padded[0][1], cur[0][1]) - epsLat],
            [Math.max(padded[1][0], cur[1][0]) + epsLng, Math.max(padded[1][1], cur[1][1]) + epsLat]
          ];
        }
      } catch (_) {}
      // Don't set maxBounds - it prevents zoom out by blocking display of areas outside bounds
      // Instead we rely on the soft zoom boundary system below
      // try { if (map.setMaxBounds) map.setMaxBounds(union); } catch (_) {}
      
      // Store zoom boundary threshold for soft constraint (no hard minZoom)
      // Allow only 2 zoom levels of freedom before soft boundary (tighter)
      const boundaryZoom = Math.max(1, (typeof finalZoom === 'number' ? finalZoom : map.getZoom ? map.getZoom() : 16) - 2);
      zoomBoundaryThreshold.current = boundaryZoom;
      prevZoomRef.current = map.getZoom ? map.getZoom() : finalZoom; // Initialize zoom tracking
      setZoomBoundaryReady(true); // Signal that boundary is set and handler should attach
      // Note: We don't call map.setMinZoom() or setMaxBounds() here - instead we use a zoom event handler for soft boundary
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
    // Reset any existing sub-focus scope when a new area is focused
    try { setSubFocusArea(null); } catch (_) {}
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
        // Apply constraints when camera settles, but preserve visual end-center to avoid a jarring jump
        map.once('idle', () => {
          try {
            const finalZoom = map.getZoom ? map.getZoom() : targetZoom;
            const finalCenter = map.getCenter ? map.getCenter() : null;
            const finalBearing = map.getBearing ? map.getBearing() : 0;
            const finalPitch = map.getPitch ? map.getPitch() : 0;
            setInitialFocusZoom(finalZoom);
            setMinAllowedZoom(Math.max(1, finalZoom - 2));
            // Store initial camera state for refocus
            initialFocusCameraRef.current = {
              center: finalCenter,
              zoom: finalZoom,
              bearing: finalBearing,
              pitch: finalPitch
            };
            // Build a synthetic bounds around point based on pixels to ensure useful panning clamp
            const ptPx = map.project({ lng: geom.coordinates[0], lat: geom.coordinates[1] });
            const padPx = 200;
            const sw = map.unproject([ptPx.x - padPx, ptPx.y + padPx]).toArray();
            const ne = map.unproject([ptPx.x + padPx, ptPx.y - padPx]).toArray();
            applyFocusConstraints([sw, ne], finalZoom);
            // Restore animation end-center so constraints do not cause a visible recenter
            try { if (finalCenter && map.setCenter) map.setCenter(finalCenter); } catch (_) {}
          } catch (_) {}
          setIsCameraAnimating(false);
          try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('permit:focus-ready', { detail: { featureId: permitArea?.id || null } })); } catch (_) {}
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
        // Use the oriented bounding box angle for optimal fit without quantization
        const targetBearing = (-angle + 360) % 360;
        if (typeof map.cameraForBounds === 'function') {
          const camera = map.cameraForBounds(orientedBbox, { padding });
          const finalCamera = { ...camera, bearing: targetBearing, duration: 1200, essential: true, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) };
          try { if (typeof map.stop === 'function') map.stop(); } catch (_) {}
          map.easeTo(finalCamera);
        } else {
          try { if (typeof map.stop === 'function') map.stop(); } catch (_) {}
          map.fitBounds(orientedBbox, { padding, duration: 1200 });
          // Follow with a single rotate to target bearing if needed
          try { if (map.rotateTo) map.rotateTo(targetBearing, { duration: 400 }); } catch (_) {}
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
          const finalCenter = map.getCenter ? map.getCenter() : null;
          const finalBearing = map.getBearing ? map.getBearing() : 0;
          const finalPitch = map.getPitch ? map.getPitch() : 0;
          setInitialFocusZoom(finalZoom);
          setMinAllowedZoom(Math.max(1, finalZoom - 2));
          // Store initial camera state for refocus
          initialFocusCameraRef.current = {
            center: finalCenter,
            zoom: finalZoom,
            bearing: finalBearing,
            pitch: finalPitch
          };
          // Apply constraints but first set maxBounds using a union that includes current viewport to avoid any recenter
          applyFocusConstraints([[minX, minY], [maxX, maxY]], finalZoom);
          // Preserve the exact end-center from the animation to avoid any jump when constraints engage
          try { if (finalCenter && map.setCenter) map.setCenter(finalCenter); } catch (_) {}
        } catch (_) {}
        setIsCameraAnimating(false);
        try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('permit:focus-ready', { detail: { featureId: permitArea?.id || null } })); } catch (_) {}
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
            const finalCenter = map.getCenter ? map.getCenter() : null;
            const finalBearing = map.getBearing ? map.getBearing() : 0;
            const finalPitch = map.getPitch ? map.getPitch() : 0;
            setInitialFocusZoom(finalZoom);
            setMinAllowedZoom(Math.max(1, finalZoom - 2));
            // Store initial camera state for refocus
            initialFocusCameraRef.current = {
              center: finalCenter,
              zoom: finalZoom,
              bearing: finalBearing,
              pitch: finalPitch
            };
            applyFocusConstraints(bounds, finalZoom);
            try { if (finalCenter && map.setCenter) map.setCenter(finalCenter); } catch (_) {}
          } catch (_) {}
          setIsCameraAnimating(false);
          try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('permit:focus-ready', { detail: { featureId: permitArea?.id || null } })); } catch (_) {}
        });
      }
    }
    console.log('Permit area focused successfully');
  }, [map, calculateGeometryBounds, mode, options, applyFocusConstraints]);

  // Refocus: restore the initial camera view (zoom back to the original fit view)
  const refocusActivePermitArea = useCallback(() => {
    console.log('[REFOCUS DEBUG] refocusActivePermitArea called', {
      hasMap: !!map,
      hasFocusedArea: !!focusedAreaRef.current,
      hasInitialCamera: !!initialFocusCameraRef.current,
      initialCamera: initialFocusCameraRef.current
    });
    try {
      if (!map) {
        console.warn('[REFOCUS DEBUG] No map available');
        return;
      }
      if (!focusedAreaRef.current) {
        console.warn('[REFOCUS DEBUG] No focused area');
        return;
      }
      const initialCamera = initialFocusCameraRef.current;
      if (!initialCamera) {
        console.warn('[REFOCUS DEBUG] No initial camera state stored');
        return;
      }
      
      // Set refocusing guard to prevent zoom boundary handler from triggering
      isRefocusingRef.current = true;
      
      // Re-enable boundary enforcement in case user previously continued zooming out
      try { setAllowUnrestrictedZoom(false); } catch (_) {}
      
      console.log('[REFOCUS DEBUG] Animating to initial camera state:', initialCamera);
      // Animate back to the initial camera view
      try { if (typeof map.stop === 'function') map.stop(); } catch (_) {}
      map.easeTo({
        center: initialCamera.center,
        zoom: initialCamera.zoom,
        bearing: initialCamera.bearing,
        pitch: initialCamera.pitch,
        duration: 800,
        easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
        essential: true
      });
      
      // Wait for animation to complete before releasing refocusing guard
      map.once('moveend', () => {
        console.log('[REFOCUS DEBUG] Refocus animation completed');
        // Update prevZoom to current position so future zoom-outs are detected correctly
        if (map.getZoom) {
          prevZoomRef.current = map.getZoom();
        }
        // Release refocusing guard
        isRefocusingRef.current = false;
      });
      
      console.log('[REFOCUS DEBUG] Refocus animation started');
    } catch (error) {
      console.error('[REFOCUS DEBUG] Error in refocusActivePermitArea:', error);
      // Make sure to release guard on error
      isRefocusingRef.current = false;
    }
  }, [map]);

  // Set a sub-focus polygon inside the current focused area to scope design view
  const setSubFocusPolygon = useCallback((polygonFeatureOrGeometry) => {
    try {
      const current = focusedAreaRef.current;
      if (!map || !current || !current.geometry) return false;
      const drawnFeature = (() => {
        if (!polygonFeatureOrGeometry) return null;
        if (polygonFeatureOrGeometry.type === 'Feature') return polygonFeatureOrGeometry;
        if (polygonFeatureOrGeometry.type === 'Polygon' || polygonFeatureOrGeometry.type === 'MultiPolygon') {
          return { type: 'Feature', geometry: polygonFeatureOrGeometry, properties: {} };
        }
        return null;
      })();
      if (!drawnFeature || !drawnFeature.geometry) return false;
      // Compute intersection to clamp sub-scope to the focused area footprint (best-effort)
      let subGeom = null;
      try { const clipped = turfIntersect(current, drawnFeature); if (clipped && clipped.geometry) subGeom = clipped.geometry; } catch (_) {}
      // If robust intersect fails, fall back to using the drawn polygon as-is as long as it intersects
      if (!subGeom) {
        let ok = false;
        try { ok = turfBooleanIntersects(current, drawnFeature); } catch (_) { ok = false; }
        if (!ok) return false;
        subGeom = drawnFeature.geometry;
      }
      // Store as a special feature carrying over metadata
      const sub = {
        type: 'Feature',
        id: 'subfocus',
        properties: { ...(current.properties || {}), __subFocus: true },
        geometry: subGeom
      };
      setSubFocusArea(sub);
      // Fit/constraint camera to the sub-scope using oriented bbox like main focus
      try {
        const g = sub.geometry;
        let coords = [];
        if (g.type === 'Polygon') coords = g.coordinates;
        else if (g.type === 'MultiPolygon') coords = g.coordinates.flat();
        if (coords.length > 0) {
          const { rect, angle } = getOrientedMinBBox(coords);
          const xs = rect.map(([x, y]) => x);
          const ys = rect.map(([x, y]) => y);
          const minX = Math.min(...xs), maxX = Math.max(...xs);
          const minY = Math.min(...ys), maxY = Math.max(...ys);
          const orientedBbox = [[minX, minY], [maxX, maxY]];
          const padding = 20;
          const snapStep = Number(options.bearingSnapStep || 45);
          const targetBearing = snapCameraBearingToArea(-angle, { map, areaGeom: { type: 'Polygon', coordinates: [rect] }, pitch: map?.getPitch ? map.getPitch() : 0, enforceAbsolute45: true });
          try { if (typeof map.stop === 'function') map.stop(); } catch (_) {}
          if (typeof map.cameraForBounds === 'function') {
            const camera = map.cameraForBounds(orientedBbox, { padding });
            const finalCamera = { ...camera, bearing: targetBearing, duration: 800, essential: true, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) };
            map.easeTo(finalCamera);
          } else {
            map.fitBounds(orientedBbox, { padding, duration: 800 });
            try { if (map.rotateTo) map.rotateTo(targetBearing, { duration: 300 }); } catch (_) {}
          }
          const onMoveEnd = () => {
            try {
              const finalZoom = map.getZoom ? map.getZoom() : 16;
              const finalCenter = map.getCenter ? map.getCenter() : null;
              applyFocusConstraints([[minX, minY], [maxX, maxY]], finalZoom);
              try { if (finalCenter && map.setCenter) map.setCenter(finalCenter); } catch (_) {}
            } catch (_) {}
            try { map.off('moveend', onMoveEnd); } catch (_) {}
          };
          map.on('moveend', onMoveEnd);
        }
      } catch (_) {}
      return true;
    } catch (_) {
      return false;
    }
  }, [map, applyFocusConstraints, calculateGeometryBounds]);

  const clearSubFocusPolygon = useCallback(() => {
    try { setSubFocusArea(null); } catch (_) {}
    // Re-fit to the main focused area if present
    try {
      const fa = focusedAreaRef.current;
      if (fa) focusOnPermitArea(fa);
    } catch (_) {}
  }, [focusOnPermitArea]);



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

  // Setup tooltip event listeners for permit areas (centralized via useMapEvents — legacy no-op)
  const setupTooltipListeners = useCallback(() => {
    if (!map) return;
    return; // centralized by useMapEvents
  }, [map]);

  // Centralized permit-area hover/move handlers
  const activeModeForEvents = options.mode || mode;
  const idPrefixForEvents = activeModeForEvents === 'parks' ? 'permit-areas' : (activeModeForEvents === 'plazas' ? 'plaza-areas' : 'intersections');
  const hoverLayerIdForEvents = activeModeForEvents === 'intersections' ? `${idPrefixForEvents}-points` : `${idPrefixForEvents}-fill`;

  const handleMouseEnter = useCallback((e) => {
    if (!map) return;
    if (isDrawingActive()) return;
    if (activeModeForEvents === 'intersections' && (!zoneCreator)) {
      try { map.getCanvas().style.cursor = ''; } catch (_) {}
      return;
    }
    try { map.getCanvas().style.cursor = 'pointer'; } catch (_) {}
    if (activeModeForEvents === 'intersections' && e?.features?.length) {
      try {
        const id = e.features[0].id;
        if (id !== undefined && id !== null) {
          const prevId = hoveredIntersectionIdRef.current;
          if (prevId !== null && prevId !== undefined && prevId !== id) {
            animateHoverProgress(map, 'intersections', prevId, 0);
          }
          animateHoverProgress(map, 'intersections', id, 1);
          hoveredIntersectionIdRef.current = id;
        }
      } catch (_) {}
    }
  }, [map, isDrawingActive, activeModeForEvents, zoneCreator, animateHoverProgress]);

  const handleMouseLeave = useCallback(() => {
    if (!map) return;
    try { map.getCanvas().style.cursor = ''; } catch (_) {}
    setTooltip(prev => ({ ...prev, visible: false }));
    try {
      if (activeModeForEvents !== 'intersections') {
        const idPrefix = activeModeForEvents === 'parks' ? 'permit-areas' : (activeModeForEvents === 'plazas' ? 'plaza-areas' : '');
        if (idPrefix) {
          const hoverOutlineId = `${idPrefix}-hover-outline`;
          if (map.getLayer(hoverOutlineId)) map.setFilter(hoverOutlineId, ['==', ['id'], '']);
        }
        hoveredPolygonIdRef.current = null;
      }
    } catch (_) {}
    if (activeModeForEvents === 'intersections') {
      try {
        const prevId = hoveredIntersectionIdRef.current;
        if (prevId !== null && prevId !== undefined) animateHoverProgress(map, 'intersections', prevId, 0);
        hoveredIntersectionIdRef.current = null;
      } catch (_) {}
    }
  }, [map, activeModeForEvents, animateHoverProgress]);

  const handleMouseMove = useCallback((e) => {
    if (!map) return;
    if (e.features.length === 0) return;
    try { lastPointerRef.current = { x: e.point.x, y: e.point.y }; } catch (_) {}
    if (isDrawingActive()) { setTooltip(prev => ({ ...prev, visible: false })); return; }
    if (clickedTooltipVisibleRef.current) { setTooltip(prev => ({ ...prev, visible: false })); return; }
    if (activeModeForEvents === 'intersections') {
      if (!zoneCreator) { setTooltip({ visible: true, x: e.point.x, y: e.point.y, content: [{ label: 'Tip', value: 'Use Zone Creator to select nodes' }] }); return; }
      try {
        const id = e.features[0].id;
        if (id !== undefined && id !== null) {
          const prevId = hoveredIntersectionIdRef.current;
          if (prevId !== null && prevId !== undefined && prevId !== id) animateHoverProgress(map, 'intersections', prevId, 0);
          animateHoverProgress(map, 'intersections', id, 1);
          hoveredIntersectionIdRef.current = id;
        }
      } catch (_) {}
    }
    const feature = e.features[0].properties;
    const tooltipContent = buildTooltipContent(feature, { includeStats: false });
    if (tooltipContent) setTooltip({ visible: true, x: e.point.x, y: e.point.y, content: tooltipContent });
    if (activeModeForEvents !== 'intersections') {
      try {
        const idPrefix = activeModeForEvents === 'parks' ? 'permit-areas' : (activeModeForEvents === 'plazas' ? 'plaza-areas' : '');
        if (idPrefix) {
          const layerId = `${idPrefix}-fill`;
          const feats = map.queryRenderedFeatures([e.point.x, e.point.y], { layers: [layerId] }) || [];
          if (feats.length) {
            const smallest = feats.map(f => ({ f, area: calculateGeometryArea(f.geometry) })).sort((a, b) => a.area - b.area)[0].f;
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
  }, [map, isDrawingActive, activeModeForEvents, zoneCreator, buildTooltipContent, calculateGeometryArea]);

  // Global guard: hide hover tooltip immediately when cursor is not over any geometry
  const handleGlobalMouseMove = useCallback((e) => {
    if (!map) return;
    try {
      try { lastPointerRef.current = { x: e.point.x, y: e.point.y }; } catch (_) {}
      // Never show hover tooltip while drawing or a clicked popover is visible
      if (isDrawingActive() || clickedTooltipVisibleRef.current) {
        setTooltip(prev => ({ ...prev, visible: false }));
        return;
      }
      // Robust: check across all potential geography layers (base and focused)
      const candidateLayers = ['permit-areas-fill','plaza-areas-fill','intersections-points','permit-areas-focused-fill','plaza-areas-focused-fill','intersections-focused-points']
        .filter((id) => { try { return map.getLayer && map.getLayer(id); } catch (_) { return false; } });
      const feats = candidateLayers.length > 0
        ? (map.queryRenderedFeatures([e.point.x, e.point.y], { layers: candidateLayers }) || [])
        : [];
      if (!feats.length) {
        // Hide tooltip and clear any hover visuals when moving off geometry
        setTooltip(prev => ({ ...prev, visible: false }));
        if (activeModeForEvents === 'intersections') {
          try {
            const prevId = hoveredIntersectionIdRef.current;
            if (prevId !== null && prevId !== undefined) animateHoverProgress(map, 'intersections', prevId, 0);
            hoveredIntersectionIdRef.current = null;
          } catch (_) {}
        } else {
          try {
            const idPrefix = activeModeForEvents === 'parks' ? 'permit-areas' : (activeModeForEvents === 'plazas' ? 'plaza-areas' : '');
            if (idPrefix) {
              const hoverOutlineId = `${idPrefix}-hover-outline`;
              if (map.getLayer(hoverOutlineId)) map.setFilter(hoverOutlineId, ['==', ['id'], '']);
            }
            hoveredPolygonIdRef.current = null;
          } catch (_) {}
        }
      }
    } catch (_) {}
  }, [map, isDrawingActive, activeModeForEvents, hoverLayerIdForEvents, animateHoverProgress]);

  // Hide hover tooltip while panning/zooming if the last pointer location is no longer over geometry
  const handleCameraMove = useCallback(() => {
    if (!map) return;
    try {
      const pt = lastPointerRef.current;
      if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number') {
        setTooltip(prev => ({ ...prev, visible: false }));
        if (activeModeForEvents === 'intersections') {
          try {
            const prevId = hoveredIntersectionIdRef.current;
            if (prevId !== null && prevId !== undefined) animateHoverProgress(map, 'intersections', prevId, 0);
            hoveredIntersectionIdRef.current = null;
          } catch (_) {}
        } else {
          try {
            const idPrefix = activeModeForEvents === 'parks' ? 'permit-areas' : (activeModeForEvents === 'plazas' ? 'plaza-areas' : '');
            if (idPrefix) {
              const hoverOutlineId = `${idPrefix}-hover-outline`;
              if (map.getLayer(hoverOutlineId)) map.setFilter(hoverOutlineId, ['==', ['id'], '']);
            }
            hoveredPolygonIdRef.current = null;
          } catch (_) {}
        }
        return;
      }
      const feats = map.queryRenderedFeatures([pt.x, pt.y], { layers: [hoverLayerIdForEvents] }) || [];
      if (!feats.length) {
        setTooltip(prev => ({ ...prev, visible: false }));
        if (activeModeForEvents === 'intersections') {
          try {
            const prevId = hoveredIntersectionIdRef.current;
            if (prevId !== null && prevId !== undefined) animateHoverProgress(map, 'intersections', prevId, 0);
            hoveredIntersectionIdRef.current = null;
          } catch (_) {}
        } else {
          try {
            const idPrefix = activeModeForEvents === 'parks' ? 'permit-areas' : (activeModeForEvents === 'plazas' ? 'plaza-areas' : '');
            if (idPrefix) {
              const hoverOutlineId = `${idPrefix}-hover-outline`;
              if (map.getLayer(hoverOutlineId)) map.setFilter(hoverOutlineId, ['==', ['id'], '']);
            }
            hoveredPolygonIdRef.current = null;
          } catch (_) {}
        }
      }
    } catch (_) {}
  }, [map, hoverLayerIdForEvents, activeModeForEvents, animateHoverProgress]);

  useMapEvents(map, [
    { event: 'mouseenter', layerId: hoverLayerIdForEvents, handler: handleMouseEnter },
    { event: 'mouseleave', layerId: hoverLayerIdForEvents, handler: handleMouseLeave },
    { event: 'mousemove', layerId: hoverLayerIdForEvents, handler: handleMouseMove }
  ], { reattachOnStyleLoad: true });

  // Map-level mousemove to ensure hover UI clears when not over any feature
  useMapEvents(map, [
    { event: 'mousemove', handler: handleGlobalMouseMove }
  ], { reattachOnStyleLoad: true });

  // Camera movements can invalidate the last hover position; verify and hide if needed
  useMapEvents(map, [
    { event: 'move', handler: handleCameraMove }
  ], { reattachOnStyleLoad: true });

  // Frame-by-frame validation: if tooltip is visible but no features are under the last pointer, hide it
  const validateHoverOnRender = useCallback(() => {
    if (!map) return;
    try {
      // If not visible, nothing to validate
      if (!tooltip || !tooltip.visible) return;
      // Do not alter clicked popover flows or while drawing
      if (isDrawingActive() || clickedTooltipVisibleRef.current) return;
      const pt = lastPointerRef.current;
      if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number') {
        setTooltip(prev => ({ ...prev, visible: false }));
        return;
      }
      const candidateLayers = ['permit-areas-fill','plaza-areas-fill','intersections-points','permit-areas-focused-fill','plaza-areas-focused-fill','intersections-focused-points']
        .filter((id) => { try { return map.getLayer && map.getLayer(id); } catch (_) { return false; } });
      const feats = candidateLayers.length > 0
        ? (map.queryRenderedFeatures([pt.x, pt.y], { layers: candidateLayers }) || [])
        : [];
      if (!feats.length) {
        setTooltip(prev => ({ ...prev, visible: false }));
      }
    } catch (_) {}
  }, [map, tooltip, isDrawingActive]);

  useMapEvents(map, [
    { event: 'render', handler: validateHoverOnRender }
  ], { reattachOnStyleLoad: true });

  // Immediately hide hover on interaction starts that can invalidate hover
  const hideHoverImmediate = useCallback(() => {
    try {
      setTooltip(prev => ({ ...prev, visible: false }));
      const idPrefix = activeModeForEvents === 'parks' ? 'permit-areas' : (activeModeForEvents === 'plazas' ? 'plaza-areas' : 'intersections');
      if (idPrefix === 'intersections') {
        const prevId = hoveredIntersectionIdRef.current;
        if (prevId !== null && prevId !== undefined) animateHoverProgress(map, 'intersections', prevId, 0);
        hoveredIntersectionIdRef.current = null;
      } else {
        const hoverOutlineId = `${idPrefix}-hover-outline`;
        if (map && map.getLayer && map.getLayer(hoverOutlineId)) map.setFilter(hoverOutlineId, ['==', ['id'], '']);
        hoveredPolygonIdRef.current = null;
      }
    } catch (_) {}
  }, [map, activeModeForEvents, animateHoverProgress]);

  useMapEvents(map, [
    { event: 'dragstart', handler: hideHoverImmediate },
    { event: 'zoomstart', handler: hideHoverImmediate },
    { event: 'wheel', handler: hideHoverImmediate },
    { event: 'pitchstart', handler: hideHoverImmediate },
    { event: 'rotatestart', handler: hideHoverImmediate }
  ], { reattachOnStyleLoad: true });

  // DOM-level guards: hide tooltip when cursor leaves the map canvas or when over non-canvas overlays
  useEffect(() => {
    if (!map) return;
    let container = null;
    try { container = (typeof map.getCanvasContainer === 'function') ? map.getCanvasContainer() : null; } catch (_) { container = null; }
    const canvas = (() => { try { return (typeof map.getCanvas === 'function') ? map.getCanvas() : null; } catch (_) { return null; } })();
    if (!container) return;

    const hide = () => { try { setTooltip(prev => ({ ...prev, visible: false })); } catch (_) {} };
    const onDocMove = (ev) => {
      try {
        const target = ev.target;
        const rect = container && container.getBoundingClientRect ? container.getBoundingClientRect() : null;
        // Compute pointer relative to map container for robust queries even when overlays intercept events
        if (rect && typeof ev.clientX === 'number' && typeof ev.clientY === 'number') {
          const x = ev.clientX - rect.left;
          const y = ev.clientY - rect.top;
          lastPointerRef.current = { x, y };
        }
        // If pointer is outside the map container OR not on the canvas (i.e., over an overlay), hide the hover tooltip
        if (!container.contains(target) || (canvas && target !== canvas)) {
          setTooltip(prev => ({ ...prev, visible: false }));
          return;
        }
        // Inside the container but overlays may block map mousemove; proactively hide when no features under pointer
        if (!isDrawingActive() && !clickedTooltipVisibleRef.current && lastPointerRef.current) {
          const { x, y } = lastPointerRef.current;
          const candidateLayers = ['permit-areas-fill','plaza-areas-fill','intersections-points','permit-areas-focused-fill','plaza-areas-focused-fill','intersections-focused-points']
            .filter((id) => { try { return map.getLayer && map.getLayer(id); } catch (_) { return false; } });
          const feats = candidateLayers.length > 0
            ? (map.queryRenderedFeatures([x, y], { layers: candidateLayers }) || [])
            : [];
          if (!feats.length) {
            setTooltip(prev => ({ ...prev, visible: false }));
            if (activeModeForEvents === 'intersections') {
              try {
                const prevId = hoveredIntersectionIdRef.current;
                if (prevId !== null && prevId !== undefined) animateHoverProgress(map, 'intersections', prevId, 0);
                hoveredIntersectionIdRef.current = null;
              } catch (_) {}
            } else {
              try {
                const idPrefix = activeModeForEvents === 'parks' ? 'permit-areas' : (activeModeForEvents === 'plazas' ? 'plaza-areas' : '');
                if (idPrefix) {
                  const hoverOutlineId = `${idPrefix}-hover-outline`;
                  if (map.getLayer(hoverOutlineId)) map.setFilter(hoverOutlineId, ['==', ['id'], '']);
                }
                hoveredPolygonIdRef.current = null;
              } catch (_) {}
            }
          }
        }
      } catch (_) {}
    };

    try { container.addEventListener('mouseleave', hide); } catch (_) {}
    try { container.addEventListener('touchstart', hide, { passive: true }); } catch (_) {}
    try { document.addEventListener('mousemove', onDocMove, true); } catch (_) {}

    return () => {
      try { container.removeEventListener('mouseleave', hide); } catch (_) {}
      try { container.removeEventListener('touchstart', hide, { passive: true }); } catch (_) {}
      try { document.removeEventListener('mousemove', onDocMove, true); } catch (_) {}
    };
  }, [map]);

  

  // Enhanced permit area click handling with overlap detection (centralized via useMapEvents — legacy no-op)
  const setupPermitAreaClickListeners = useCallback(() => {
    if (!map) return;
    return; // centralized by useMapEvents
  }, [map]);

  const hoverLayerIdClick = (options.mode || mode) === 'intersections' ? 'intersections-points' : ((options.mode || mode) === 'plazas' ? 'plaza-areas-fill' : 'permit-areas-fill');

  const handleClickPermitFill = useCallback((e) => {
    if (!map) return;
    try { console.debug('PERMIT: handleClickPermitFill start', { prevented: !!e?.defaultPrevented, feats: e?.features?.length, x: e?.point?.x, y: e?.point?.y }); } catch (_) {}
    if (e?.defaultPrevented) { try { console.debug('PERMIT: bail defaultPrevented'); } catch (_) {} return; }
    if (e.features.length === 0) return;
    // Ignore clicks that intersect annotation layers to avoid clashing with annotation popup
    try {
      const pt = [e.point.x, e.point.y];
      const layers = ['annotation-text', 'annotation-arrows', 'annotation-arrowheads'];
      const annHits = map.queryRenderedFeatures && map.queryRenderedFeatures(pt, { layers });
      if (annHits && annHits.length) { try { console.debug('PERMIT: bail annotation hit', { hits: annHits.length }); } catch (_) {} return; }
    } catch (_) {}
    const activeMode = options.mode || mode;
    if (activeMode === 'intersections') return;
    const drawControl = map.getControl && map.getControl('MapboxDraw');
    if (drawControl && drawControl.getMode && drawControl.getMode() !== 'simple_select') { try { console.debug('PERMIT: bail drawing active'); } catch (_) {} return; }
    e.preventDefault && e.preventDefault();
    const point = [e.point.x, e.point.y];
    const allFeatures = map.queryRenderedFeatures(point, { layers: [hoverLayerIdClick] });
    try { console.debug('PERMIT: resolved features', { count: allFeatures.length }); } catch (_) {}
    if (allFeatures.length > 1) {
      const sortedFeatures = mode === 'intersections' ? allFeatures : allFeatures.map(feature => ({ ...feature, calculatedArea: calculateGeometryArea(feature.geometry) })).sort((a, b) => a.calculatedArea - b.calculatedArea);
      setOverlappingAreas(sortedFeatures); setSelectedOverlapIndex(0); setShowOverlapSelector(true); setClickPosition({ x: e.point.x, y: e.point.y });
      if (activeMode === 'parks') highlightOverlappingAreas(map, sortedFeatures);
    } else {
      const top = allFeatures[0];
      if (activeMode === 'parks') {
        try {
          const lngLat = e.lngLat || map.unproject([e.point.x, e.point.y]);
          const content = buildTooltipContent(top.properties, { includeStats: false });
          setClickedTooltip({ visible: !!content, x: e.point.x, y: e.point.y, lngLat: lngLat ? { lng: lngLat.lng, lat: lngLat.lat } : null, content, featureId: (top.properties?.system ?? null), stats: (() => { const id = (top.properties?.CEMSID || top.properties?.cemsid || top.properties?.CEMS_ID || top.properties?.cems_id || '').toString(); const dict = eventsByCemsidRef.current || {}; return id && dict[id] ? dict[id] : null; })(), distributions: eventsDistributionsRef.current });
          setTooltip(prev => ({ ...prev, visible: false }));
        } catch (_) {}
        setShowOverlapSelector(false);
      } else {
        focusOnPermitArea(top); setShowOverlapSelector(false);
      }
    }
  }, [map, mode, options.mode, calculateGeometryArea, buildTooltipContent, focusOnPermitArea]);

  const handleDblClickPermitFill = useCallback((e) => {
    if (!map) return;
    try { console.debug('PERMIT: handleDblClickPermitFill start', { prevented: !!e?.defaultPrevented, feats: e?.features?.length, x: e?.point?.x, y: e?.point?.y }); } catch (_) {}
    if (e?.defaultPrevented) { try { console.debug('PERMIT: bail defaultPrevented dblclick'); } catch (_) {} return; }
    if (e.features.length === 0) return;
    // Ignore dblclicks that intersect annotation layers to avoid clashing with annotation popup
    try {
      const pt = [e.point.x, e.point.y];
      const layers = ['annotation-text', 'annotation-arrows', 'annotation-arrowheads'];
      const annHits = map.queryRenderedFeatures && map.queryRenderedFeatures(pt, { layers });
      if (annHits && annHits.length) { try { console.debug('PERMIT: bail annotation hit dblclick', { hits: annHits.length }); } catch (_) {} return; }
    } catch (_) {}
    const activeMode = options.mode || mode;
    if (activeMode === 'intersections') return;
    const drawControl = map.getControl && map.getControl('MapboxDraw');
    if (drawControl && drawControl.getMode && drawControl.getMode() !== 'simple_select') { try { console.debug('PERMIT: bail drawing active dblclick'); } catch (_) {} return; }
    e.preventDefault && e.preventDefault();
    const feature = e.features[0];
    focusOnPermitArea(feature);
    setShowOverlapSelector(false);
    if (activeMode === 'parks') clearOverlapHighlights(map);
    setClickedTooltip({ visible: false, x: 0, y: 0, lngLat: null, content: null, featureId: null });
  }, [map, mode, options.mode, focusOnPermitArea]);

  const handleClickGeneral = useCallback((e) => {
    if (!map) return;
    try { console.debug('PERMIT: handleClickGeneral start', { prevented: !!e?.defaultPrevented, x: e?.point?.x, y: e?.point?.y }); } catch (_) {}
    if (e?.defaultPrevented) { try { console.debug('PERMIT: bail defaultPrevented general'); } catch (_) {} return; }
    if (focusedAreaRef.current) return;
    // Ignore clicks on annotation layers to avoid closing their popup
    try {
      const pt = [e.point.x, e.point.y];
      const layers = ['annotation-text', 'annotation-arrows', 'annotation-arrowheads'];
      const annHits = map.queryRenderedFeatures && map.queryRenderedFeatures(pt, { layers });
      if (annHits && annHits.length) { try { console.debug('PERMIT: bail annotation hit general', { hits: annHits.length }); } catch (_) {} return; }
    } catch (_) {}
    const drawControl = map.getControl && map.getControl('MapboxDraw');
    if (drawControl && drawControl.getMode && drawControl.getMode() !== 'simple_select') { try { console.debug('PERMIT: bail drawing active general'); } catch (_) {} return; }
    const features = map.queryRenderedFeatures(e.point, { layers: [hoverLayerIdClick] });
    if (features.length === 0) {
      setShowOverlapSelector(false);
      if (mode === 'parks') {
        clearOverlapHighlights(map);
        setClickedTooltip({ visible: false, x: 0, y: 0, lngLat: null, content: null, featureId: null });
      }
    }
  }, [map, mode]);

  useMapEvents(map, [
    { event: 'click', layerId: hoverLayerIdClick, handler: handleClickPermitFill },
    { event: 'dblclick', layerId: hoverLayerIdClick, handler: handleDblClickPermitFill },
    { event: 'click', handler: handleClickGeneral }
  ], { reattachOnStyleLoad: true });

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
      // Relaxed readiness: proceed when a style exists; otherwise wait for a short style.load or fallback
      await new Promise((resolve) => {
        try {
          if (map && typeof map.getStyle === 'function' && map.getStyle()) { resolve(); return; }
        } catch (_) {}
        const onStyle = () => { try { map.off('style.load', onStyle); } catch (_) {} resolve(); };
        try { map.once('style.load', onStyle); } catch (_) { resolve(); }
        // Fallback after 2s to avoid deadlocks on edge styles
        setTimeout(() => { try { map.off('style.load', onStyle); } catch (_) {} resolve(); }, 2000);
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

  // Zoom event handler for soft boundary enforcement with bounce animation
  useEffect(() => {
    // When the modal closes, always restore map interactions using the stored snapshot
    if (!map) return;
    if (!showZoomBoundaryWarning && prevZoomInteractionsRef.current) {
      try {
        const prev = prevZoomInteractionsRef.current;
        try { if (map.scrollZoom && map.scrollZoom[prev.scrollZoom ? 'enable' : 'disable']) map.scrollZoom[prev.scrollZoom ? 'enable' : 'disable'](); } catch (_) {}
        try { if (map.boxZoom && map.boxZoom[prev.boxZoom ? 'enable' : 'disable']) map.boxZoom[prev.boxZoom ? 'enable' : 'disable'](); } catch (_) {}
        try { if (map.dragPan && map.dragPan[prev.dragPan ? 'enable' : 'disable']) map.dragPan[prev.dragPan ? 'enable' : 'disable'](); } catch (_) {}
        try { if (map.keyboard && map.keyboard[prev.keyboard ? 'enable' : 'disable']) map.keyboard[prev.keyboard ? 'enable' : 'disable'](); } catch (_) {}
        try { if (map.doubleClickZoom && map.doubleClickZoom[prev.doubleClickZoom ? 'enable' : 'disable']) map.doubleClickZoom[prev.doubleClickZoom ? 'enable' : 'disable'](); } catch (_) {}
        try { if (map.touchZoomRotate && map.touchZoomRotate[prev.touchZoomRotate ? 'enable' : 'disable']) map.touchZoomRotate[prev.touchZoomRotate ? 'enable' : 'disable'](); } catch (_) {}
      } catch (_) {}
      prevZoomInteractionsRef.current = null;
    }
  }, [map, showZoomBoundaryWarning]);

  useEffect(() => {
    if (!map || !focusedArea || !zoomBoundaryReady || zoomBoundaryThreshold.current === null) {
      return;
    }
    
        const handleZoom = () => {
          // Skip if user has allowed unrestricted zoom for this focus session
          if (allowUnrestrictedZoom) return;

          // If currently bouncing, modal is showing, or refocusing, ignore all zoom events
          if (isBouncingRef.current || showZoomBoundaryWarningRef.current || isRefocusingRef.current) return;
      
      const currentZoom = map.getZoom();
      const boundary = zoomBoundaryThreshold.current;
      const previousZoom = prevZoomRef.current;
      
      // Only trigger if zooming OUT past the boundary
      const isZoomingOut = previousZoom !== null && currentZoom < previousZoom;
      
      if (currentZoom < boundary && isZoomingOut) {
        // Set bouncing guard immediately
        isBouncingRef.current = true;
        
        // DON'T update prevZoomRef here - let it stay at the boundary so we can detect direction after bounce
        
        // Target zoom level for bounce (slightly above boundary)
        const targetZoom = boundary + 0.5;
        
        // Stop any ongoing animations
        try {
          map.stop();
        } catch (_) {}
        
        // Bounce back animation
        map.easeTo({
          zoom: targetZoom,
          duration: 400,
          easing: (t) => {
            // easeOutBounce from MapLibre examples
            const n1 = 7.5625;
            const d1 = 2.75;
            if (t < 1 / d1) {
              return n1 * t * t;
            } else if (t < 2 / d1) {
              return n1 * (t -= 1.5 / d1) * t + 0.75;
            } else if (t < 2.5 / d1) {
              return n1 * (t -= 2.25 / d1) * t + 0.9375;
            } else {
              return n1 * (t -= 2.625 / d1) * t + 0.984375;
            }
          },
          essential: true
        });
        
        // Listen for the animation to complete using MapLibre's event system
        const onBounceComplete = () => {
          // Clean up this one-time listener
          map.off('moveend', onBounceComplete);
          
          // Update prevZoom to the bounced position so future zooms can be detected correctly
          prevZoomRef.current = map.getZoom();
          
          // Show the modal AFTER bounce completes
          showZoomBoundaryWarningRef.current = true;
          setShowZoomBoundaryWarning(true);
          
          // Freeze map zoom interactions while modal is open
          try {
            if (map) {
              const prev = {
                scrollZoom: !!(map.scrollZoom && map.scrollZoom.isEnabled && map.scrollZoom.isEnabled()),
                boxZoom: !!(map.boxZoom && map.boxZoom.isEnabled && map.boxZoom.isEnabled()),
                dragPan: !!(map.dragPan && map.dragPan.isEnabled && map.dragPan.isEnabled()),
                keyboard: !!(map.keyboard && map.keyboard.isEnabled && map.keyboard.isEnabled()),
                doubleClickZoom: !!(map.doubleClickZoom && map.doubleClickZoom.isEnabled && map.doubleClickZoom.isEnabled()),
                touchZoomRotate: !!(map.touchZoomRotate && map.touchZoomRotate.isEnabled && map.touchZoomRotate.isEnabled())
              };
              prevZoomInteractionsRef.current = prev;
              try { if (map.scrollZoom && map.scrollZoom.disable) map.scrollZoom.disable(); } catch (_) {}
              try { if (map.boxZoom && map.boxZoom.disable) map.boxZoom.disable(); } catch (_) {}
              try { if (map.dragPan && map.dragPan.disable) map.dragPan.disable(); } catch (_) {}
              try { if (map.keyboard && map.keyboard.disable) map.keyboard.disable(); } catch (_) {}
              try { if (map.doubleClickZoom && map.doubleClickZoom.disable) map.doubleClickZoom.disable(); } catch (_) {}
              try { if (map.touchZoomRotate && map.touchZoomRotate.disable) map.touchZoomRotate.disable(); } catch (_) {}
            }
          } catch (_) {}
          
          // Release bouncing guard ONLY after modal is shown
          isBouncingRef.current = false;
        };
        
        // Attach the moveend listener for this specific bounce
        map.once('moveend', onBounceComplete);
      } else {
        // Normal zoom event - track zoom level for direction detection
        prevZoomRef.current = currentZoom;
      }
    };
    
    // Attach zoom event listener
    map.on('zoom', handleZoom);
    
    return () => {
      map.off('zoom', handleZoom);
    };
  }, [map, focusedArea, zoomBoundaryReady, allowUnrestrictedZoom]);

  // Handlers for zoom boundary warning
  const handleZoomBoundaryConfirm = useCallback(() => {
    setAllowUnrestrictedZoom(true);
    showZoomBoundaryWarningRef.current = false; // Reset ref synchronously
    setShowZoomBoundaryWarning(false);
    // Note: Interaction restoration is handled by the useEffect watching showZoomBoundaryWarning
  }, []);

  const handleZoomBoundaryCancel = useCallback(() => {
    showZoomBoundaryWarningRef.current = false; // Reset ref synchronously
    setShowZoomBoundaryWarning(false);
    // Camera is already at the boundary from the bounce animation
    // Keep unrestricted zoom disabled
    // Note: Interaction restoration is handled by the useEffect watching showZoomBoundaryWarning
  }, []);

  // Clear focus function
  const clearFocus = useCallback(() => {
    console.log('Clearing focus');
    
    setFocusedArea(null);
    setSubFocusArea(null);
    setShowFocusInfo(false);
    setShowOverlapSelector(false);
    setInitialFocusZoom(null);
    setMinAllowedZoom(null);
    setIsCameraAnimating(false);
    showZoomBoundaryWarningRef.current = false; // Reset ref synchronously
    setShowZoomBoundaryWarning(false);
    setAllowUnrestrictedZoom(false);
    setZoomBoundaryReady(false); // Reset boundary ready state
    zoomBoundaryThreshold.current = null;
    prevZoomRef.current = null; // Reset zoom tracking
    isBouncingRef.current = false;
    isRefocusingRef.current = false; // Reset refocusing guard
    initialFocusCameraRef.current = null; // Clear stored camera state
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
    // Also clear any hover outline highlight and hover state trackers
    try {
      if (idPrefix === 'permit-areas' || idPrefix === 'plaza-areas') {
        const hoverOutlineId = `${idPrefix}-hover-outline`;
        if (map && map.getLayer(hoverOutlineId)) map.setFilter(hoverOutlineId, ['==', ['id'], '']);
        hoveredPolygonIdRef.current = null;
      } else if (idPrefix === 'intersections') {
        const prevId = hoveredIntersectionIdRef.current;
        if (prevId !== null && prevId !== undefined) animateHoverProgress(map, 'intersections', prevId, 0);
        hoveredIntersectionIdRef.current = null;
      }
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
    try { setShowOverlapSelector(false); } catch (_) {}
    const selected = overlappingAreas[index] || (Array.isArray(overlappingAreas) && overlappingAreas.length === 0 && listenerRefs.current && listenerRefs.current.__lastOverlaps && listenerRefs.current.__lastOverlaps[index]);
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
        // already hidden above
        clearOverlapHighlights(map);
      } else {
        focusOnPermitArea(canonical);
        // already hidden above
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



  // Auto-hide overlap selector when a clicked popover becomes visible
  useEffect(() => {
    if (clickedTooltip && clickedTooltip.visible) {
      try { setShowOverlapSelector(false); } catch (_) {}
    }
  }, [clickedTooltip.visible]);

  return {
    permitAreas,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    focusedArea,
    subFocusArea,
    hasSubFocus: !!subFocusArea,
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
    refocusActivePermitArea,
    clearFocus,
    setSubFocusPolygon,
    clearSubFocusPolygon,
    effectiveFocusedArea: subFocusArea || focusedArea,
    selectOverlappingArea,
    clearOverlapSelector,
    loadPermitAreas,
    initialFocusZoom,
    minAllowedZoom,
    isCameraAnimating,
    rehydrateActiveGeography,
    dismissClickedTooltip,
    focusClickedTooltipArea,
    showZoomBoundaryWarning,
    handleZoomBoundaryConfirm,
    handleZoomBoundaryCancel,
    allowUnrestrictedZoom
  };
};