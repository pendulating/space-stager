import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import '../styles/eventStager-dpr.css';
import '../styles/eventStager.css';

const SpaceStager = () => {
  const mapContainerRef = useRef(null);
  const { map, mapLoaded, styleLoaded } = useMap(mapContainerRef);
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const [showInfo, setShowInfo] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const labelSigRef = useRef('');
  const [labelScanFlag, setLabelScanFlag] = useState(false);
  
  // Use custom hooks for different functionalities
  const { geographyType, isGeographyChosen, selectGeography } = useGeography();
  const { isTutorialActive, showWelcome } = useTutorial();
  const permitAreas = usePermitAreas(map, mapLoaded, { mode: geographyType });
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

  // Update site plan mode based on focused area and zoom
  useEffect(() => {
    if (map) {
      const currentZoom = map.getZoom();
      updateSitePlanMode(permitAreas.focusedArea, currentZoom);
      
      // Pan/zoom guardrails in Site Plan mode
      const focusAnchorRef = { current: null };
      const lastAllowedCenterRef = { current: null };
      const lastAllowedZoomRef = { current: null };
      const getAllowedRadiusPx = () => {
        const canvas = map.getCanvas();
        return Math.max(0, (canvas?.width || 0) * 0.5);
      };

      // Initialize or refresh anchor after animations complete
      const ensureAnchor = () => {
        if (!permitAreas.focusedArea || permitAreas.isCameraAnimating) return;
        if (!focusAnchorRef.current) {
          focusAnchorRef.current = map.getCenter();
          lastAllowedCenterRef.current = focusAnchorRef.current;
          lastAllowedZoomRef.current = map.getZoom();
        }
      };

      const handleCamera = () => {
        const zoom = map.getZoom();
        
        // Check zoom restrictions when a permit area is focused and camera animation is complete
        if (permitAreas.focusedArea && 
            permitAreas.minAllowedZoom !== null && 
            !permitAreas.isCameraAnimating && 
            zoom < permitAreas.minAllowedZoom) {
          console.log('Zoom restriction triggered:', {
            currentZoom: zoom,
            minAllowed: permitAreas.minAllowedZoom,
            initialZoom: permitAreas.initialFocusZoom,
            cameraAnimating: permitAreas.isCameraAnimating
          });
          
          // Prevent further zoom out WITHOUT changing camera center
          const prevCenter = lastAllowedCenterRef.current || map.getCenter();
          map.stop();
          map.jumpTo({
            center: prevCenter,
            zoom: permitAreas.minAllowedZoom,
            bearing: map.getBearing(),
            pitch: map.getPitch()
          });
          triggerShake();
          return; // avoid applying further adjustments in this frame
        }
        
        // Pan restriction: clamp map center within a radius of 50% viewport width from anchor
        if (permitAreas.focusedArea && !permitAreas.isCameraAnimating) {
          ensureAnchor();
          if (focusAnchorRef.current) {
            const anchor = focusAnchorRef.current;
            const nowCenter = map.getCenter();
            const anchorPx = map.project([anchor.lng, anchor.lat]);
            const nowPx = map.project([nowCenter.lng, nowCenter.lat]);
            const dx = nowPx.x - anchorPx.x;
            const dy = nowPx.y - anchorPx.y;
            const dist = Math.hypot(dx, dy);
            const allowed = getAllowedRadiusPx();
            if (dist > allowed) {
              const clampedX = anchorPx.x + (dx * (allowed / dist));
              const clampedY = anchorPx.y + (dy * (allowed / dist));
              const clampedLngLat = map.unproject([clampedX, clampedY]);
              map.stop();
              map.jumpTo({ center: clampedLngLat, zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() });
              triggerShake();
              // Update last allowed after correction
              lastAllowedCenterRef.current = clampedLngLat;
              lastAllowedZoomRef.current = map.getZoom();
              return;
            }
          }
        }

        // Update last allowed camera state
        lastAllowedCenterRef.current = map.getCenter();
        lastAllowedZoomRef.current = zoom;

        updateSitePlanMode(permitAreas.focusedArea, zoom);
      };
      
      map.on('zoom', handleCamera);
      map.on('move', handleCamera);
      map.on('resize', ensureAnchor);
      
      return () => {
        map.off('zoom', handleCamera);
        map.off('move', handleCamera);
        map.off('resize', ensureAnchor);
      };
    }
  }, [map, permitAreas.focusedArea, permitAreas.minAllowedZoom, permitAreas.initialFocusZoom, permitAreas.isCameraAnimating, updateSitePlanMode, triggerShake]);

  const handleExport = () => {
    exportPlan(
      map, 
      drawTools.draw, 
      clickToPlace.droppedObjects, 
      layers, 
      drawTools.draw?.current ? drawTools.draw.current.getAll().features : []
    );
  };

  const handleImport = (e) => {
    importPlan(
      e, 
      map, 
      drawTools.draw, 
      null, // No longer need setCustomShapes
      clickToPlace.setDroppedObjects,
      setLayers
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
      infrastructure?.infrastructureData || null
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
        
        // Re-initialize draw controls after layers are handled
        setTimeout(() => {
          if (drawTools.forceReinitialize) {
            drawTools.forceReinitialize();
          }
        }, 300);
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

  return (
    <div className={`h-screen w-full flex flex-col bg-gray-50 ${isShaking ? 'shake-animation' : ''}`}>
      <Header 
        showInfo={showInfo}
        setShowInfo={setShowInfo}
      />
      
      {/* Tutorial Components */}
      <WelcomeOverlay />
      <TutorialTooltip />
      
      {showInfo && <InfoPanel showInfo={showInfo} onClose={() => setShowInfo(false)} />}
      

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
          onClose={() => permitAreas.setShowFocusInfo(false)}
        />
      )}

      {/* Site Plan Mode Indicator */}
      {isSitePlanMode && (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-3 mx-4 mt-2">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
            </svg>
            <span className="font-medium">Site Plan Mode Active</span>
            <span className="ml-2 text-sm">Design tools available on the right</span>
          </div>
        </div>
      )}
      
      <div className="flex flex-1 overflow-hidden">
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
        />
        
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
            onExportSiteplan={handleExportSiteplan}
            focusedArea={permitAreas.focusedArea}
          />
        )}
      </div>
      <GeographySelector
        isOpen={!isTutorialActive && !showWelcome && !isGeographyChosen}
        onContinue={(type) => {
          // Clear any existing work just in case and set geography
          permitAreas.clearFocus();
          clickToPlace.clearDroppedObjects();
          drawTools.clearCustomShapes();
          selectGeography(type);
        }}
      />
    </div>
  );
};

export default SpaceStager; 