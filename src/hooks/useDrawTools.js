// hooks/useDrawTools.js
import { useState, useEffect, useRef, useCallback } from 'react';

export const useDrawTools = (map, focusedArea = null) => {
  const draw = useRef(null);
  const [activeTool, setActiveTool] = useState(null);
  const [selectedShape, setSelectedShape] = useState(null);
  const [shapeLabel, setShapeLabel] = useState('');
  const [drawInitialized, setDrawInitialized] = useState(false);
  const [showLabels, setShowLabelsState] = useState(true);
  
  const setShowLabels = useCallback((value) => {
    setShowLabelsState(value);
  }, []);

  // Store event handlers in refs to avoid dependency issues
  const eventHandlers = useRef({
    handleDrawCreate: (e) => {
      const feature = e.features[0];
      setSelectedShape(feature.id);
    },
    handleDrawUpdate: (e) => {
      console.log('Shape updated:', e.features);
    },
    handleDrawDelete: (e) => {
      setSelectedShape(null);
    },
    handleSelectionChange: (e) => {
      if (e.features.length > 0) {
        setSelectedShape(e.features[0].id);
        const feature = e.features[0];
        setShapeLabel(feature.properties?.label || '');
      } else {
        setSelectedShape(null);
        setShapeLabel('');
      }
    }
  });

  // Initialize draw controls
  useEffect(() => {
    if (!map || !window.MapboxDraw) return;

    const initDraw = () => {
      // Remove existing draw control if it exists
      if (draw.current) {
        try {
          // Remove event handlers first
          map.off('draw.create', eventHandlers.current.handleDrawCreate);
          map.off('draw.update', eventHandlers.current.handleDrawUpdate);
          map.off('draw.delete', eventHandlers.current.handleDrawDelete);
          map.off('draw.selectionchange', eventHandlers.current.handleSelectionChange);
          
          // Remove the control
          map.removeControl(draw.current);
        } catch (error) {
          console.warn('Error removing existing draw control:', error);
        }
        draw.current = null;
        setDrawInitialized(false);
      }

      const drawInstance = new window.MapboxDraw({
        displayControlsDefault: false,
        controls: {},
        defaultMode: 'simple_select'
      });
      
      draw.current = drawInstance;
      map.addControl(drawInstance);
      

      
      setDrawInitialized(true);
      console.log('Draw controls added');

      // Set up event handlers using refs
      map.on('draw.create', eventHandlers.current.handleDrawCreate);
      map.on('draw.update', eventHandlers.current.handleDrawUpdate);
      map.on('draw.delete', eventHandlers.current.handleDrawDelete);
      map.on('draw.selectionchange', eventHandlers.current.handleSelectionChange);
    };

    // Initialize draw controls when map is ready
    const initializeDrawControls = () => {
      if (map.loaded()) {
        initDraw();
      } else {
        map.once('load', initDraw);
      }
    };

    // Initialize on mount
    initializeDrawControls();

    // Cleanup
    return () => {
      if (map && draw.current) {
        try {
          map.off('draw.create', eventHandlers.current.handleDrawCreate);
          map.off('draw.update', eventHandlers.current.handleDrawUpdate);
          map.off('draw.delete', eventHandlers.current.handleDrawDelete);
          map.off('draw.selectionchange', eventHandlers.current.handleSelectionChange);
          map.removeControl(draw.current);
        } catch (error) {
          console.warn('Error during draw controls cleanup:', error);
        }
        draw.current = null;
        setDrawInitialized(false);
      }
    };
  }, [map]); // Only depend on map, not on event handlers



  // Activate drawing tool
  const activateDrawingTool = useCallback((mode) => {
    if (!draw.current) {
      console.warn('Draw controls not initialized, cannot activate tool:', mode);
      return;
    }
    
    console.log('Activating drawing tool:', mode);
    
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
      const feature = draw.current.get(selectedShape);
      if (feature) {
        feature.properties.label = shapeLabel;
        draw.current.add(feature);
      }
    }
  }, [selectedShape, shapeLabel]);

  // Rename a specific shape
  const renameShape = useCallback((shapeId, newLabel) => {
    if (!draw.current) return;
    
    const feature = draw.current.get(shapeId);
    if (feature) {
      feature.properties.label = newLabel;
      draw.current.add(feature);
    }
    
    console.log('Shape renamed:', shapeId, 'to:', newLabel);
  }, []);

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

  // Clear all custom shapes
  const clearCustomShapes = useCallback(() => {
    if (draw.current) {
      draw.current.deleteAll();
      setSelectedShape(null);
      setShapeLabel('');
      console.log('All custom shapes cleared');
    }
  }, []);

  // Force re-initialization of draw controls
  const reinitializeDrawControls = useCallback(() => {
    if (!map || !window.MapboxDraw) return;
    
    console.log('Force re-initializing draw controls');
    
    // Store existing shapes before removing
    const existingShapes = draw.current ? draw.current.getAll() : [];
    
    // Remove existing draw control if it exists
    if (draw.current) {
      try {
        // Remove event handlers first
        map.off('draw.create', eventHandlers.current.handleDrawCreate);
        map.off('draw.update', eventHandlers.current.handleDrawUpdate);
        map.off('draw.delete', eventHandlers.current.handleDrawDelete);
        map.off('draw.selectionchange', eventHandlers.current.handleSelectionChange);
        
        map.removeControl(draw.current);
      } catch (error) {
        console.warn('Error removing existing draw control:', error);
      }
      draw.current = null;
    }

    const drawInstance = new window.MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      defaultMode: 'simple_select'
    });
    
    draw.current = drawInstance;
    map.addControl(drawInstance);
    
    // Set up event handlers for the new draw instance
    map.on('draw.create', eventHandlers.current.handleDrawCreate);
    map.on('draw.update', eventHandlers.current.handleDrawUpdate);
    map.on('draw.delete', eventHandlers.current.handleDrawDelete);
    map.on('draw.selectionchange', eventHandlers.current.handleSelectionChange);
    
    // Restore existing shapes
    if (existingShapes && existingShapes.features && existingShapes.features.length > 0) {
      drawInstance.add(existingShapes);
      console.log('Restored', existingShapes.features.length, 'shapes');
    }
    
    setDrawInitialized(true);
    console.log('Draw controls re-initialized');
  }, [map]); // Only depend on map

  return {
    draw,
    activeTool,
    selectedShape,
    shapeLabel,
    setShapeLabel,
    activateDrawingTool,
    updateShapeLabel,
    renameShape,
    deleteSelectedShape,
    selectShape,
    clearCustomShapes,
    reinitializeDrawControls,
    drawInitialized,
    showLabels,
    setShowLabels
  };
};