import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Header from './Header/Header';
import ExamplesModal from './Modals/ExamplesModal';
import Sidebar from './Sidebar/Sidebar';
import MapContainer from './Map/MapContainer';
import InfoPanel from './Modals/InfoPanel';
import FocusInfoPanel from './Modals/FocusInfoPanel';
import WelcomeOverlay from './Tutorial/WelcomeOverlay';
import TutorialTooltip from './Tutorial/TutorialTooltip';
import ZoomBoundaryNudge from './Nudges/ZoomBoundaryNudge';
import RightSidebar from './Sidebar/RightSidebar';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout.js';
import { DroppedObjectsProvider } from '../contexts/DroppedObjectsContext';
import NudgeCenter from './Nudges/NudgeCenter';
import { useMap } from '../hooks/useMap';
import { useDrawTools } from '../hooks/useDrawTools';
import { usePermitAreas } from '../hooks/usePermitAreas';
import { useInfrastructure } from '../hooks/useInfrastructure';
import { useClickToPlace } from '../hooks/useClickToPlace';
import { useSitePlan } from '../contexts/SitePlanContext';
import { INITIAL_LAYERS } from '../constants/layers';
import { PLACEABLE_OBJECTS } from '../constants/placeableObjects';
import { GEOGRAPHIES } from '../constants/geographies';
import { setBaseVisibility as setGeoBaseVisibility, ensureBaseLayers as ensureGeoBaseLayers } from '../services/geographyLayerManager';
import { exportPlan, exportPermitAreaSiteplanV2 } from '../utils/exportUtils';
import { importPlan } from '../utils/importUtils';
import { useNudges } from '../hooks/useNudges';
import { useGeography } from '../contexts/GeographyContext';
import { useTutorial } from '../contexts/TutorialContext';
import GeographySelector from './Modals/GeographySelector';
import EventInfoModal from './Modals/EventInfoModal';
import ExportOptionsModal from './Modals/ExportOptionsModal';
import ImportProgressModal from './Modals/ImportProgressModal';
import '../styles/eventStager-dpr.css';
import '../styles/eventStager.css';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { switchBasemap } from '../utils/mapUtils';
import { distance as turfDistance, booleanPointInPolygon as turfBooleanPointInPolygon, centroid as turfCentroid } from '@turf/turf';
import { computeDominantBearingFromPolygon, computeDominantViewportBearing } from '../utils/enhancedRenderingUtils';
import { BASEMAP_OPTIONS } from '../constants/mapConfig';

