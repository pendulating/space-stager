// components/Map/MapContainer.jsx
import React, { forwardRef, useEffect, useState, useRef } from 'react';
import MapTooltip from './MapTooltip';
import OverlapSelector from './OverlapSelector';
import DroppedObjects from './DroppedObjects';
import ActiveToolIndicator from './ActiveToolIndicator';
import LoadingOverlay from './LoadingOverlay';

const DEBUG = false; // Set to true to enable MapContainer debug logs

const MapContainer = forwardRef(({ 
  map,
  mapLoaded, 
  focusedArea, 
  drawTools, 
  dragDrop, 
  permitAreas,
  placeableObjects,
  infrastructure,
  onMapClick,
  onObjectDrop,
  onObjectUpdate,
  onObjectRemove,
  onOverlapSelect,
  onOverlapDeselect,
  overlapSelector,
  activeTool,
  isLoading
}, ref) => {
  const { handleMapDragOver, handleMapDrop, droppedObjects } = dragDrop;
  const mapContainerRef = useRef(null);

  // Compass state
  const [bearing, setBearing] = useState(0);

  // Listen for map bearing changes
  useEffect(() => {
    if (!map) return;
    const updateBearing = () => setBearing(map.getBearing ? map.getBearing() : 0);
    map.on('rotate', updateBearing);
    map.on('move', updateBearing);
    // Set initial bearing
    updateBearing();
    return () => {
      map.off('rotate', updateBearing);
      map.off('move', updateBearing);
    };
  }, [map]);

  // Compass click handler
  const handleCompassClick = () => {
    if (map && map.rotateTo) {
      map.rotateTo(0, { duration: 500 });
    }
  };

  // Disable double-click zoom when map is loaded to prevent conflicts with permit area selection
  React.useEffect(() => {
    if (mapLoaded && map && map.doubleClickZoom) {
      map.doubleClickZoom.disable();
    }
  }, [mapLoaded, map]);

  if (DEBUG) console.log('MapContainer: Rendering with map instance', {
    hasMap: !!map,
    hasProject: map && typeof map.project === 'function',
    mapLoaded,
    droppedObjectsCount: droppedObjects?.length || 0
  });

  return (
    <div className="flex-1 relative">
      {/* Compass Overlay */}
      <div
        className="absolute bottom-4 left-4 z-50 flex flex-col items-start"
        style={{ pointerEvents: 'none' }}
      >
        <button
          className="bg-white shadow-lg border border-gray-200 rounded-full w-12 h-12 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          style={{
            transform: `rotate(${-bearing}deg)`,
            pointerEvents: 'auto',
            transition: 'transform 0.3s cubic-bezier(.4,2,.6,1)' // smooth rotation
          }}
          title="Reset North"
          onClick={handleCompassClick}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="15" stroke="#d1d5db" strokeWidth="2" fill="#fff" />
            <polygon points="16,6 19,18 16,15 13,18" fill="#2563eb" />
            <text x="16" y="26" textAnchor="middle" fontSize="10" fill="#374151" fontWeight="bold">N</text>
          </svg>
        </button>
      </div>
      
      <div 
        ref={ref} 
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
        onDragOver={handleMapDragOver}
        onDrop={handleMapDrop}
      />
      
      <DroppedObjects
        objects={droppedObjects}
        placeableObjects={placeableObjects}
        map={map}
        onRemoveObject={dragDrop.removeDroppedObject}
        objectUpdateTrigger={dragDrop.objectUpdateTrigger}
      />
      
      {!mapLoaded && <LoadingOverlay />}
      
      {drawTools?.activeTool && <ActiveToolIndicator tool={drawTools.activeTool} />}
      
      {/* Only show tooltip when not drawing */}
      {!drawTools?.activeTool && <MapTooltip tooltip={permitAreas.tooltip} />}
      
      {permitAreas.showOverlapSelector && (
        <OverlapSelector 
          overlappingAreas={permitAreas.overlappingAreas}
          selectedIndex={permitAreas.selectedOverlapIndex}
          clickPosition={permitAreas.clickPosition}
          onSelect={permitAreas.selectOverlappingArea}
          onClose={permitAreas.clearOverlapSelector}
        />
      )}
    </div>
  );
});

MapContainer.displayName = 'MapContainer';

export default MapContainer;