import React, { useState, useRef, useEffect, useCallback } from 'react';
import Header from './Header/Header';
import Sidebar from './Sidebar/Sidebar';
import MapContainer from './Map/MapContainer';
import InfoPanel from './Modals/InfoPanel';
import FocusInfoPanel from './Modals/FocusInfoPanel';
import WelcomeOverlay from './Tutorial/WelcomeOverlay';
import TutorialTooltip from './Tutorial/TutorialTooltip';
import RightSidebar from './Sidebar/RightSidebar';
import { useMap } from '../hooks/useMap';
import { useDrawTools } from '../hooks/useDrawTools';
import { usePermitAreas } from '../hooks/usePermitAreas';
import { useInfrastructure } from '../hooks/useInfrastructure';
import { useClickToPlace } from '../hooks/useClickToPlace';
import { useSitePlan } from '../contexts/SitePlanContext';
import { INITIAL_LAYERS } from '../constants/layers';
import { PLACEABLE_OBJECTS } from '../constants/placeableObjects';
import { exportPlan, importPlan, exportPermitAreaSiteplanV2 } from '../utils/exportUtils';
import '../styles/eventStager-dpr.css';
import '../styles/eventStager.css';

const DprStager = () => {
  const mapContainerRef = useRef(null);
  const { map, mapLoaded, styleLoaded } = useMap(mapContainerRef);
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const [showInfo, setShowInfo] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  
  // Use custom hooks for different functionalities
  const permitAreas = usePermitAreas(map, mapLoaded);
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
      
      // Listen for zoom changes with restrictions when focused
      const handleZoom = () => {
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
          
          // Prevent further zoom out and trigger shake
          map.setZoom(permitAreas.minAllowedZoom);
          triggerShake();
          return;
        }
        
        updateSitePlanMode(permitAreas.focusedArea, zoom);
      };
      
      map.on('zoom', handleZoom);
      map.on('move', handleZoom);
      
      return () => {
        map.off('zoom', handleZoom);
        map.off('move', handleZoom);
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
        const visibility = willBeVisible ? 'visible' : 'none';
        if (map && map.getLayer) {
          if (map.getLayer('permit-areas-fill')) {
            map.setLayoutProperty('permit-areas-fill', 'visibility', visibility);
          }
          if (map.getLayer('permit-areas-outline')) {
            map.setLayoutProperty('permit-areas-outline', 'visibility', visibility);
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
  }, [map, infrastructure]);

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

  // Load permit areas after map is ready - use similar logic to useDrawTools
  useEffect(() => {
    if (!map || !permitAreas.loadPermitAreas) {
      console.log('DprStager: Waiting for map instance:', { mapExists: !!map });
      return;
    }
    
    if (map.getSource && map.getSource('permit-areas')) {
      console.log('DprStager: Permit areas source already present, skipping load');
      return;
    }
    
    console.log('DprStager: Map instance available, checking readiness...');
    
    const loadWhenReady = () => {
      if (map.loaded() && map.isStyleLoaded()) {
        console.log('DprStager: Map confirmed ready, loading permit areas');
        permitAreas.loadPermitAreas();
      } else if (map.loaded()) {
        console.log('DprStager: Map loaded but style not ready, waiting for style...');
        // Wait for style to load
        map.once('style.load', () => {
          console.log('DprStager: Style loaded, now loading permit areas');
          permitAreas.loadPermitAreas();
        });
      } else {
        console.log('DprStager: Map not loaded yet, waiting for load event...');
        // Wait for map to load
        map.once('load', () => {
          console.log('DprStager: Map load event received, loading permit areas');
          permitAreas.loadPermitAreas();
        });
      }
    };
    
    // Try immediately, then use timeout as fallback
    loadWhenReady();
    
    // Fallback timeout in case events don't fire
    const timeoutId = setTimeout(() => {
      if (map && map.loaded() && map.isStyleLoaded() && !map.getSource('permit-areas')) {
        console.log('DprStager: Fallback timeout triggered, loading permit areas');
        permitAreas.loadPermitAreas();
      }
    }, 2000);
    
    return () => clearTimeout(timeoutId);
  }, [map, permitAreas.loadPermitAreas]);

  // Handle basemap style changes with proper timing
  const handleStyleChange = useCallback(() => {
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
        
        // Re-initialize permit areas
        if (permitAreas.loadPermitAreas) {
          permitAreas.loadPermitAreas();
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

    // Always wait for the next style.load event, even if style appears loaded
    // This ensures we catch the completion of any ongoing style change
    const styleLoadHandler = () => {
      console.log('Style load event received, scheduling layer reinitialization');
      // Add additional delay to ensure all style resources are ready
      setTimeout(reinitializeLayers, 150);
    };
    
    // Remove any existing listener and add new one
    map.off('style.load', styleLoadHandler);
    map.once('style.load', styleLoadHandler);
    
    // Fallback: if style appears already loaded, still trigger reinitialization
    if (map.isStyleLoaded()) {
      console.log('Style appears already loaded, but still waiting for next style.load event');
      // Set a backup timeout in case the style.load event doesn't fire
      setTimeout(() => {
        console.log('Backup timeout triggered for style change');
        reinitializeLayers();
      }, 2000);
    }
  }, [map, permitAreas, layers, infrastructure, drawTools.forceReinitialize]);

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
            Loading permit areas...
          </div>
        </div>
      )}
      
      {permitAreas.loadError && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 mx-4 mt-2">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            Error loading permit areas: {permitAreas.loadError}
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
    </div>
  );
};

export default DprStager; 