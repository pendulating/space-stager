import React, { useCallback, useMemo, useEffect } from 'react';
import { X } from 'lucide-react';

const DEBUG = false; // Set to true to enable DroppedObjects debug logs

const DroppedObjects = ({ 
  objects = [],
  placeableObjects = [],
  map, 
  objectUpdateTrigger, 
  onRemoveObject 
}) => {
  if (DEBUG) console.log('DroppedObjects: Component render', {
    objectCount: objects.length,
    objectUpdateTrigger,
    hasMap: !!map,
    mapType: typeof map
  });

  // Test effect to see if we can manually trigger updates
  useEffect(() => {
    if (!map || !objects.length) return;
    
    if (DEBUG) console.log('DroppedObjects: useEffect triggered', { objectUpdateTrigger });
    
    // Test the map project function
    if (objects.length > 0) {
      const testObj = objects[0];
      try {
        const pixel = map.project([testObj.position.lng, testObj.position.lat]);
        if (DEBUG) console.log('DroppedObjects: Test projection successful', { pixel });
      } catch (error) {
        if (DEBUG) console.error('DroppedObjects: Test projection failed', error);
      }
    }
  }, [map, objects, objectUpdateTrigger]);

  // Always call ALL hooks at the top level - never conditionally
  const getObjectStyle = useCallback((object) => {
    const objectType = placeableObjects.find(p => p.id === object.type);
    if (!objectType || !map || typeof map.project !== 'function') {
      return { display: 'none' };
    }
    
    try {
      // Convert lat/lng to current screen coordinates
      const pixel = map.project([object.position.lng, object.position.lat]);
      
      if (DEBUG) console.log('DroppedObjects: Calculating position for', object.id, {
        lngLat: [object.position.lng, object.position.lat],
        pixel: { x: pixel.x, y: pixel.y },
        trigger: objectUpdateTrigger
      });
      
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
        zIndex: 1000,
        pointerEvents: 'auto',
        transform: 'translateZ(0)',
        willChange: 'transform'
      };
    } catch (error) {
      if (DEBUG) console.error('DroppedObjects: Error calculating position', error);
      return { display: 'none' };
    }
  }, [placeableObjects, map, objectUpdateTrigger]);

  const renderedObjects = useMemo(() => {
    if (DEBUG) console.log('DroppedObjects: Recalculating rendered objects, trigger:', objectUpdateTrigger);
    
    // Now we can do conditional logic inside the memoized value
    if (!objects || !Array.isArray(objects) || objects.length === 0) {
      return [];
    }

    if (!map || typeof map.project !== 'function') {
      return [];
    }
    
    return objects.map((obj) => {
      const objectType = placeableObjects.find(p => p.id === obj.type);
      if (!objectType) return null;
      
      const style = getObjectStyle(obj);
      if (style.display === 'none') return null;
      
      return (
        <div
          key={`${obj.id}-${objectUpdateTrigger}`}
          style={style}
          onClick={() => onRemoveObject && onRemoveObject(obj.id)}
          title={`${obj.name} - Click to remove`}
          className="group relative"
        >
          {objectType.icon}
          
          {/* Remove button overlay */}
          <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-red-500 text-white rounded-full p-1">
              <X className="w-3 h-3" />
            </div>
          </div>
        </div>
      );
    }).filter(Boolean);
  }, [objects, placeableObjects, objectUpdateTrigger, getObjectStyle, onRemoveObject, map]);

  // After all hooks are called, we can return early
  return <>{renderedObjects}</>;
};

export default DroppedObjects;
