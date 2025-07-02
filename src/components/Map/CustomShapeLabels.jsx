import React, { useCallback, useMemo, useEffect } from 'react';

const DEBUG = false; // Set to true to enable CustomShapeLabels debug logs

const CustomShapeLabels = ({ 
  draw,
  map, 
  objectUpdateTrigger,
  showLabels = true
}) => {
  if (DEBUG) console.log('CustomShapeLabels: Component render', {
    shapeCount: customShapes.length,
    objectUpdateTrigger,
    hasMap: !!map,
    showLabels
  });

  // Test effect to see if we can manually trigger updates
  useEffect(() => {
    if (!map || !draw?.current || !showLabels) return;
    
    if (DEBUG) console.log('CustomShapeLabels: useEffect triggered', { objectUpdateTrigger });
    
    // Test the map project function
    const allShapes = draw.current.getAll();
    if (allShapes.features.length > 0) {
      const testShape = allShapes.features[0];
      try {
        // For shapes, we need to calculate the center point
        const center = calculateShapeCenter(testShape);
        if (center) {
          const pixel = map.project([center.lng, center.lat]);
          if (DEBUG) console.log('CustomShapeLabels: Test projection successful', { pixel });
        }
      } catch (error) {
        if (DEBUG) console.error('CustomShapeLabels: Test projection failed', error);
      }
    }
  }, [map, draw, objectUpdateTrigger, showLabels]);

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
      shape.properties && shape.properties.label && shape.properties.label.trim()
    );
    if (DEBUG) console.log('CustomShapeLabels: Shapes with labels:', shapesWithLabels);
    
    return shapesWithLabels.map((shape) => {
      if (DEBUG) console.log('CustomShapeLabels: Processing shape:', shape);
      const style = getLabelStyle(shape);
      if (style.display === 'none') {
        if (DEBUG) console.log('CustomShapeLabels: Style is none for shape:', shape.id);
        return null;
      }
      
      if (DEBUG) console.log('CustomShapeLabels: Rendering label for shape:', shape.id, 'with style:', style);
      return (
        <div
          key={`label-${shape.id}-${objectUpdateTrigger}`}
          style={style}
          className="custom-shape-label custom-shape-label-enter"
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