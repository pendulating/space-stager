import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Header from './Header/Header';
import Sidebar from './Sidebar/Sidebar';
import MapContainer from './Map/MapContainer';
import InfoPanel from './Modals/InfoPanel';
import FocusInfoPanel from './Modals/FocusInfoPanel';
import WelcomeOverlay from './Tutorial/WelcomeOverlay';
import TutorialTooltip from './Tutorial/TutorialTooltip';
import RightSidebar from './Sidebar/RightSidebar';
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
import { exportPlan, importPlan, exportPermitAreaSiteplanV2 } from '../utils/exportUtils';
import { useNudges } from '../hooks/useNudges';
import { useGeography } from '../contexts/GeographyContext';
import { useTutorial } from '../contexts/TutorialContext';
import GeographySelector from './Modals/GeographySelector';
import EventInfoModal from './Modals/EventInfoModal';
import ExportOptionsModal from './Modals/ExportOptionsModal';
import '../styles/eventStager-dpr.css';
import '../styles/eventStager.css';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { switchBasemap } from '../utils/mapUtils';
import { distance as turfDistance } from '@turf/turf';

const SpaceStager = () => {
  const mapContainerRef = useRef(null);
  const { map, mapLoaded, styleLoaded } = useMap(mapContainerRef);
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const [showInfo, setShowInfo] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const labelSigRef = useRef('');
  const [labelScanFlag, setLabelScanFlag] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
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
  
  // Sync Carto basemap with dark mode (only when using Carto, not satellite overlay)
  useEffect(() => {
    if (!map) return;
    try {
      const desiredKey = isDarkMode ? 'carto-dark' : 'carto-light';
      switchBasemap(map, desiredKey, handleStyleChange).catch(() => {});
    } catch (_) {}
  }, [map, isDarkMode]);
  
  // Use custom hooks for different functionalities
  const { geographyType, isGeographyChosen, selectGeography } = useGeography();
  const { isTutorialActive, showWelcome } = useTutorial();
  // Allow forcing the geography selector modal open via a UI event
  const [showGeoSelectorOverride, setShowGeoSelectorOverride] = useState(false);
  const [showEventInfo, setShowEventInfo] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
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
  const focusPadding = { top: 20, right: 20, bottom: 20, left: isLeftSidebarOpen ? 360 : 20 };
  const permitAreas = usePermitAreas(map, mapLoaded, { mode: geographyType, focusPadding });
  const drawTools = useDrawTools(map, permitAreas.focusedArea);
  const infrastructure = useInfrastructure(map, permitAreas.focusedArea, layers, setLayers);
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
        eventInfo
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
        selectGeography: (type) => {
          try { if (type && type !== geographyType) selectGeography(type); } catch (_) {}
        },
        focusAreaByIdentity: ({ type, system, id }) => {
          let attempts = 0;
          const maxAttempts = 25; // ~5s at 200ms intervals
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
                return; // done
              }
            } catch (_) {}
            if (attempts < maxAttempts) setTimeout(tryFocus, 200);
          };
          tryFocus();
        }
      }
    );
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
  // (The actual clearing is handled by useInfrastructure hook to avoid race conditions)
  useEffect(() => {
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

  // Add keyboard controls for map rotation
  useEffect(() => {
    if (!map) return;

    const handleKeyDown = (e) => {
      // Only handle Q and E keys when not in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
        return;
      }

      const rotationAmount = 15; // degrees per key press
      
      if (e.key.toLowerCase() === 'q') {
        e.preventDefault();
        const currentBearing = map.getBearing();
        map.rotateTo(currentBearing - rotationAmount, { duration: 300 });
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        const currentBearing = map.getBearing();
        map.rotateTo(currentBearing + rotationAmount, { duration: 300 });
      }
    };

    // Add event listener to the document to capture all key events
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [map]);

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
      />
      
      {/* Tutorial Components */}
      <WelcomeOverlay />
      <TutorialTooltip />
      
      {showInfo && <InfoPanel showInfo={showInfo} onClose={() => setShowInfo(false)} />}
      <EventInfoModal isOpen={showEventInfo} onClose={() => setShowEventInfo(false)} value={eventInfo} onChange={setEventInfo} />
      <ExportOptionsModal isOpen={showExportOptions} onClose={() => setShowExportOptions(false)} value={exportOptions} onChange={setExportOptions} />
      

      {permitAreas.isLoading && (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-3 mx-4 mt-2">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
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
            try { drawTools.activateDrawingTool('polygon'); } catch (_) {}
          }}
          onClearSubFocus={() => {
            try { permitAreas.clearSubFocusPolygon(); } catch (_) {}
          }}
          onClose={() => permitAreas.setShowFocusInfo(false)}
        />
      )}

      {/* Site Plan Mode Indicator */}
      {isSitePlanMode && (
        <div className="bg-blue-100 dark:bg-blue-950/30 border-l-4 border-blue-500 dark:border-blue-900 text-blue-700 dark:text-blue-200 p-3 mx-4 mt-2 mb-3 rounded">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
            </svg>
            <span className="font-medium">Site Plan Mode Active</span>
            <span className="ml-2 text-sm opacity-90">Design tools available on the right</span>
          </div>
          {areaWarning && (
            <div className={`mt-2 text-xs rounded px-2 py-1 inline-flex items-center ${areaWarning.level === 'severe' ? 'bg-amber-200 text-amber-800' : 'bg-amber-100 text-amber-700'}`}>
              <span className="mr-2">⚠️</span>
              <span>
                Area may be too large for 11×17 at sufficient detail. Try “Focus sub-area” or enable “Entire zone PDF (no legend)”.
              </span>
            </div>
          )}
        </div>
      )}
      
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
        
        <MapContainer 
          ref={mapContainerRef}
          map={map}
          mapLoaded={mapLoaded}
          focusedArea={permitAreas.focusedArea}
          drawTools={drawTools}
          clickToPlace={clickToPlace}
          permitAreas={permitAreas}
          placeableObjects={PLACEABLE_OBJECTS}
          nudges={nudges}
          highlightedIds={highlightedIds}
          onDismissNudge={dismissNudge}
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
            drawTools={drawTools}
            clickToPlace={clickToPlace}
            placeableObjects={PLACEABLE_OBJECTS}
            onExport={handleExport}
            onImport={handleImport}
            onExportSiteplan={handleExportSiteplan}
            focusedArea={permitAreas.focusedArea}
          />
        )}
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