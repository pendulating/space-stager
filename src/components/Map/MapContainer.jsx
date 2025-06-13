// components/Map/MapContainer.jsx
import React, { forwardRef } from 'react';
import MapTooltip from './MapTooltip';
import OverlapSelector from './OverlapSelector';
import DroppedObjects from './DroppedObjects';
import ActiveToolIndicator from './ActiveToolIndicator';
import LoadingOverlay from './LoadingOverlay';

const MapContainer = forwardRef(({ 
  map,
  mapLoaded, 
  focusedArea, 
  drawTools, 
  dragDrop, 
  permitAreas,
  placeableObjects
}, ref) => {
  const { activeTool } = drawTools;
  const { handleMapDragOver, handleMapDrop, droppedObjects } = dragDrop;

  // Disable double-click zoom when map is loaded to prevent conflicts with permit area selection
  React.useEffect(() => {
    if (mapLoaded && map && map.doubleClickZoom) {
      map.doubleClickZoom.disable();
    }
  }, [mapLoaded, map]);

  console.log('MapContainer: Rendering with map instance', {
    hasMap: !!map,
    hasProject: map && typeof map.project === 'function',
    mapLoaded,
    droppedObjectsCount: droppedObjects?.length || 0
  });

  return (
    <div className="flex-1 relative">
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
      
      {activeTool && <ActiveToolIndicator tool={activeTool} />}
      
      <MapTooltip tooltip={permitAreas.tooltip} />
      
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