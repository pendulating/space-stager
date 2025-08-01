import { useState, useCallback, useEffect, useRef } from 'react';
import { PLACEABLE_OBJECTS } from '../constants/placeableObjects';

const DEBUG = false; // Set to true to enable click-to-place debug logs

export const useClickToPlace = (map) => {
  const [droppedObjects, setDroppedObjects] = useState([]);
  const [placementMode, setPlacementMode] = useState(null);
  const [cursorPosition, setCursorPosition] = useState(null);
  const [objectUpdateTrigger, setObjectUpdateTrigger] = useState(0);

  // Update objects positions when map moves
  useEffect(() => {
    if (!map) {
      if (DEBUG) console.log('ClickToPlace: No map instance available');
      return;
    }
    
    if (DEBUG) console.log('ClickToPlace: Setting up event listeners', { 
      mapExists: !!map, 
      mapLoaded: map.loaded ? map.loaded() : 'unknown' 
    });
    
    const updateObjectPositions = () => {
      setObjectUpdateTrigger(prev => prev + 1);
    };
    
    const events = [
      'move', 'zoom', 'rotate', 'pitch', 'resize'
    ];
    
    const addEventListeners = () => {
      events.forEach(event => {
        map.on(event, updateObjectPositions);
        if (DEBUG) console.log(`ClickToPlace: Added listener for ${event}`);
      });
      if (DEBUG) console.log('ClickToPlace: All event listeners added for object positioning');
    };
    
    const removeEventListeners = () => {
      events.forEach(event => {
        map.off(event, updateObjectPositions);
      });
      if (DEBUG) console.log('ClickToPlace: Event listeners removed');
    };
    
    // Try multiple approaches to add event listeners
    try {
      if (map.loaded && typeof map.loaded === 'function' && map.loaded()) {
        if (DEBUG) console.log('ClickToPlace: Map is already loaded, adding listeners immediately');
        addEventListeners();
      } else {
        if (DEBUG) console.log('ClickToPlace: Map not loaded yet, waiting for load event');
        const onLoad = () => {
          if (DEBUG) console.log('ClickToPlace: Map load event fired, adding listeners');
          addEventListeners();
        };
        map.once('load', onLoad);
        
        // Also try adding them immediately as a fallback
        setTimeout(() => {
          if (DEBUG) console.log('ClickToPlace: Fallback - adding listeners after timeout');
          addEventListeners();
        }, 1000);
      }
    } catch (error) {
      if (DEBUG) console.error('ClickToPlace: Error setting up event listeners', error);
      // Fallback: just add the listeners
      addEventListeners();
    }
    
    return () => {
      removeEventListeners();
    };
  }, [map]);

  // Handle mouse move for preview
  const handleMapMouseMove = useCallback((e) => {
    if (!placementMode || !map) return;
    
    const mapContainer = map.getContainer();
    const mapRect = mapContainer.getBoundingClientRect();
    
    const x = e.clientX - mapRect.left;
    const y = e.clientY - mapRect.top;
    
    const lngLat = map.unproject([x, y]);
    setCursorPosition({ x, y, lng: lngLat.lng, lat: lngLat.lat });
  }, [placementMode, map]);

  // Handle map click for placement
  const handleMapClick = useCallback((e) => {
    if (!placementMode || !map) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const mapContainer = map.getContainer();
    const mapRect = mapContainer.getBoundingClientRect();
    
    const x = e.clientX - mapRect.left;
    const y = e.clientY - mapRect.top;
    
    const lngLat = map.unproject([x, y]);
    
    const newObject = {
      id: `${placementMode.objectType.id}-${Date.now()}`,
      type: placementMode.objectType.id,
      name: placementMode.objectType.name,
      position: {
        lng: lngLat.lng,
        lat: lngLat.lat
      },
      properties: {
        ...placementMode.objectType,
        label: placementMode.objectType.name,
        timestamp: new Date().toISOString()
      }
    };
    
    setDroppedObjects(prev => [...prev, newObject]);
    
    if (DEBUG) console.log('Placed object:', newObject);
    
    // If not in batch mode, exit placement mode
    if (!placementMode.isBatchMode) {
      setPlacementMode(null);
      setCursorPosition(null);
    }
  }, [placementMode, map]);

  // Activate placement mode
  const activatePlacementMode = useCallback((objectType, isBatchMode = false) => {
    if (placementMode && placementMode.objectType.id === objectType.id) {
      // If clicking the same object, cancel placement mode
      setPlacementMode(null);
      setCursorPosition(null);
      if (DEBUG) console.log('ClickToPlace: Cancelled placement mode for', objectType.name);
    } else {
      // Activate placement mode for new object
      setPlacementMode({
        objectType,
        isBatchMode
      });
      if (DEBUG) console.log('ClickToPlace: Activated placement mode for', objectType.name, 'batch:', isBatchMode);
    }
  }, [placementMode]);

  // Remove dropped object
  const removeDroppedObject = useCallback((objectId) => {
    setDroppedObjects(prev => prev.filter(obj => obj.id !== objectId));
  }, []);

  // Get object style
  const getObjectStyle = useCallback((object) => {
    const objectType = PLACEABLE_OBJECTS.find(p => p.id === object.type);
    if (!objectType || !map) return { display: 'none' };
    
    const pixel = map.project([object.position.lng, object.position.lat]);
    
    return {
      position: 'absolute',
      left: pixel.x - objectType.size.width / 2,
      top: pixel.y - objectType.size.height / 2,
      width: objectType.size.width,
      height: objectType.size.height,
      backgroundColor: objectType.color,
      border: '2px solid white',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '20px',
      cursor: 'pointer',
      userSelect: 'none',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      zIndex: 10,
      pointerEvents: 'auto',
      transform: 'translateZ(0)',
      willChange: 'transform'
    };
  }, [map]);

  // Clear dropped objects
  const clearDroppedObjects = useCallback(() => {
    setDroppedObjects([]);
  }, []);

  // Cancel placement mode
  const cancelPlacementMode = useCallback(() => {
    setPlacementMode(null);
    setCursorPosition(null);
  }, []);

  return {
    droppedObjects,
    placementMode,
    cursorPosition,
    objectUpdateTrigger,
    setDroppedObjects,
    handleMapMouseMove,
    handleMapClick,
    activatePlacementMode,
    removeDroppedObject,
    getObjectStyle,
    clearDroppedObjects,
    cancelPlacementMode
  };
}; 