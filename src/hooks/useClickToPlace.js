import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useGlobalKeymap } from './useGlobalKeymap';
import { PLACEABLE_OBJECTS } from '../constants/placeableObjects.js';
import { quantizeToSlices } from '../utils/enhancedRenderingUtils.js';

const DEBUG = true; // Set to true to enable click-to-place debug logs

export const useClickToPlace = (map) => {
  const [droppedObjects, setDroppedObjects] = useState([]);
  const [placementMode, setPlacementMode] = useState(null);
  const [cursorPosition, setCursorPosition] = useState(null);
  const [objectUpdateTrigger, setObjectUpdateTrigger] = useState(0);

  const placementModeRef = useRef(null);
  useEffect(() => {
    placementModeRef.current = placementMode;
  }, [placementMode]);

  useGlobalKeymap([
    {
      key: 'Escape',
      enabled: () => !!placementModeRef.current,
      onEvent: (e) => {
        try { e.preventDefault(); } catch (_) {}
        setPlacementMode(null);
        setCursorPosition(null);
      },
      preventDefault: true,
      priority: 80,
      stop: true
    }
  ]);

  // Deprecated: camera-driven objectUpdateTrigger is no longer required; overlays use view hook.

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
    if (DEBUG) console.info('[useClickToPlace] Map click', e.clientX, e.clientY, !!placementMode);
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
        timestamp: new Date().toISOString(),
        flipped: !!placementMode.isFlipped,
        rotationDeg: typeof placementMode.rotationDeg === 'number' ? placementMode.rotationDeg : 0
      }
    };
    
    setDroppedObjects(prev => [...prev, newObject]);
    // Bump trigger for any listeners still relying on it
    setObjectUpdateTrigger(v => v + 1);
    
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
        isBatchMode,
        isFlipped: false,
        rotationDeg: 0
      });
      if (DEBUG) console.log('ClickToPlace: Activated placement mode for', objectType.name, 'batch:', isBatchMode);
    }
  }, [placementMode]);

  // Remove dropped object
  const removeDroppedObject = useCallback((objectId) => {
    setDroppedObjects(prev => prev.filter(obj => obj.id !== objectId));
    setObjectUpdateTrigger(v => v + 1);
  }, []);

  // Update a dropped object by id
  const updateDroppedObject = useCallback((objectId, updater, silent = false) => {
    setDroppedObjects(prev => prev.map(obj => obj.id === objectId ? (typeof updater === 'function' ? updater(obj) : { ...obj, ...updater }) : obj));
    if (!silent) {
      setObjectUpdateTrigger(v => v + 1);
    }
  }, []);

  // Set a note on a dropped object (stored under properties.note)
  const setDroppedObjectNote = useCallback((objectId, note) => {
    updateDroppedObject(objectId, (obj) => ({ ...obj, properties: { ...obj.properties, note: note || '' } }));
  }, [updateDroppedObject]);

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

  // Centralized rotation now handled via useRotationControls in MapContainer

  // External control to rotate placement by step (±45) using uniform 8-slice quantization
  const rotatePlacementModeBy = useCallback((delta45) => {
    setPlacementMode(prev => {
      if (!prev) return prev;
      const cur = typeof prev.rotationDeg === 'number' ? prev.rotationDeg : 0;
      let next = (cur + delta45) % 360;
      if (next < 0) next += 360;
      // Persist world-facing rotation in 45° increments without applying center offset
      const q = ((quantizeToSlices(next, 8, 0)) + 360) % 360;
      return { ...prev, rotationDeg: q };
    });
  }, [map]);

  return useMemo(() => ({
    droppedObjects,
    placementMode,
    cursorPosition,
    objectUpdateTrigger,
    setDroppedObjects,
    handleMapMouseMove,
    handleMapClick,
    activatePlacementMode,
    removeDroppedObject,
    updateDroppedObject,
    setDroppedObjectNote,
    getObjectStyle,
    clearDroppedObjects,
    cancelPlacementMode,
    rotatePlacementModeBy
  }), [
    droppedObjects,
    placementMode,
    cursorPosition,
    objectUpdateTrigger,
    setDroppedObjects,
    handleMapMouseMove,
    handleMapClick,
    activatePlacementMode,
    removeDroppedObject,
    updateDroppedObject,
    setDroppedObjectNote,
    getObjectStyle,
    clearDroppedObjects,
    cancelPlacementMode,
    rotatePlacementModeBy
  ]);
}; 