import React, { useCallback, useMemo, useEffect, useRef } from 'react';

const DEBUG = false; // Set to true to enable CustomShapeLabels debug logs

const CustomShapeLabels = ({ 
  draw,
  map, 
  objectUpdateTrigger,
  showLabels = true
}) => {
  // Track which labels are new or recently renamed to apply animations only when needed
  const animatedLabels = useRef(new Set());
  const previousLabels = useRef(new Map()); // Track previous label text to detect changes
  if (DEBUG) {
    let shapeCount = 0;
    try { shapeCount = draw?.current?.getAll()?.features?.length || 0; } catch (_) {}
    console.log('CustomShapeLabels: Component render', {
      shapeCount,
      objectUpdateTrigger,
      hasMap: !!map,
      showLabels
    });
  }

  // Cleanup effect to clear tracking when draw instance changes
  useEffect(() => {
    // Clear tracking when draw instance changes
    animatedLabels.current.clear();
    previousLabels.current.clear();
  }, [draw]);

  // Trigger immediate refresh on annotation change events
  useEffect(() => {
    if (!map || !draw?.current) return;
    const bump = () => {
      try { if (map && map.triggerRepaint) map.triggerRepaint(); } catch (_) {}
    };
    window.addEventListener('annotations:changed', bump);
    return () => window.removeEventListener('annotations:changed', bump);
  }, [map, draw]);

  // Calculate the center point of a shape
  const calculateShapeCenter = useCallback((shape) => {
    if (DEBUG) console.log('CustomShapeLabels: Calculating center for shape:', shape);
    
    if (!shape.geometry || !shape.geometry.coordinates) {
      if (DEBUG) console.log('CustomShapeLabels: No geometry or coordinates for shape:', shape.id);
      return null;
    }
    
    try {
      let coordinates = [];
      
      if (shape.geometry.type === 'Point') {
        const center = { lng: shape.geometry.coordinates[0], lat: shape.geometry.coordinates[1] };
        if (DEBUG) console.log('CustomShapeLabels: Point center:', center);
        return center;
      } else if (shape.geometry.type === 'LineString') {
        coordinates = shape.geometry.coordinates;
      } else if (shape.geometry.type === 'Polygon') {
        coordinates = shape.geometry.coordinates[0]; // Use outer ring
      } else if (shape.geometry.type === 'MultiPolygon') {
        coordinates = shape.geometry.coordinates.flat()[0]; // Use first polygon's outer ring
      }
      
      if (coordinates.length === 0) {
        if (DEBUG) console.log('CustomShapeLabels: No coordinates for shape:', shape.id);
        return null;
      }
      
      // Calculate centroid
      let sumLng = 0, sumLat = 0;
      coordinates.forEach(coord => {
        sumLng += coord[0];
        sumLat += coord[1];
      });
      
      const center = {
        lng: sumLng / coordinates.length,
        lat: sumLat / coordinates.length
      };
      
      if (DEBUG) console.log('CustomShapeLabels: Calculated center:', center, 'for shape:', shape.id);
      return center;
    } catch (error) {
      if (DEBUG) console.error('CustomShapeLabels: Error calculating shape center', error);
      return null;
    }
  }, []);

  // Always call ALL hooks at the top level - never conditionally
  const getLabelStyle = useCallback((shape) => {
    if (!map || typeof map.project !== 'function' || !showLabels) {
      return { display: 'none' };
    }
    
    try {
      const center = calculateShapeCenter(shape);
      if (!center) return { display: 'none' };
      
      // Convert lat/lng to current screen coordinates
      const pixel = map.project([center.lng, center.lat]);
      
      if (DEBUG) console.log('CustomShapeLabels: Calculating position for', shape.id, {
        lngLat: [center.lng, center.lat],
        pixel: { x: pixel.x, y: pixel.y },
        trigger: objectUpdateTrigger
      });
      
      return {
        position: 'absolute',
        left: pixel.x,
        top: pixel.y - 30, // Position above the shape
        transform: 'translateX(-50%) translateZ(0)',
        willChange: 'transform'
      };
    } catch (error) {
      if (DEBUG) console.error('CustomShapeLabels: Error calculating position', error);
      return { display: 'none' };
    }
  }, [map, objectUpdateTrigger, showLabels, calculateShapeCenter]);

  const renderedLabels = useMemo(() => {
    if (DEBUG) console.log('CustomShapeLabels: Recalculating rendered labels, trigger:', objectUpdateTrigger);
    if (DEBUG) console.log('CustomShapeLabels: showLabels:', showLabels);
    
    // Now we can do conditional logic inside the memoized value
    if (!draw?.current || !showLabels) {
      if (DEBUG) console.log('CustomShapeLabels: Early return - no draw instance or labels disabled');
      return [];
    }

    if (!map || typeof map.project !== 'function') {
      if (DEBUG) console.log('CustomShapeLabels: Early return - no map or project function');
      return [];
    }
    
    // Get shapes directly from the draw instance
    const allShapes = draw.current.getAll();
    if (DEBUG) console.log('CustomShapeLabels: All shapes from draw instance:', allShapes);
    
    const shapesWithLabels = allShapes.features.filter(shape => 
      shape.properties && shape.properties.label && shape.properties.label.trim() && shape.properties.type !== 'text'
    );
    if (DEBUG) console.log('CustomShapeLabels: Shapes with labels:', shapesWithLabels);
    
    return shapesWithLabels.map((shape) => {
      if (DEBUG) console.log('CustomShapeLabels: Processing shape:', shape);
      const style = getLabelStyle(shape);
      if (style.display === 'none') {
        if (DEBUG) console.log('CustomShapeLabels: Style is none for shape:', shape.id);
        return null;
      }
      
      // Check if this label is new or has been renamed
      const currentLabel = shape.properties.label;
      const previousLabel = previousLabels.current.get(shape.id);
      const isNewLabel = !previousLabel;
      const isRenamed = previousLabel && previousLabel !== currentLabel;
      const shouldAnimate = isNewLabel || isRenamed;
      
      // Update our tracking
      previousLabels.current.set(shape.id, currentLabel);
      
      // Add to animated set if this label should animate
      if (shouldAnimate) {
        animatedLabels.current.add(shape.id);
        // Remove from animated set after animation completes
        setTimeout(() => {
          animatedLabels.current.delete(shape.id);
        }, 300); // Match animation duration
      }
      
      const isCurrentlyAnimated = animatedLabels.current.has(shape.id);
      
      if (DEBUG) console.log('CustomShapeLabels: Rendering label for shape:', shape.id, 'with style:', style, 'animated:', isCurrentlyAnimated);
      return (
        <div
          key={`label-${shape.id}`} // Stable key that doesn't change on map movement
          style={style}
          className={`custom-shape-label ${isCurrentlyAnimated ? 'custom-shape-label-enter' : ''}`}
          title={shape.properties.label}
        >
          {shape.properties.label}
        </div>
      );
    }).filter(Boolean);
  }, [draw, objectUpdateTrigger, getLabelStyle, showLabels, map]);

  // After all hooks are called, we can return early
  return <>{renderedLabels}</>;
};

export default CustomShapeLabels; 