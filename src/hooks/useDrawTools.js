// hooks/useDrawTools.js
import { useState, useEffect, useRef, useCallback } from 'react';

export const useDrawTools = (map) => {
  const draw = useRef(null);
  const [activeTool, setActiveTool] = useState(null);
  const [customShapes, setCustomShapes] = useState([]);
  const [selectedShape, setSelectedShape] = useState(null);
  const [shapeLabel, setShapeLabel] = useState('');

  // Initialize draw controls
  useEffect(() => {
    if (!map || !window.MapboxDraw) return;

    const initDraw = () => {
      const drawInstance = new window.MapboxDraw({
        displayControlsDefault: false,
        controls: {},
        defaultMode: 'simple_select'
      });
      
      draw.current = drawInstance;
      map.addControl(drawInstance);
      console.log('Draw controls added');

      // Set up event handlers
      map.on('draw.create', handleDrawCreate);
      map.on('draw.update', handleDrawUpdate);
      map.on('draw.delete', handleDrawDelete);
      map.on('draw.selectionchange', handleSelectionChange);
    };

    const handleDrawCreate = (e) => {
      const feature = e.features[0];
      const shape = {
        id: feature.id,
        type: feature.geometry.type,
        label: '',
        properties: feature.properties
      };
      setCustomShapes(prev => [...prev, shape]);
      setSelectedShape(shape.id);
    };

    const handleDrawUpdate = (e) => {
      // Update handled by MapboxDraw
      console.log('Shape updated:', e.features);
    };

    const handleDrawDelete = (e) => {
      const deletedIds = e.features.map(f => f.id);
      setCustomShapes(prev => prev.filter(shape => !deletedIds.includes(shape.id)));
      setSelectedShape(null);
    };

    const handleSelectionChange = (e) => {
      if (e.features.length > 0) {
        setSelectedShape(e.features[0].id);
        const shape = customShapes.find(s => s.id === e.features[0].id);
        if (shape) {
          setShapeLabel(shape.label || '');
        }
      } else {
        setSelectedShape(null);
        setShapeLabel('');
      }
    };

    if (map.loaded()) {
      initDraw();
    } else {
      map.once('load', initDraw);
    }

    // Cleanup
    return () => {
      if (map && draw.current) {
        try {
          map.off('draw.create', handleDrawCreate);
          map.off('draw.update', handleDrawUpdate);
          map.off('draw.delete', handleDrawDelete);
          map.off('draw.selectionchange', handleSelectionChange);
          map.removeControl(draw.current);
        } catch (error) {
          console.warn('Error during draw controls cleanup:', error);
        }
        draw.current = null;
      }
    };
  }, [map, customShapes]);

  // Activate drawing tool
  const activateDrawingTool = useCallback((mode) => {
    if (!draw.current) return;
    
    setActiveTool(mode);
    switch(mode) {
      case 'point':
        draw.current.changeMode('draw_point');
        break;
      case 'line':
        draw.current.changeMode('draw_line_string');
        break;
      case 'polygon':
        draw.current.changeMode('draw_polygon');
        break;
      default:
        draw.current.changeMode('simple_select');
        setActiveTool(null);
    }
  }, []);

  // Update shape label
  const updateShapeLabel = useCallback(() => {
    if (selectedShape && draw.current) {
      setCustomShapes(prev => prev.map(shape => 
        shape.id === selectedShape ? { ...shape, label: shapeLabel } : shape
      ));
      
      const feature = draw.current.get(selectedShape);
      if (feature) {
        feature.properties.label = shapeLabel;
        draw.current.add(feature);
      }
    }
  }, [selectedShape, shapeLabel]);

  // Delete selected shape
  const deleteSelectedShape = useCallback(() => {
    if (selectedShape && draw.current) {
      draw.current.delete(selectedShape);
    }
  }, [selectedShape]);

  // Select shape
  const selectShape = useCallback((shapeId) => {
    if (draw.current) {
      draw.current.changeMode('simple_select', { featureIds: [shapeId] });
      setSelectedShape(shapeId);
    }
  }, []);

  return {
    draw: draw.current,
    activeTool,
    customShapes,
    selectedShape,
    shapeLabel,
    setShapeLabel,
    setCustomShapes,
    activateDrawingTool,
    updateShapeLabel,
    deleteSelectedShape,
    selectShape
  };
};