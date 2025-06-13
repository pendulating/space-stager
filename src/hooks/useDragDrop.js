// hooks/useDragDrop.js
import { useState, useCallback, useEffect } from 'react';
import { PLACEABLE_OBJECTS } from '../constants/placeableObjects';

export const useDragDrop = (map) => {
  const [droppedObjects, setDroppedObjects] = useState([]);
  const [draggedObject, setDraggedObject] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [objectUpdateTrigger, setObjectUpdateTrigger] = useState(0);

  // Update objects positions when map moves
  useEffect(() => {
    if (!map) {
      console.log('DragDrop: No map instance available');
      return;
    }
    
    console.log('DragDrop: Setting up event listeners', { 
      mapExists: !!map, 
      mapLoaded: map.loaded ? map.loaded() : 'unknown' 
    });
    
    let rafId = null;
    
    const updateObjectPositions = () => {
      console.log('DragDrop: Map moved, updating positions');
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      
      rafId = requestAnimationFrame(() => {
        setObjectUpdateTrigger(prev => {
          console.log('DragDrop: Updating object positions, trigger:', prev + 1);
          return prev + 1;
        });
      });
    };
    
    const events = [
      'move', 'zoom', 'rotate', 'pitch', 'resize'
    ];
    
    const addEventListeners = () => {
      events.forEach(event => {
        map.on(event, updateObjectPositions);
        console.log(`DragDrop: Added listener for ${event}`);
      });
      console.log('DragDrop: All event listeners added for object positioning');
    };
    
    const removeEventListeners = () => {
      events.forEach(event => {
        map.off(event, updateObjectPositions);
      });
      console.log('DragDrop: Event listeners removed');
    };
    
    // Try multiple approaches to add event listeners
    try {
      if (map.loaded && typeof map.loaded === 'function' && map.loaded()) {
        console.log('DragDrop: Map is already loaded, adding listeners immediately');
        addEventListeners();
      } else {
        console.log('DragDrop: Map not loaded yet, waiting for load event');
        const onLoad = () => {
          console.log('DragDrop: Map load event fired, adding listeners');
          addEventListeners();
        };
        map.once('load', onLoad);
        
        // Also try adding them immediately as a fallback
        setTimeout(() => {
          console.log('DragDrop: Fallback - adding listeners after timeout');
          addEventListeners();
        }, 1000);
      }
    } catch (error) {
      console.error('DragDrop: Error setting up event listeners', error);
      // Fallback: just add the listeners
      addEventListeners();
    }
    
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      removeEventListeners();
    };
  }, [map]);

  // Handle object drag start
  const handleObjectDragStart = useCallback((e, objectType) => {
    const rect = e.target.getBoundingClientRect();
    setDraggedObject(objectType);
    setDragOffset({
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2
    });
    
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', objectType.id);
  }, []);

  // Handle drag over map
  const handleMapDragOver = useCallback((e) => {
    if (draggedObject) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, [draggedObject]);

  // Handle drop on map
  const handleMapDrop = useCallback((e) => {
    if (!draggedObject || !map) return;
    
    e.preventDefault();
    
    const mapContainer = map.getContainer();
    const mapRect = mapContainer.getBoundingClientRect();
    
    const x = e.clientX - mapRect.left - dragOffset.x;
    const y = e.clientY - mapRect.top - dragOffset.y;
    
    const lngLat = map.unproject([x, y]);
    
    const newObject = {
      id: `${draggedObject.id}-${Date.now()}`,
      type: draggedObject.id,
      name: draggedObject.name,
      position: {
        lng: lngLat.lng,
        lat: lngLat.lat
      },
      properties: {
        ...draggedObject,
        label: draggedObject.name,
        timestamp: new Date().toISOString()
      }
    };
    
    setDroppedObjects(prev => [...prev, newObject]);
    setDraggedObject(null);
    setDragOffset({ x: 0, y: 0 });
    
    console.log('Dropped object:', newObject);
  }, [draggedObject, map, dragOffset]);

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

  return {
    droppedObjects,
    draggedObject,
    dragOffset,
    objectUpdateTrigger,
    setDroppedObjects,
    handleObjectDragStart,
    handleMapDragOver,
    handleMapDrop,
    removeDroppedObject,
    getObjectStyle,
    clearDroppedObjects
  };
};