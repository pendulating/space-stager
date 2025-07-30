// src/components/EventStager.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Route } from 'lucide-react';
import Header from './Header/Header';
import Sidebar from './Sidebar/Sidebar';
import MapContainer from './Map/MapContainer';
import InfoPanel from './Modals/InfoPanel';
import FocusInfoPanel from './Modals/FocusInfoPanel';
import { useMap } from '../hooks/useMap';
import { useDrawTools } from '../hooks/useDrawTools';
import { usePermitAreas } from '../hooks/usePermitAreas';
import { useInfrastructure } from '../hooks/useInfrastructure';
import { useDragDrop } from '../hooks/useDragDrop';
import { useSapoMode } from '../hooks/useSapoMode';
import { INITIAL_LAYERS } from '../constants/layers';
import { PLACEABLE_OBJECTS } from '../constants/placeableObjects';
import { exportPlan, importPlan, exportPermitAreaSiteplan } from '../utils/exportUtils';

const EventStager = () => {
  const mapContainerRef = useRef(null);
  const { map, mapLoaded } = useMap(mapContainerRef);
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const [showInfo, setShowInfo] = useState(false);
  
  // Use custom hooks for different functionalities
  const drawTools = useDrawTools(map);
  const permitAreas = usePermitAreas(map, mapLoaded);
  const infrastructure = useInfrastructure(map, permitAreas.focusedArea, layers, setLayers);
  const dragDrop = useDragDrop(map);
  const sapoMode = useSapoMode(map, permitAreas.mode, drawTools);

  // Sync permit areas loading state with layers
  useEffect(() => {
    setLayers(prev => ({
      ...prev,
      permitAreas: {
        ...prev.permitAreas,
        loading: permitAreas.isLoading
      }
    }));
  }, [permitAreas.isLoading]);

  // Use a ref to store the previous focusedArea to prevent unnecessary effects
  const prevFocusedAreaRef = useRef(null);

  // Clear dropped objects when focus changes - use useCallback to prevent recreation
  const clearDroppedObjectsOnFocusChange = useCallback(() => {
    const currentFocusedArea = permitAreas.focusedArea;
    if (prevFocusedAreaRef.current !== currentFocusedArea) {
      prevFocusedAreaRef.current = currentFocusedArea;
      if (!currentFocusedArea) {
        dragDrop.clearDroppedObjects();
      }
    }
  }, [permitAreas.focusedArea, dragDrop.clearDroppedObjects]);

  useEffect(() => {
    clearDroppedObjectsOnFocusChange();
  }, [clearDroppedObjectsOnFocusChange]);

  // Export handlers
  const handleExport = () => {
    exportPlan(
      map, 
      drawTools.draw, 
      dragDrop.droppedObjects, 
      layers, 
      drawTools.customShapes
    );
  };

  const handleImport = (e) => {
    importPlan(
      e, 
      map, 
      drawTools.draw, 
      drawTools.setCustomShapes, 
      dragDrop.setDroppedObjects,
      setLayers
    );
  };

  const handleExportSiteplan = (format) => {
    exportPermitAreaSiteplan(
      map,
      permitAreas.focusedArea,
      layers,
      drawTools.customShapes,
      dragDrop.droppedObjects,
      format
    );
  };

  // Combined clear focus that clears both permit areas and infrastructure
  const handleClearFocus = () => {
    permitAreas.clearFocus();
    infrastructure.clearFocus();
  };

  // Create a unified toggle layer function that handles both permit areas and infrastructure
  const handleToggleLayer = useCallback((layerId) => {
    if (layerId === 'permitAreas') {
      // Handle permit areas toggle directly
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
      // Delegate to infrastructure hook for other layers
      infrastructure.toggleLayer(layerId);
    }
  }, [map, infrastructure]);

  // Reset infrastructure layer visibility when focused area changes
  useEffect(() => {
    if (!permitAreas.focusedArea) {
      // When clearing focus, ensure all infrastructure layers are hidden
      setLayers(prev => {
        const newLayers = { ...prev };
        Object.keys(newLayers).forEach(layerId => {
          if (layerId !== 'permitAreas') {
            newLayers[layerId] = {
              ...newLayers[layerId],
              visible: false,
              loaded: false,
              loading: false
            };
          }
        });
        return newLayers;
      });
    } else {
      // When switching to a new area, hide all infrastructure layers
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
    }
  }, [permitAreas.focusedArea?.id]);

  // Handle basemap style changes
  const handleStyleChange = useCallback(() => {
    console.log('Basemap style changed, re-initializing layers...');
    
    // Re-initialize permit areas
    if (permitAreas.loadPermitAreas) {
      permitAreas.loadPermitAreas();
    }
    
    // Re-initialize infrastructure layers if there's a focused area
    if (permitAreas.focusedArea) {
      Object.entries(layers).forEach(([layerId, config]) => {
        if (layerId !== 'permitAreas' && config.visible) {
          infrastructure.toggleLayer(layerId);
        }
      });
    }
  }, [permitAreas, layers, infrastructure]);

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50">
      <Header 
        showInfo={showInfo}
        setShowInfo={setShowInfo}
        onImport={handleImport}
        onExport={handleExport}
        focusedArea={permitAreas.focusedArea}
        onExportSiteplan={handleExportSiteplan}
      />
      
      {showInfo && <InfoPanel showInfo={showInfo} onClose={() => setShowInfo(false)} />}
      
      {/* SAPO Mode Active Indicator */}
      {permitAreas.mode === 'sapo' && (
        <div className="sapo-mode-indicator bg-green-100 border-l-4 border-green-500 text-green-700 p-3 mx-4 mt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Route className="w-4 h-4 mr-2" />
              <span className="font-medium">SAPO Mode Active</span>
              {sapoMode.isDrawingLine && (
                <span className="ml-2 text-sm">(Drawing line...)</span>
              )}
              {sapoMode.sapoZone && (
                <span className="ml-2 text-sm">(Street zone established)</span>
              )}
            </div>
            {sapoMode.sapoZone && (
              <button
                onClick={sapoMode.clearSapoMode}
                className="text-green-600 hover:text-green-800 px-2 py-1 text-sm"
              >
                Clear Zone
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Show loading/error state for permit areas */}
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
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          layers={layers}
          setLayers={setLayers}
          focusedArea={permitAreas.focusedArea}
          onClearFocus={handleClearFocus}
          onToggleLayer={handleToggleLayer}
          drawTools={drawTools}
          permitAreas={permitAreas}
          infrastructure={infrastructure}
          dragDrop={dragDrop}
          sapoMode={sapoMode}
          placeableObjects={PLACEABLE_OBJECTS}
        />
        
        <MapContainer 
          ref={mapContainerRef}
          map={map}
          mapLoaded={mapLoaded}
          focusedArea={permitAreas.focusedArea}
          drawTools={drawTools}
          dragDrop={dragDrop}
          permitAreas={permitAreas}
          sapoMode={sapoMode}
          placeableObjects={PLACEABLE_OBJECTS}
          onStyleChange={handleStyleChange}
        />
      </div>
    </div>
  );
};

export default EventStager;