import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { padAngle } from '../../utils/enhancedRenderingUtils';
import { X } from 'lucide-react';
import { getContrastingBackgroundForIcon } from '../../utils/colorUtils';

const DEBUG = false; // Set to true to enable DroppedObjects debug logs

const DroppedObjects = ({ 
  objects = [],
  placeableObjects = [],
  map, 
  objectUpdateTrigger, 
  onRemoveObject,
  onEditNote,
  isNoteEditing
}) => {
  if (DEBUG) console.log('DroppedObjects: Component render', {
    objectCount: objects.length,
    objectUpdateTrigger,
    hasMap: !!map,
    mapType: typeof map
  });

  // Cache background color by icon src for performance
  const [iconBgBySrc, setIconBgBySrc] = useState({});

  // Pre-compute contrasting backgrounds for base icons of all placeable objects
  useEffect(() => {
    if (!placeableObjects || !placeableObjects.length) return;
    const needed = {};
    placeableObjects.forEach((po) => {
      if (po?.imageUrl && !iconBgBySrc[po.imageUrl]) {
        needed[po.imageUrl] = po.color || '#64748b';
      }
    });
    const srcs = Object.keys(needed);
    if (srcs.length === 0) return;
    let active = true;
    Promise.all(srcs.map(async (src) => {
      const bg = await getContrastingBackgroundForIcon(src, needed[src], 0.9);
      return [src, bg];
    })).then((pairs) => {
      if (!active) return;
      setIconBgBySrc((prev) => {
        const next = { ...prev };
        pairs.forEach(([s, bg]) => { next[s] = bg; });
        return next;
      });
    }).catch(() => {});
    return () => { active = false; };
  }, [placeableObjects, iconBgBySrc]);

  // Pre-compute contrasting backgrounds for current objects
  useEffect(() => {
    if (!objects || !objects.length) return;
    const needed = {};
    objects.forEach((obj) => {
      const objectType = placeableObjects.find(p => p.id === obj.type);
      if (!objectType || !objectType.imageUrl) return;
      const isEnhanced = !!objectType?.enhancedRendering?.enabled;
      const base = objectType.enhancedRendering?.spriteBase;
      const dir = objectType.enhancedRendering?.publicDir || '/data/icons/isometric-bw';
      const angle = typeof obj?.properties?.rotationDeg === 'number' ? obj.properties.rotationDeg : 0;
      const src = isEnhanced && base ? `${dir}/${base}_${padAngle(angle)}.png` : objectType.imageUrl;
      if (src && !iconBgBySrc[src]) {
        needed[src] = objectType.color || '#64748b';
      }
    });

    const srcs = Object.keys(needed);
    if (srcs.length === 0) return;

    let active = true;
    Promise.all(srcs.map(async (src) => {
      const bg = await getContrastingBackgroundForIcon(src, needed[src], 0.9);
      return [src, bg];
    })).then((pairs) => {
      if (!active) return;
      setIconBgBySrc((prev) => {
        const next = { ...prev };
        pairs.forEach(([s, bg]) => { next[s] = bg; });
        return next;
      });
    }).catch(() => {});

    return () => { active = false; };
  }, [objects, placeableObjects, objectUpdateTrigger, iconBgBySrc]);

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
      
      // Compute zoom-based scale so icons shrink when zoomed out and grow when zoomed in
      const zoom = typeof map.getZoom === 'function' ? map.getZoom() : 16;
      const zoomScale = Math.min(1.6, Math.max(0.6, 0.6 + (zoom - 12) * 0.1));

      // Use the object's defined size or default to 24px, scaled by zoom
      const baseSize = Math.max(objectType.size.width, objectType.size.height, 24);
      const iconSize = baseSize * zoomScale;
      const halfSize = iconSize / 2;
      
      return {
        position: 'absolute',
        left: pixel.x - halfSize,
        top: pixel.y - halfSize,
        width: iconSize,
        height: iconSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        zIndex: 1000,
        pointerEvents: 'auto',
        transform: 'translateZ(0)',
        willChange: 'transform',
        // Minimal styling - just the icon with a subtle background for visibility
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '50%',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        border: '1px solid rgba(0,0,0,0.1)'
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
      // Skip rectangle-type objects; rendered by DroppedRectangles overlay
      if (objectType.geometryType === 'rect') return null;
      
      const style = { ...getObjectStyle(obj) };
      if (style.display === 'none') return null;
      
      // Calculate icon size for font sizing
      const zoom = typeof map.getZoom === 'function' ? map.getZoom() : 16;
      const zoomScale = Math.min(1.6, Math.max(0.6, 0.6 + (zoom - 12) * 0.1));
      const baseSize = Math.max(objectType.size.width, objectType.size.height, 24);
      const iconSize = baseSize * zoomScale;
      const fontSize = Math.max(iconSize * 0.6, 14);

      // Determine icon src and override background for contrast if we have it
      let iconSrc = null;
      if (objectType.imageUrl) {
        const isEnhanced = !!objectType?.enhancedRendering?.enabled;
        const base = objectType.enhancedRendering?.spriteBase;
        const dir = objectType.enhancedRendering?.publicDir || '/data/icons/isometric-bw';
        const angle = typeof obj?.properties?.rotationDeg === 'number' ? obj.properties.rotationDeg : 0;
        iconSrc = isEnhanced && base ? `${dir}/${base}_${padAngle(angle)}.png` : objectType.imageUrl;
        const bg = iconBgBySrc[iconSrc];
        if (bg) style.backgroundColor = bg;
      }
      
      return (
        <div
          key={`${obj.id}-${objectUpdateTrigger}`}
          style={style}
          title={obj.name}
          className="group relative placed-object"
        >
          {objectType.imageUrl ? (
            <img
              src={iconSrc}
              alt={objectType.name}
              style={{ width: iconSize, height: iconSize, objectFit: 'contain', transform: obj?.properties?.flipped ? 'scaleX(-1)' : undefined }}
              draggable={false}
            />
          ) : (
            <div 
              style={{ 
                color: objectType.color,
                fontSize: `${fontSize}px`,
                lineHeight: '1',
                transform: obj?.properties?.flipped ? 'scaleX(-1)' : undefined
              }}
            >
              {objectType.icon}
            </div>
          )}
          
          {/* Floating controls: edit note and remove */}
          {!isNoteEditing && (
            <div className="absolute -top-2 right-0 left-0 mx-auto w-max flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                className="bg-white/90 dark:bg-gray-900/80 border border-gray-300 dark:border-gray-700 rounded-full px-2 py-1 text-[10px] shadow"
                title="Edit note"
                onClick={(e) => { e.stopPropagation(); onEditNote && onEditNote(obj); }}
              >
                Edit
              </button>
              <button
                type="button"
                className="bg-red-500 text-white rounded-full p-1 shadow"
                title="Remove"
                onClick={(e) => { e.stopPropagation(); onRemoveObject && onRemoveObject(obj.id); }}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      );
    }).filter(Boolean);
  }, [objects, placeableObjects, objectUpdateTrigger, getObjectStyle, onRemoveObject, map, iconBgBySrc]);

  // After all hooks are called, we can return early
  return <>{renderedObjects}</>;
};

export default DroppedObjects;