const SpaceStager = () => {
  const mapContainerRef = useRef(null);
  const responsive = useResponsiveLayout();
  const { map, mapLoaded, styleLoaded } = useMap(mapContainerRef);
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const [showInfo, setShowInfo] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const labelSigRef = useRef('');
  const [labelScanFlag, setLabelScanFlag] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const getInitialDark = () => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (_) {
      return false;
    }
  };
  const [isDarkMode, setIsDarkMode] = useState(getInitialDark);

  useEffect(() => {
    try {
      const root = document.documentElement;
      if (isDarkMode) {
        root.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        root.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    } catch (_) {}
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => setIsDarkMode(v => !v), []);
  
  // (moved below handleStyleChange to avoid TDZ)
  
  // Use custom hooks for different functionalities
  const { geographyType, isGeographyChosen, selectGeography } = useGeography();
  const { isTutorialActive, showWelcome } = useTutorial();
  // Allow forcing the geography selector modal open via a UI event
  const [showGeoSelectorOverride, setShowGeoSelectorOverride] = useState(false);
  const [showEventInfo, setShowEventInfo] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [importProgress, setImportProgress] = useState({ open: false, step: 'confirm', message: '' });
  const [eventInfo, setEventInfo] = useState({});
  const [exportOptions, setExportOptions] = useState({
    dimensionUnits: 'ft',
    includeObjectDimensions: true,
    includeZoneDimensions: false,
    includeStreetSidewalkDimensions: false,
    noLegend: false,
    mapProjectionMode: 'topDown'
  });
  const [areaWarning, setAreaWarning] = useState(null);
  // Import rehydration guard: skip auto layer resets while importing a plan
  const rehydratingImportRef = useRef(false);
  const [isImportingPlan, setIsImportingPlan] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  
  useEffect(() => {
    const handler = () => setShowGeoSelectorOverride(true);
    window.addEventListener('ui:show-geography-selector', handler);
    return () => window.removeEventListener('ui:show-geography-selector', handler);
  }, []);
  useEffect(() => {
    const showInfo = () => setShowEventInfo(true);
    const showOpts = () => setShowExportOptions(true);
    window.addEventListener('ui:show-event-info', showInfo);
    window.addEventListener('ui:show-export-options', showOpts);
    return () => {
      window.removeEventListener('ui:show-event-info', showInfo);
      window.removeEventListener('ui:show-export-options', showOpts);
    };
  }, []);
  // Favor UI-aware padding so fitBounds/cameraForBounds doesn't tuck the focus under the left sidebar
  const focusPadding = { top: 20, right: responsive.isCompact ? 80 : 20, bottom: 20, left: isLeftSidebarOpen ? 360 : 20 };
  const permitAreas = usePermitAreas(map, mapLoaded, { mode: geographyType, focusPadding });
  const drawTools = useDrawTools(map, permitAreas.focusedArea);

  // Force draw initialization once the platform is ready
  useEffect(() => {
    if (!map || !mapLoaded) return;
    if (!drawTools.forceReinitialize) return;
    drawTools.forceReinitialize();
  }, [map, mapLoaded, drawTools.forceReinitialize]);

  // Track if we've loaded at least once to enable transitions
  useEffect(() => {
    if (permitAreas.isLoading) {
      setHasLoadedOnce(true);
    }
  }, [permitAreas.isLoading]);

  // Live refs to avoid stale-closure reads inside async import helpers
  const focusedAreaRefLive = useRef(null);
  useEffect(() => { focusedAreaRefLive.current = permitAreas.focusedArea; }, [permitAreas.focusedArea]);
  const permitAreasListRef = useRef([]);
  useEffect(() => { permitAreasListRef.current = Array.isArray(permitAreas.permitAreas) ? permitAreas.permitAreas : []; }, [permitAreas.permitAreas]);
  const infrastructure = useInfrastructure(map, permitAreas.focusedArea, layers, setLayers, { rehydratingImport: isImportingPlan });
  const clickToPlace = useClickToPlace(map);
  const { isSitePlanMode, updateSitePlanMode } = useSitePlan();
  // Future: const dprMode = useDprMode(map, permitAreas.mode, drawTools);

  // DPR-specific event staging logic

  useEffect(() => {
    setLayers(prev => ({
      ...prev,
      permitAreas: {
        ...prev.permitAreas,
        loading: permitAreas.isLoading
      }
    }));
  }, [permitAreas.isLoading]);

  // Enter/exit siteplan design mode when a custom zone is generated/reset from intersections
  useEffect(() => {
    if (!map) return;
    const handler = (e) => {
      const feature = e?.detail?.feature;
      if (!feature || !feature.geometry) return;
      // Treat as focused area (like park/plaza) to unlock design tools
      try { permitAreas.focusOnPermitArea(feature); } catch(_) {}
      try { updateSitePlanMode(feature, Math.max(18, map.getZoom ? map.getZoom() : 18)); } catch(_) {}
    };
    const resetHandler = () => {
      try { permitAreas.clearFocus(); } catch(_) {}
    };
    window.addEventListener('zonecreator:focus', handler);
    window.addEventListener('zonecreator:reset', resetHandler);
    return () => {
      window.removeEventListener('zonecreator:focus', handler);
      window.removeEventListener('zonecreator:reset', resetHandler);
    };
  }, [map, permitAreas]);

  const prevFocusedAreaRef = useRef(null);
  const clearObjectsOnFocusChange = useCallback(() => {
    const currentFocusedArea = permitAreas.focusedArea;
    if (prevFocusedAreaRef.current !== currentFocusedArea) {
      prevFocusedAreaRef.current = currentFocusedArea;
      if (!currentFocusedArea) {
        // Clear both dropped objects and custom shapes when focus is cleared
        clickToPlace.clearDroppedObjects();
        drawTools.clearCustomShapes();
      }
    }
  }, [permitAreas.focusedArea, clickToPlace.clearDroppedObjects, drawTools.clearCustomShapes]);

  useEffect(() => {
    clearObjectsOnFocusChange();
  }, [clearObjectsOnFocusChange]);

  // Trigger shake animation
  const triggerShake = useCallback(() => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  }, []);

  // Update site plan mode on camera changes (no snapbacks; constraints are applied in the focus hook)
  useEffect(() => {
    if (!map) return;
    const handleCamera = () => {
      const zoom = map.getZoom();
      updateSitePlanMode(permitAreas.focusedArea, zoom);
    };
    // Initialize
    try { handleCamera(); } catch (_) {}
    map.on('zoom', handleCamera);
    map.on('moveend', handleCamera);
    return () => {
      map.off('zoom', handleCamera);
      map.off('moveend', handleCamera);
    };
  }, [map, permitAreas.focusedArea, updateSitePlanMode]);

  const handleExport = () => {
    exportPlan(
      map, 
      drawTools.draw, 
      clickToPlace.droppedObjects, 
      layers, 
      drawTools.draw?.current ? drawTools.draw.current.getAll().features : [],
      {
        geographyType,
        focusedArea: permitAreas.focusedArea,
        eventInfo,
        subFocusArea: permitAreas.hasSubFocus ? permitAreas.subFocusArea : null
      }
    );
  };

  const handleImport = (e) => {
    importPlan(
      e, 
      map, 
      drawTools.draw, 
      null, // No longer need setCustomShapes
      clickToPlace.setDroppedObjects,
      setLayers,
      {
        // Import orchestration helpers
        setRehydratingImport: (v) => { try { rehydratingImportRef.current = !!v; setIsImportingPlan(!!v); } catch (_) {} },
        setImportProgress: (step, message = '') => {
          try { setImportProgress(prev => ({ open: true, step: step || prev.step, message })); } catch (_) {}
        },
        closeImportProgress: () => { try { setImportProgress(prev => ({ ...prev, open: false })); } catch (_) {} },
        wipeSlate: () => {
          try { permitAreas.clearFocus(); } catch (_) {}
          try { infrastructure.clearFocus(); } catch (_) {}
          try { clickToPlace.clearDroppedObjects(); } catch (_) {}
          try { drawTools.clearCustomShapes(); } catch (_) {}
          try {
            setLayers(prev => ({
              ...INITIAL_LAYERS,
              permitAreas: { ...prev.permitAreas }
            }));
          } catch (_) {}
        },
        selectGeography: (type) => {
          try { if (type && type !== geographyType) selectGeography(type); } catch (_) {}
        },
        focusAreaByIdentity: ({ type, system, id }) => new Promise((resolve) => {
          let attempts = 0;
          const maxAttempts = 30; // ~6s at 200ms intervals
          const sysStr = (system !== undefined && system !== null) ? String(system) : null;
          const idStr = (id !== undefined && id !== null) ? String(id) : null;
          const started = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          const tryFocus = () => {
            attempts += 1;
            try {
              // Periodically surface progress to the import modal
              if (attempts === 1 || attempts % 5 === 0) {
                try {
                  const elapsedMs = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - started;
                  const secs = Math.max(0, Math.round(elapsedMs / 1000));
                  setImportProgress(prev => ({ open: true, step: 'focus', message: `Locating area by identity… attempt ${attempts}/${maxAttempts} (${secs}s)` }));
                } catch (_) {}
              }
              const list = permitAreasListRef.current || [];
              let found = null;
              if (type === 'parks' && sysStr != null) {
                found = list.find(f => String(f?.properties?.system) === sysStr);
              } else if (idStr != null) {
                found = list.find(f => String(f?.id) === idStr);
              }
              if (found) {
                try { permitAreas.focusOnPermitArea(found); } catch (_) {}
                try {
                  const elapsedMs = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - started;
                  const secs = Math.max(0, Math.round(elapsedMs / 1000));
                  setImportProgress(prev => ({ open: true, step: 'focus', message: `Focused by identity in ${secs}s` }));
                } catch (_) {}
                resolve(true);
                return;
              }
            } catch (_) {}
            if (attempts < maxAttempts) setTimeout(tryFocus, 200); else resolve(false);
          };
          tryFocus();
        }),
        focusAreaByGeometry: (geometry, name) => new Promise((resolve) => {
          try {
            if (!geometry) { resolve(false); return; }
            const feature = { type: 'Feature', properties: { name: name || 'Imported Area' }, geometry };
            // Surface that we're falling back to geometry-based focus
            try { setImportProgress(prev => ({ open: true, step: 'focus', message: 'Falling back to geometry-based focus…' })); } catch (_) {}
            permitAreas.focusOnPermitArea(feature);
            // Wait until focus is reflected in state
            let attempts = 0; const maxAttempts = 25;
            const started = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            const poll = () => {
              attempts += 1;
              try {
                if (attempts === 1 || attempts % 5 === 0) {
                  const elapsedMs = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - started;
                  const secs = Math.max(0, Math.round(elapsedMs / 1000));
                  setImportProgress(prev => ({ open: true, step: 'focus', message: `Waiting for focus state… attempt ${attempts}/${maxAttempts} (${secs}s)` }));
                }
              } catch (_) {}
              try { if (focusedAreaRefLive.current) { resolve(true); return; } } catch (_) {}
              if (attempts < maxAttempts) setTimeout(poll, 100); else resolve(false);
            };
            poll();
          } catch (_) { resolve(false); }
        }),
        waitForFocus: (match) => new Promise((resolve) => {
          let attempts = 0; const maxAttempts = 50;
          const sysStr = match && match.system != null ? String(match.system) : null;
          const idStr = match && match.id != null ? String(match.id) : null;
          const started = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          // First, check if already focused
          try {
            const fa0 = focusedAreaRefLive.current;
            if (fa0 && (!sysStr && !idStr || (sysStr && String(fa0?.properties?.system) === sysStr) || (idStr && String(fa0?.id) === idStr))) {
              resolve(true);
              return;
            }
          } catch (_) {}
          // Prefer event-based resolution over polling when possible
          const onReady = (e) => {
            try {
              const fa = focusedAreaRefLive.current;
              if (fa && (!sysStr && !idStr || (sysStr && String(fa?.properties?.system) === sysStr) || (idStr && String(fa?.id) === idStr))) {
                try { window.removeEventListener('permit:focus-ready', onReady); } catch (_) {}
                try {
                  const elapsedMs = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - started;
                  const secs = Math.max(0, Math.round(elapsedMs / 1000));
                  setImportProgress(prev => ({ open: true, step: 'focus', message: `Focus settled in ${secs}s` }));
                } catch (_) {}
                resolve(true);
              }
            } catch (_) {}
          };
          try { if (typeof window !== 'undefined') window.addEventListener('permit:focus-ready', onReady); } catch (_) {}
          const poll = () => {
            attempts += 1;
            try {
              if (attempts === 1 || attempts % 5 === 0) {
                const elapsedMs = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - started;
                const secs = Math.max(0, Math.round(elapsedMs / 1000));
                setImportProgress(prev => ({ open: true, step: 'focus', message: `Waiting for focused area to settle… attempt ${attempts}/${maxAttempts} (${secs}s)` }));
              }
              const fa = focusedAreaRefLive.current;
              if (fa && (!sysStr && !idStr || (sysStr && String(fa?.properties?.system) === sysStr) || (idStr && String(fa?.id) === idStr))) {
                try {
                  const elapsedMs = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - started;
                  const secs = Math.max(0, Math.round(elapsedMs / 1000));
                  setImportProgress(prev => ({ open: true, step: 'focus', message: `Focus settled in ${secs}s` }));
                } catch (_) {}
                try { if (typeof window !== 'undefined') window.removeEventListener('permit:focus-ready', onReady); } catch (_) {}
                resolve(true);
                return;
              }
            } catch (_) {}
            if (attempts < maxAttempts) setTimeout(poll, 200); else resolve(false);
          };
          poll();
        }),
        waitForPermitAreasLoaded: () => new Promise((resolve) => {
          let attempts = 0; const maxAttempts = 100; // up to ~20s
          const started = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          const poll = () => {
            attempts += 1;
            try {
              if (attempts === 1 || attempts % 10 === 0) {
                const elapsedMs = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - started;
                const secs = Math.max(0, Math.round(elapsedMs / 1000));
                const list = permitAreasListRef.current || [];
                const count = Array.isArray(list) ? list.length : 0;
                setImportProgress(prev => ({ open: true, step: 'focus', message: `Loading permit areas dataset… ${count} loaded (${secs}s)` }));
              }
            } catch (_) {}
            try {
              const list = permitAreasListRef.current || [];
              if (Array.isArray(list) && list.length > 0) { resolve(true); return; }
              // Kick off loading proactively if not already loading
              try {
                if (permitAreas && typeof permitAreas.loadPermitAreas === 'function') {
                  permitAreas.loadPermitAreas();
                }
              } catch (_) {}
            } catch (_) {}
            if (attempts < maxAttempts) setTimeout(poll, 200); else resolve(false);
          };
          poll();
        }),
        focusAreaFromGeometryCanonical: (geometry, name) => new Promise((resolve) => {
          try {
            const list = permitAreas.permitAreas || [];
            if (!geometry || !Array.isArray(list) || list.length === 0) { resolve(false); return; }
            const target = { type: 'Feature', properties: {}, geometry };
            const targetCentroid = (() => { try { return turfCentroid(target); } catch (_) { return null; } })();
            const exportedName = (typeof name === 'string' && name.trim()) ? name.trim() : null;
            // 1) Exact name match first, if available (normalized in loader)
            if (exportedName) {
              const matches = list.filter(f => (f?.properties?.name || '').toString().trim() === exportedName);
              if (matches.length === 1) {
                try { permitAreas.focusOnPermitArea(matches[0]); } catch (_) {}
                resolve(true);
                return;
              }
              if (matches.length > 1 && targetCentroid) {
                const found = matches.find(f => { try { return turfBooleanPointInPolygon(targetCentroid, f); } catch (_) { return false; } });
                if (found) {
                  try { permitAreas.focusOnPermitArea(found); } catch (_) {}
                  resolve(true);
                  return;
                }
              }
            }
            // 2) Centroid containment heuristic
            if (targetCentroid) {
              const found = list.find(f => { try { return turfBooleanPointInPolygon(targetCentroid, f); } catch (_) { return false; } });
              if (found) {
                try { permitAreas.focusOnPermitArea(found); } catch (_) {}
                resolve(true);
                return;
              }
            }
            // 3) Give up (fall back to geometry focus upstream)
            resolve(false);
          } catch (_) { resolve(false); }
        }),
        applySubFocus: (geometry) => {
          try { return permitAreas.setSubFocusPolygon({ type: 'Feature', properties: {}, geometry }); } catch (_) { return false; }
        },
        applySubFocusAsync: (geometry) => new Promise((resolve) => {
          let attempts = 0; const maxAttempts = 50;
          const tryApply = () => {
            attempts += 1;
            let ok = false;
            try { ok = permitAreas.setSubFocusPolygon({ type: 'Feature', properties: {}, geometry }); } catch (_) { ok = false; }
            if (ok) resolve(true);
            else if (attempts < maxAttempts) setTimeout(tryApply, 200);
            else resolve(false);
          };
          tryApply();
        }),
        onMoveEndOnce: (cb) => { try { map && map.once && map.once('moveend', cb); } catch (_) {} },
        reloadVisibleInfra: () => { try { infrastructure.reloadVisibleLayers && infrastructure.reloadVisibleLayers(); } catch (_) {} },
        setEventInfo: (info) => setEventInfo(info || {}),
        ensureMinZoom: (minZoom = 14) => { try { const z = map && map.getZoom ? map.getZoom() : 0; if (z < minZoom && map && map.easeTo) map.easeTo({ zoom: minZoom, duration: 400 }); } catch (_) {} }
      }
    );
    // Force immediate annotation recompute after import
    try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('annotations:changed')); } catch (_) {}
  };

  const handleExportSiteplan = (format) => {
    exportPermitAreaSiteplanV2(
      map,
      permitAreas.focusedArea,
      layers,
      drawTools.draw?.current ? drawTools.draw.current.getAll().features : [],
      clickToPlace.droppedObjects,
      format,
      infrastructure?.infrastructureData || null,
      { ...exportOptions, subFocusArea: permitAreas.hasSubFocus ? permitAreas.subFocusArea : null, noLegend: !!exportOptions.noLegend },
      eventInfo
    );
  };

  const handleClearFocus = () => {
    permitAreas.clearFocus();
    infrastructure.clearFocus();
    // Also reset zone creator if active
    try {
      const evt = new CustomEvent('zonecreator:reset');
      window.dispatchEvent(evt);
    } catch (_) {}
  };

  const handleToggleLayer = useCallback((layerId) => {
    if (layerId === 'permitAreas') {
      setLayers(prev => {
        const willBeVisible = !prev[layerId].visible;
        // Toggle visibility for the ACTIVE geography idPrefix
        if (map) {
          const cfg = GEOGRAPHIES[geographyType];
          if (cfg) {
            ensureGeoBaseLayers(map, cfg.idPrefix, cfg.type);
            setGeoBaseVisibility(map, cfg.idPrefix, cfg.type, willBeVisible);
            // Ensure focused selection remains visible when hiding base layers
            try {
              if (!willBeVisible && permitAreas.focusedArea) {
                if (cfg.type === 'polygon') {
                  if (map.getLayer(`${cfg.idPrefix}-focused-fill`)) {
                    map.setLayoutProperty(`${cfg.idPrefix}-focused-fill`, 'visibility', 'visible');
                  }
                  if (map.getLayer(`${cfg.idPrefix}-focused-outline`)) {
                    map.setLayoutProperty(`${cfg.idPrefix}-focused-outline`, 'visibility', 'visible');
                  }
                } else if (cfg.type === 'point') {
                  if (map.getLayer(`${cfg.idPrefix}-focused-points`)) {
                    map.setLayoutProperty(`${cfg.idPrefix}-focused-points`, 'visibility', 'visible');
                  }
                }
              }
            } catch (_) {}
          }
        }
        return {
          ...prev,
          [layerId]: { ...prev[layerId], visible: willBeVisible }
        };
      });
    } else {
      infrastructure.toggleLayer(layerId);
    }
  }, [map, infrastructure, geographyType]);

  // When the focusedArea changes, reset infrastructure layer states in the sidebar
  // Skip during rehydrating imports to preserve saved toggles
  useEffect(() => {
    if (rehydratingImportRef.current) return;
    setLayers(prev => {
      const newLayers = { ...prev };
      Object.keys(newLayers).forEach(layerId => {
        if (layerId !== 'permitAreas') {
          newLayers[layerId] = {
            ...newLayers[layerId],
            visible: false,
            loaded: false,
            loading: false,
            error: null
          };
        }
      });
      return newLayers;
    });
  }, [permitAreas.focusedArea?.id]);

  // Load selected geography dataset whenever map/geography are ready
  useEffect(() => {
    if (!map || !permitAreas.loadPermitAreas) return;
    if (!mapLoaded || !isGeographyChosen) return;
    // Delay slightly to ensure previous listeners are cleaned before rebind under new mode
    const t = setTimeout(() => {
      permitAreas.loadPermitAreas();
    }, 100);
    return () => clearTimeout(t);
  }, [map, mapLoaded, isGeographyChosen, geographyType, permitAreas.loadPermitAreas]);

  // When geography changes via compact selector, clear current work
  const prevGeoRef = useRef(geographyType);
  useEffect(() => {
    if (prevGeoRef.current !== geographyType && isGeographyChosen) {
      permitAreas.clearFocus();
      clickToPlace.clearDroppedObjects();
      drawTools.clearCustomShapes();
      // Reset sidebar layer states
      setLayers(prev => {
        const newLayers = { ...prev };
        Object.keys(newLayers).forEach(layerId => {
          if (layerId !== 'permitAreas') {
            newLayers[layerId] = { ...newLayers[layerId], visible: false, loaded: false, loading: false, error: null };
          }
        });
        return newLayers;
      });
      prevGeoRef.current = geographyType;
    }
  }, [geographyType, isGeographyChosen, permitAreas, clickToPlace, drawTools]);

  // Compute a warning if the focused (or sub-focused) area is too large for 11x17 at sufficient granularity
  useEffect(() => {
    try {
      const area = permitAreas.hasSubFocus ? permitAreas.subFocusArea : permitAreas.focusedArea;
      if (!area || !area.geometry) { setAreaWarning(null); return; }
      // 11x17 landscape mm
      const page = { wMm: 431.8, hMm: 279.4 };
      const legendFraction = exportOptions.noLegend ? 0 : 0.25;
      const paddingMm = 6;
      const mapWmm = page.wMm * (1 - legendFraction) - 2 * paddingMm;
      const mapHmm = page.hMm - 2 * paddingMm;
      // Axis-aligned bbox
      const bounds = (() => {
        const g = area.geometry;
        const collect = (coords, acc) => {
          coords.forEach((c) => { acc.minLng = Math.min(acc.minLng, c[0]); acc.maxLng = Math.max(acc.maxLng, c[0]); acc.minLat = Math.min(acc.minLat, c[1]); acc.maxLat = Math.max(acc.maxLat, c[1]); });
        };
        const acc = { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity };
        if (g.type === 'Polygon') collect(g.coordinates[0], acc);
        else if (g.type === 'MultiPolygon') g.coordinates.forEach(poly => collect(poly[0], acc));
        if (!isFinite(acc.minLng) || !isFinite(acc.minLat)) return null;
        return [[acc.minLng, acc.minLat],[acc.maxLng, acc.maxLat]];
      })();
      if (!bounds) { setAreaWarning(null); return; }
      const minLng = bounds[0][0], minLat = bounds[0][1], maxLng = bounds[1][0], maxLat = bounds[1][1];
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;
      const widthMeters = turfDistance([minLng, centerLat], [maxLng, centerLat], { units: 'meters' });
      const heightMeters = turfDistance([centerLng, minLat], [centerLng, maxLat], { units: 'meters' });
      const metersPerMm = Math.max(widthMeters / Math.max(1, mapWmm), heightMeters / Math.max(1, mapHmm));
      const warn = (() => {
        if (metersPerMm <= 2.0) return null;
        if (metersPerMm <= 3.5) return { level: 'caution', metersPerMm };
        return { level: 'severe', metersPerMm };
      })();
      setAreaWarning(warn);
    } catch (_) {
      setAreaWarning(null);
    }
  }, [permitAreas.focusedArea, permitAreas.hasSubFocus, permitAreas.subFocusArea, exportOptions.noLegend]);

  // Handle basemap style changes with proper timing
  const handleStyleChange = useCallback((evt = { type: 'style' }) => {
    console.log('Basemap style changed, waiting for style to fully load before re-initializing layers...');
    
    if (!map) return;

    const reinitializeLayers = () => {
      console.log('Style fully loaded, now re-initializing layers...');
      
      // Wait for the map to be completely ready
      const waitForMapReady = () => {
        if (!map.loaded() || !map.isStyleLoaded()) {
          setTimeout(waitForMapReady, 50);
          return;
        }
        
        // Only re-init on true style changes, not overlay toggles
        if (evt.type === 'style') {
          if (permitAreas.rehydrateActiveGeography) {
            permitAreas.rehydrateActiveGeography();
          } else if (permitAreas.loadPermitAreas) {
            permitAreas.loadPermitAreas();
          }
        }
        
        // Re-initialize infrastructure layers if there's a focused area
        if (permitAreas.focusedArea && infrastructure.reloadVisibleLayers) {
          // Reload any visible infra layers for the current area
          infrastructure.reloadVisibleLayers();
        }

        // If the focused area is a Zone Creator preview, re-add its overlay layers lost on style changes
        try {
          const fa = permitAreas.focusedArea;
          if (fa && (fa.id === 'zonecreator-preview' || fa.properties?.__zoneCreator === true) && fa.geometry) {
            try { if (map.getLayer('zone-creator-preview')) map.removeLayer('zone-creator-preview'); } catch (_) {}
            try { if (map.getLayer('zone-creator-path')) map.removeLayer('zone-creator-path'); } catch (_) {}
            try { if (map.getSource('zone-creator')) map.removeSource('zone-creator'); } catch (_) {}
            map.addSource('zone-creator', { type: 'geojson', data: { type: 'Feature', geometry: fa.geometry, properties: {} } });
            // Keep zone creator layers above active geography focused layers; insert before draw layers if present
            let beforeId;
            try {
              const style = map.getStyle ? map.getStyle() : null;
              const drawLayer = style && Array.isArray(style.layers)
                ? style.layers.find(l => typeof l.id === 'string' && (l.id.startsWith('mapbox-gl-draw') || l.id.startsWith('gl-draw')))
                : null;
              beforeId = drawLayer ? drawLayer.id : undefined;
            } catch (_) {}
            map.addLayer({ id: 'zone-creator-preview', type: 'fill', source: 'zone-creator', paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.2 } }, beforeId);
            map.addLayer({ id: 'zone-creator-path', type: 'line', source: 'zone-creator', paint: { 'line-color': '#2563eb', 'line-width': 3 } }, beforeId);
            // Hide intersections points layer again while previewing the zone (intersections mode)
            try { if (map.getLayer('intersections-points')) map.setLayoutProperty('intersections-points', 'visibility', 'none'); } catch (_) {}
          }
        } catch (_) {}
        
        // Draw controls now handle style changes internally; no external reinit needed
      };
      
      // Add a delay to ensure style is fully processed
      setTimeout(waitForMapReady, 200);
    };

    // Only wait for style.load event if this was a style change
    if (evt.type === 'style') {
      const styleLoadHandler = () => {
        console.log('Style load event received, scheduling layer reinitialization');
        setTimeout(reinitializeLayers, 150);
      };
      map.off('style.load', styleLoadHandler);
      map.once('style.load', styleLoadHandler);
      if (map.isStyleLoaded()) {
        setTimeout(() => {
          console.log('Backup timeout triggered for style change');
          reinitializeLayers();
        }, 2000);
      }
    } else {
      // For overlay, reinitialize immediately with a small delay
      setTimeout(reinitializeLayers, 150);
    }
  }, [map, permitAreas, layers, infrastructure, drawTools.forceReinitialize]);

  // Sync Carto basemap with dark mode, but do NOT disturb satellite overlay or ArcGIS if active
  useEffect(() => {
    if (!map) return;
    try {
      // If satellite overlay is active, preserve it and skip theme-driven base style switches
      if (typeof map.getLayer === 'function' && map.getLayer('nyc-satellite-layer')) {
        return;
      }

      // If current basemap is NOT carto, don't force a switch
      if (map.__currentBasemap !== 'carto') {
        return;
      }

      // Only adjust Carto style if it differs from the desired theme
      const desiredUrl = isDarkMode ? BASEMAP_OPTIONS.carto.darkUrl : BASEMAP_OPTIONS.carto.url;
      const currentUrl = map.__currentCartoStyleUrl || '';
      if (currentUrl === desiredUrl) return;

      const desiredKey = isDarkMode ? 'carto-dark' : 'carto-light';
      switchBasemap(map, desiredKey, handleStyleChange).catch(() => {});
    } catch (_) {}
  }, [map, isDarkMode, handleStyleChange]);

  // Map rotation handling centralized in MapContainer via useCameraRotation

  // Contextual nudges (evaluated only when prerequisites are visible)
  const customShapes = drawTools.draw?.current ? drawTools.draw.current.getAll().features : [];
  // Detect label changes to trigger text-rule scans only when needed
  useEffect(() => {
    try {
      const sig = (customShapes || [])
        .map(f => `${f.id || ''}:${(f.properties?.label || '').toLowerCase()}`)
        .sort()
        .join('|');
      if (sig !== labelSigRef.current) {
        labelSigRef.current = sig;
        setLabelScanFlag(true);
        const t = setTimeout(() => setLabelScanFlag(false), 400); // keep true through debounce window
        return () => clearTimeout(t);
      }
    } catch (_) {}
  }, [customShapes]);
  const { nudges, dismiss: dismissNudge, zoomTo: zoomToNudge, highlight: highlightNudge, highlightedIds } = useNudges({
    map,
    droppedObjects: clickToPlace.droppedObjects,
    customShapes,
    infrastructureData: infrastructure?.infrastructureData || {},
    layers,
    labelScan: labelScanFlag
  });

  // Top-level hidden file input to drive header import button
  const headerFileInputRef = React.useRef(null);

  const triggerHeaderImport = useCallback(() => {
    if (headerFileInputRef.current) headerFileInputRef.current.click();
  }, []);

  const openExampleInEditor = useCallback(async (example) => {
    try {
      if (!example?.json) return;
      const res = await fetch(example.json);
      const blob = await res.blob();
      const file = new File([blob], `${example.slug}.json`, { type: 'application/json' });
      // Reuse existing import flow
      importPlan(
        file,
        map,
        drawTools.draw,
        null,
        clickToPlace.setDroppedObjects,
        setLayers,
        {
          selectGeography: (type) => {
            try { if (type && type !== geographyType) selectGeography(type); } catch (_) {}
          },
          setImportProgress: (step, message = '') => {
            try { setImportProgress(prev => ({ open: true, step: step || prev.step, message })); } catch (_) {}
          },
          closeImportProgress: () => { try { setImportProgress(prev => ({ ...prev, open: false })); } catch (_) {} },
          reloadVisibleInfra: () => { try { infrastructure.reloadVisibleLayers && infrastructure.reloadVisibleLayers(); } catch (_) {} },
          focusAreaByIdentity: ({ type, system, id }) => {
            let attempts = 0;
            const maxAttempts = 25;
            const tryFocus = () => {
              attempts += 1;
              try {
                const list = permitAreas.permitAreas || [];
                let found = null;
                if (type === 'parks' && system) {
                  found = list.find(f => f?.properties?.system === system);
                } else if (id !== undefined && id !== null) {
                  found = list.find(f => f?.id === id);
                }
                if (found) {
                  try { permitAreas.focusOnPermitArea(found); } catch (_) {}
                  return;
                }
              } catch (_) {}
              if (attempts < maxAttempts) setTimeout(tryFocus, 200);
            };
            tryFocus();
          }
        }
      );
      setShowExamples(false);
    } catch (_) {}
  }, [map, drawTools.draw, clickToPlace.setDroppedObjects, setLayers, selectGeography, geographyType, permitAreas]);

  return (
    <div className={`h-screen w-full flex flex-col bg-gray-50 dark:bg-gray-900 dark:text-gray-100 ${isShaking ? 'shake-animation' : ''}`}>
      {/* Hidden input paired to header import button */}
      <input
        ref={headerFileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          handleImport(e);
          if (headerFileInputRef.current) headerFileInputRef.current.value = '';
        }}
      />

      <Header 
        showInfo={showInfo}
        setShowInfo={setShowInfo}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        onImportClick={triggerHeaderImport}
        onShowExamples={() => setShowExamples(true)}
      />
      
      {/* Tutorial Components */}
      <WelcomeOverlay />
      <TutorialTooltip />
      
      {showInfo && <InfoPanel showInfo={showInfo} onClose={() => setShowInfo(false)} />}
      <EventInfoModal isOpen={showEventInfo} onClose={() => setShowEventInfo(false)} value={eventInfo} onChange={setEventInfo} />
      <ExportOptionsModal isOpen={showExportOptions} onClose={() => setShowExportOptions(false)} value={exportOptions} onChange={setExportOptions} />
      

      {hasLoadedOnce && (
        <div className={`bg-blue-100 border-l-4 border-blue-500 text-blue-700 mx-4 ${permitAreas.isLoading ? 'mt-2 py-3 max-h-20 opacity-100' : 'mt-0 py-0 max-h-0 opacity-0'} transition-all duration-500 overflow-hidden`}>
          <div className="flex items-center pl-4">
            {permitAreas.isLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
            )}
            Loading zone geometry...
          </div>
        </div>
      )}
      
      {permitAreas.loadError && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 mx-4 mt-2">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            Error loading zone geometry: {permitAreas.loadError}
          </div>
        </div>
      )}
      
      {permitAreas.focusedArea && permitAreas.showFocusInfo && (
        <FocusInfoPanel 
          focusedArea={permitAreas.focusedArea}
          showFocusInfo={true}
          hasSubFocus={permitAreas.hasSubFocus}
          onBeginSubFocus={() => {
            try { drawTools.activateDrawingTool('subfocus'); } catch (_) {}
          }}
          onClearSubFocus={() => {
            try { permitAreas.clearSubFocusPolygon(); } catch (_) {}
          }}
          onClose={() => permitAreas.setShowFocusInfo(false)}
        />
      )}

      {/* Zoom boundary warning when user tries to zoom out past focus boundary */}
      <ZoomBoundaryNudge
        isOpen={permitAreas.showZoomBoundaryWarning}
        onContinue={permitAreas.handleZoomBoundaryConfirm}
        onCancel={permitAreas.handleZoomBoundaryCancel}
      />

      <ExamplesModal
        isOpen={showExamples}
        onClose={() => setShowExamples(false)}
        onOpenInEditor={openExampleInEditor}
      />

      {/* Import progress modal */}
      <ImportProgressModal
        isOpen={importProgress.open}
        currentStepKey={importProgress.step}
        message={importProgress.message}
        onCancel={() => {
          // Soft-cancel: hide modal; actual file import cannot be aborted here
          try { setImportProgress({ open: false, step: 'finalize', message: '' }); } catch (_) {}
        }}
      />

      
      <div className="flex flex-1 overflow-hidden">
        {isLeftSidebarOpen ? (
          <Sidebar 
            layers={layers}
            focusedArea={permitAreas.focusedArea}
            onClearFocus={handleClearFocus}
            onToggleLayer={handleToggleLayer}
            permitAreas={permitAreas}
            infrastructure={infrastructure}
            map={map}
            onStyleChange={handleStyleChange}
            isSitePlanMode={isSitePlanMode}
            geographyType={geographyType}
            onCollapse={() => setIsLeftSidebarOpen(false)}
            drawTools={drawTools}
          />
        ) : (
          // Vertical tab/handle to reopen left sidebar (fixed at top-left)
          <button
            type="button"
            onClick={() => setIsLeftSidebarOpen(true)}
            aria-label="Expand sidebar"
            title="Show sidebar"
            className="fixed left-0 top-40 z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-r px-1 py-3 shadow hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <ChevronRight className="w-4 h-4 text-gray-700 dark:text-gray-200" />
          </button>
        )}

        <DroppedObjectsProvider>
          <MapContainer 
            ref={mapContainerRef}
            map={map}
            mapLoaded={mapLoaded}
            styleLoaded={styleLoaded}
            focusedArea={permitAreas.focusedArea}
            drawTools={drawTools}
            clickToPlace={clickToPlace}
            permitAreas={permitAreas}
            infrastructure={infrastructure}
            placeableObjects={PLACEABLE_OBJECTS}
            nudges={nudges}
            highlightedIds={highlightedIds}
            onDismissNudge={dismissNudge}
            responsive={responsive}
            isSitePlanMode={isSitePlanMode}
            isRightSidebarOpen={responsive.sidebarMode !== 'icon-rail' || isRightDrawerOpen}
            exportOptions={exportOptions}
          />

          {/* Center-bottom contextual nudges */}
          <NudgeCenter
            nudges={nudges}
            onZoom={zoomToNudge}
            onHighlight={highlightNudge}
            onDismiss={dismissNudge}
          />

          {/* Right Sidebar for Site Plan Mode */}
          {isSitePlanMode && (
            <RightSidebar
              mode={responsive.sidebarMode}
              isOpen={responsive.sidebarMode !== 'icon-rail' || isRightDrawerOpen}
              onClose={() => setIsRightDrawerOpen(false)}
              onToggle={() => setIsRightDrawerOpen((v) => !v)}
              drawTools={drawTools}
              clickToPlace={clickToPlace}
              placeableObjects={PLACEABLE_OBJECTS}
              onExport={handleExport}
              onImport={handleImport}
              onExportSiteplan={handleExportSiteplan}
              focusedArea={permitAreas.focusedArea}
            />
          )}
        </DroppedObjectsProvider>
      </div>
      <GeographySelector
        isOpen={showGeoSelectorOverride || (!isTutorialActive && !showWelcome && !isGeographyChosen)}
        onContinue={(type) => {
          // Clear any existing work just in case and set geography
          permitAreas.clearFocus();
          clickToPlace.clearDroppedObjects();
          drawTools.clearCustomShapes();
          selectGeography(type);
          setShowGeoSelectorOverride(false);
        }}
      />
    </div>
  );
};

export default SpaceStager; 