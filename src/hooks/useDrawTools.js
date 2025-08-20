// hooks/useDrawTools.js
import { useState, useEffect, useRef, useCallback } from 'react';
import RectObjectMode from '../draw-modes/rectObjectMode';

export const useDrawTools = (map, focusedArea = null) => {
  const draw = useRef(null);
  const [activeTool, setActiveTool] = useState(null);
  const [selectedShape, setSelectedShape] = useState(null);
  const [shapeLabel, setShapeLabel] = useState('');
  const [drawInitialized, setDrawInitialized] = useState(false);
  const [showLabels, setShowLabelsState] = useState(true);
  const [activeRectObjectTypeId, setActiveRectObjectTypeId] = useState(null);
  
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

  // Initialize draw controls with race condition protection
  useEffect(() => {
    if (!map || !window.MapboxDraw) return;

    const initDraw = () => {
      // Skip if already initialized to avoid conflicts
      if (draw.current && drawInitialized) {
        console.log('Draw controls already initialized, skipping');
        return;
      }

      console.log('Starting draw controls initialization...', {
        mapLoaded: map.loaded(),
        styleLoaded: map.isStyleLoaded?.(),
        mapboxDrawAvailable: !!window.MapboxDraw
      });

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
          console.log('Removed existing draw control');
        } catch (error) {
          console.warn('Error removing existing draw control:', error);
        }
        draw.current = null;
      }

      try {
        console.log('Creating new MapboxDraw instance...');
        const drawInstance = new window.MapboxDraw({
          displayControlsDefault: false,
          controls: {},
          defaultMode: 'simple_select',
          userProperties: true,
          modes: Object.assign({}, window.MapboxDraw.modes, { draw_rect_object: RectObjectMode })
        });
        
        console.log('Adding draw control to map...');
        draw.current = drawInstance;
        map.addControl(drawInstance);
        
        console.log('Setting up event handlers...');
        // Set up event handlers using refs
        map.on('draw.create', eventHandlers.current.handleDrawCreate);
        map.on('draw.update', eventHandlers.current.handleDrawUpdate);
        map.on('draw.delete', eventHandlers.current.handleDrawDelete);
        map.on('draw.selectionchange', eventHandlers.current.handleSelectionChange);
        
        setDrawInitialized(true);
        console.log('✓ Draw controls initialized successfully');
      } catch (error) {
        console.error('✗ Error during draw controls initialization:', error);
        setDrawInitialized(false);
        throw error;
      }
    };

    // Initialize draw controls when map is ready - less strict conditions
    const initializeDrawControls = () => {
      try {
        const styleReady = typeof map.isStyleLoaded === 'function' ? map.isStyleLoaded() : true;
        if (styleReady) {
          console.log('Map style ready, proceeding with draw initialization');
          initDraw();
        } else {
          console.log('Map style not loaded yet, waiting for style.load event');
          const onStyleLoad = () => {
            console.log('Style load received, initializing draw controls');
            try {
              initDraw();
            } catch (error) {
              console.error('Error during draw initialization after style load:', error);
              setDrawInitialized(false);
            }
          };
          map.once('style.load', onStyleLoad);
        }
      } catch (error) {
        console.error('Error in initializeDrawControls:', error);
        setDrawInitialized(false);
      }
    };

    // Initialize on mount
    console.log('useDrawTools: Starting initialization process');
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
  }, [map]); // Removed drawInitialized from dependencies to avoid loop

  // Keep Draw resilient across style changes without flipping availability
  useEffect(() => {
    if (!map) return;
    const onStyleLoad = () => {
      if (!draw.current) return;
      try {
        const existing = draw.current.getAll();
        // Re-add control to inject layers for the new style, then restore shapes
        map.removeControl(draw.current);
        map.addControl(draw.current);
        if (existing && existing.features && existing.features.length > 0) {
          draw.current.add(existing);
        }
        // Do not change drawInitialized here; keep tools available
      } catch (e) {
        console.warn('Draw rebind on style.load failed', e);
      }
    };
    map.on('style.load', onStyleLoad);
    return () => { try { map.off('style.load', onStyleLoad); } catch (_) {} };
  }, [map]);


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

  // Start/stop rectangle-object placement mode from sidebar
  const startRectObjectPlacement = useCallback((objectType) => {
    if (!draw.current) {
      console.warn('Draw controls not initialized, cannot activate rectangle placement');
      return;
    }
    try {
      const isActive = activeRectObjectTypeId === objectType.id;
      if (isActive) {
        draw.current.changeMode('simple_select');
        setActiveRectObjectTypeId(null);
      } else {
        setActiveRectObjectTypeId(objectType.id);
        draw.current.changeMode('draw_rect_object', { objectTypeId: objectType.id });
      }
    } catch (e) {
      console.warn('Failed to start rectangle placement', e);
    }
  }, [activeRectObjectTypeId]);

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

  // Force re-initialization of draw controls with race condition protection
  const reinitializeDrawControls = useCallback(() => {
    if (!map || !window.MapboxDraw) {
      console.warn('Cannot reinitialize: map or MapboxDraw not available');
      return;
    }
    console.log('Ensuring draw controls are bound...');
    const ensure = () => {
      try {
        const existingShapes = draw.current ? draw.current.getAll() : null;
        if (draw.current) {
          // Rebind by removing/adding control to inject layers for current style
          try {
            map.off('draw.create', eventHandlers.current.handleDrawCreate);
            map.off('draw.update', eventHandlers.current.handleDrawUpdate);
            map.off('draw.delete', eventHandlers.current.handleDrawDelete);
            map.off('draw.selectionchange', eventHandlers.current.handleSelectionChange);
          } catch (_) {}
          try { map.removeControl(draw.current); } catch (_) {}
          map.addControl(draw.current);
          map.on('draw.create', eventHandlers.current.handleDrawCreate);
          map.on('draw.update', eventHandlers.current.handleDrawUpdate);
          map.on('draw.delete', eventHandlers.current.handleDrawDelete);
          map.on('draw.selectionchange', eventHandlers.current.handleSelectionChange);
          if (existingShapes && existingShapes.features && existingShapes.features.length > 0) {
            try { draw.current.add(existingShapes); } catch (_) {}
          }
          // Keep availability true
          setDrawInitialized(true);
          return;
        }
        // No draw instance yet; create one
        const drawInstance = new window.MapboxDraw({
          displayControlsDefault: false,
          controls: {},
          defaultMode: 'simple_select',
          userProperties: true,
          modes: Object.assign({}, window.MapboxDraw.modes, { draw_rect_object: RectObjectMode })
        });
        draw.current = drawInstance;
        map.addControl(drawInstance);
        map.on('draw.create', eventHandlers.current.handleDrawCreate);
        map.on('draw.update', eventHandlers.current.handleDrawUpdate);
        map.on('draw.delete', eventHandlers.current.handleDrawDelete);
        map.on('draw.selectionchange', eventHandlers.current.handleSelectionChange);
        setDrawInitialized(true);
      } catch (error) {
        console.error('Error ensuring draw controls:', error);
      }
    };
    const styleReady = typeof map.isStyleLoaded === 'function' ? map.isStyleLoaded() : true;
    if (styleReady) ensure(); else map.once('style.load', ensure);
  }, [map]);

  // Reset active rect indicator when mode changes away from our custom mode
  useEffect(() => {
    if (!map) return;
    const onModeChange = (e) => {
      try {
        if (e?.mode !== 'draw_rect_object') {
          setActiveRectObjectTypeId(null);
        }
      } catch (_) {}
    };
    map.on('draw.modechange', onModeChange);
    return () => { try { map.off('draw.modechange', onModeChange); } catch (_) {} };
  }, [map]);

  // Manual initialization function for retry button
  const manualInitialize = useCallback(() => {
    console.log('Manual initialization requested');
    reinitializeDrawControls();
  }, [reinitializeDrawControls]);

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
    reinitializeDrawControls: manualInitialize, // Use manual initialize for UI retry
    forceReinitialize: reinitializeDrawControls, // Internal function for automatic reinit
    drawInitialized,
    showLabels,
    setShowLabels,
    startRectObjectPlacement,
    activeRectObjectTypeId
  };
};