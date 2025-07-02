import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { INITIAL_LAYERS } from '../constants/layers';
import { PLACEABLE_OBJECTS } from '../constants/placeableObjects';
import { exportPlan, importPlan, exportPermitAreaSiteplan } from '../utils/exportUtils';
import '../styles/eventStager-dpr.css';
import '../styles/eventStager.css';

const DprStager = () => {
  const mapContainerRef = useRef(null);
  const { map, mapLoaded } = useMap(mapContainerRef);
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const [showInfo, setShowInfo] = useState(false);
  
  // Use custom hooks for different functionalities
  const permitAreas = usePermitAreas(map, mapLoaded);
  const drawTools = useDrawTools(map, permitAreas.focusedArea);
  const infrastructure = useInfrastructure(map, permitAreas.focusedArea, layers, setLayers);
  const dragDrop = useDragDrop(map);
  // Future: const dprMode = useDprMode(map, permitAreas.mode, drawTools);

  // ... (rest of EventStager logic, but remove SAPO-specific logic)

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
        dragDrop.clearDroppedObjects();
        drawTools.clearCustomShapes();
      }
    }
  }, [permitAreas.focusedArea, dragDrop.clearDroppedObjects, drawTools.clearCustomShapes]);

  useEffect(() => {
    clearObjectsOnFocusChange();
  }, [clearObjectsOnFocusChange]);

  const handleExport = () => {
    exportPlan(
      map, 
      drawTools.draw, 
      dragDrop.droppedObjects, 
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
      dragDrop.setDroppedObjects,
      setLayers
    );
  };

  const handleExportSiteplan = (format) => {
    exportPermitAreaSiteplan(
      map,
      permitAreas.focusedArea,
      layers,
      drawTools.draw?.current ? drawTools.draw.current.getAll().features : [],
      dragDrop.droppedObjects,
      format
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

  // When the focusedArea changes, clear all infrastructure layers from the map AND reset their state in the sidebar
  useEffect(() => {
    // 1. Clear all infrastructure layers from the map
    Object.entries(layers).forEach(([layerId, config]) => {
      if (layerId !== 'permitAreas' && config.visible) {
        infrastructure.toggleLayer(layerId); // This will remove from map
      }
    });
    // 2. Reset all infrastructure layers in the sidebar state
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

  // Load permit areas after map is loaded, reliably (matches old one-pager)
  useEffect(() => {
    if (!mapLoaded || !map || !permitAreas.loadPermitAreas) return;
    if (map.getSource && map.getSource('permit-areas')) {
      console.log('DprStager: Permit areas source already present, skipping load');
      return;
    }
    console.log('DprStager: Map loaded, loading permit areas');
    permitAreas.loadPermitAreas();
  }, [mapLoaded, map, permitAreas.loadPermitAreas]);

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
    
    // Re-initialize draw controls after a short delay to ensure style is loaded
    setTimeout(() => {
      if (drawTools.reinitializeDrawControls) {
        drawTools.reinitializeDrawControls();
      }
    }, 200);
  }, [permitAreas, layers, infrastructure, drawTools.reinitializeDrawControls]);

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
      
      {/* No SAPO Mode Indicator here */}
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
          placeableObjects={PLACEABLE_OBJECTS}
          map={map}
          onStyleChange={handleStyleChange}
        />
        
        <MapContainer 
          ref={mapContainerRef}
          map={map}
          mapLoaded={mapLoaded}
          focusedArea={permitAreas.focusedArea}
          drawTools={drawTools}
          dragDrop={dragDrop}
          permitAreas={permitAreas}
          placeableObjects={PLACEABLE_OBJECTS}
        />
      </div>
    </div>
  );
};

export default DprStager; 