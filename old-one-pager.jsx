import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Map, Layers, Download, Upload, Pencil, Square, Circle, Type, Trash2, Eye, EyeOff, Settings, Info, Search, X, FileImage, FileText, Grid3X3, ChevronRight, Home, ZoomIn } from 'lucide-react';

const EventStager = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const draw = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [layers, setLayers] = useState({
    permitAreas: { visible: true, name: 'NYC Permit Areas', color: '#f97316', loading: true, id: 'permit-areas' },
    bikeLanes: { visible: false, name: 'Bike Lanes', color: '#2563eb', loading: false },
    trees: { visible: false, name: 'Street Trees', color: '#22c55e', loading: false },
    hydrants: { visible: false, name: 'Fire Hydrants', color: '#ef4444', loading: false },
    parking: { visible: false, name: 'Parking Meters', color: '#3b82f6', loading: false },
    benches: { visible: false, name: 'Public Benches', color: '#8b5cf6', loading: false },
    streetlights: { visible: false, name: 'Street Lights', color: '#f59e0b', loading: false },
    busStops: { visible: false, name: 'Bus Stops', color: '#dc2626', loading: false }
  });
  const [customShapes, setCustomShapes] = useState([]);
  const [selectedShape, setSelectedShape] = useState(null);
  const [shapeLabel, setShapeLabel] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  // Add state for drag and drop objects
  const [droppedObjects, setDroppedObjects] = useState([]);
  const [draggedObject, setDraggedObject] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [objectUpdateTrigger, setObjectUpdateTrigger] = useState(0);
  const [permitAreas, setPermitAreas] = useState([]);
  const [permitAreaSearch, setPermitAreaSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [focusedArea, setFocusedArea] = useState(null);
  const [showFocusInfo, setShowFocusInfo] = useState(false);
  
  // Add state for handling overlapping permit areas
  const [overlappingAreas, setOverlappingAreas] = useState([]);
  const [selectedOverlapIndex, setSelectedOverlapIndex] = useState(0);
  const [showOverlapSelector, setShowOverlapSelector] = useState(false);
  const [clickPosition, setClickPosition] = useState({ x: 0, y: 0 });
  
  // Add state for tracking infrastructure data loading
  const [infrastructureData, setInfrastructureData] = useState({
    trees: null,
    hydrants: null,
    parking: null,
    benches: null,
    streetlights: null,
    busStops: null
  });
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: null });

  // Define placeable objects
  const placeableObjects = [
    {
      id: 'grill',
      name: 'Grill',
      category: 'Equipment',
      icon: '🔥', // Placeholder - will be replaced with actual icon
      color: '#dc2626',
      size: { width: 40, height: 40 }
    },
    {
      id: 'trash-bag',
      name: 'Trash Bag',
      category: 'Waste Management',
      icon: '🗑️', // Placeholder - will be replaced with actual icon
      color: '#374151',
      size: { width: 30, height: 30 }
    }
  ];

  // Initialize map
  useEffect(() => {
    console.log('=== Starting Map Setup ===');
    if (!mapContainer.current) {
      console.error('Map container not ready');
      return;
    }

    // Load CSS files
    const loadCSS = () => {
      // MapLibre CSS
      if (!document.querySelector('link[href*="maplibre-gl.css"]')) {
        const mapCSS = document.createElement('link');
        mapCSS.rel = 'stylesheet';
        mapCSS.href = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css';
        document.head.appendChild(mapCSS);
        console.log('Added MapLibre CSS');
      }

      // Draw CSS
      if (!document.querySelector('link[href*="mapbox-gl-draw.css"]')) {
        const drawCSS = document.createElement('link');
        drawCSS.rel = 'stylesheet';
        drawCSS.href = 'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.3/mapbox-gl-draw.css';
        document.head.appendChild(drawCSS);
        console.log('Added Draw CSS');
      }

      // Stadia Maps Search Box CSS
      if (!document.querySelector('link[href*="maplibre-search-box.css"]')) {
        const searchCSS = document.createElement('link');
        searchCSS.rel = 'stylesheet';
        searchCSS.href = 'https://unpkg.com/@stadiamaps/maplibre-search-box/dist/maplibre-search-box.css';
        document.head.appendChild(searchCSS);
        console.log('Added Stadia Maps Search Box CSS');
      }
    };

    // Initialize map when scripts are ready
    const initializeMap = () => {
      console.log('Initializing map...');
      console.log('Container dimensions:', {
        width: mapContainer.current?.offsetWidth,
        height: mapContainer.current?.offsetHeight
      });

      try {
        const mapInstance = new window.maplibregl.Map({
          container: mapContainer.current,
          style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
          center: [-73.985, 40.758],
          zoom: 16,
          preserveDrawingBuffer: true // Enable canvas export
        });

        map.current = mapInstance;
        console.log('Map instance created');

        // Hide loading immediately
        setMapLoaded(true);

        mapInstance.on('load', () => {
          console.log('Map loaded');
          
          // Add controls
          mapInstance.addControl(new window.maplibregl.NavigationControl(), 'top-right');
          mapInstance.addControl(new window.maplibregl.ScaleControl(), 'bottom-right');

          // Add search control
          if (window.maplibreSearchBox) {
            const searchControl = new window.maplibreSearchBox.MapLibreSearchControl({
              useMapFocusPoint: true,
              mapFocusPointMinZoom: 10,
              maxResults: 5,
              minInputLength: 2,
              searchOnEnter: true,
              onResultSelected: (feature) => {
                console.log('Search result selected:', feature);
                // Optionally zoom to the result if not already handled by the control
                if (feature.bbox) {
                  mapInstance.fitBounds(feature.bbox, { padding: 50 });
                } else if (feature.geometry && feature.geometry.type === 'Point') {
                  mapInstance.flyTo({
                    center: feature.geometry.coordinates,
                    zoom: 16
                  });
                }
              }
            });
            mapInstance.addControl(searchControl, 'top-left');
            console.log('Search control added');
          } else {
            console.warn('Search box not available');
          }

          // Load permit areas layer
          loadPermitAreas();

          // Initialize draw controls if available
          if (window.MapboxDraw) {
            const drawInstance = new window.MapboxDraw({
              displayControlsDefault: false,
              controls: {},
              defaultMode: 'simple_select'
            });
            
            draw.current = drawInstance;
            mapInstance.addControl(drawInstance);
            console.log('Draw controls added');

            // Set up event handlers
            mapInstance.on('draw.create', handleDrawCreate);
            mapInstance.on('draw.update', handleDrawUpdate);
            mapInstance.on('draw.delete', handleDrawDelete);
            mapInstance.on('draw.selectionchange', handleSelectionChange);
          }
        });

        mapInstance.on('error', (e) => {
          console.error('Map error:', e);
        });

      } catch (error) {
        console.error('Failed to create map:', error);
        setMapLoaded(false);
      }
    };
    
    // Function to load permit areas
    const loadPermitAreas = () => {
      if (!map.current) return;
      
      // Update loading state
      setLayers(prev => ({
        ...prev,
        permitAreas: { ...prev.permitAreas, loading: true }
      }));
      
      // Use fetch to get the permit areas data
      fetch('/data/permit-areas/nyc_20250611_122007.geojson')
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          if (!map.current) return;
          
          // Store the permit areas for search functionality
          if (data.features && Array.isArray(data.features)) {
            setPermitAreas(data.features);
            console.log(`Indexed ${data.features.length} permit areas for search`);
          }
          
          // Add source
          map.current.addSource('permit-areas', {
            type: 'geojson',
            data: data
          });
          
          // Add fill layer
          map.current.addLayer({
            id: 'permit-areas-fill',
            type: 'fill',
            source: 'permit-areas',
            paint: {
              'fill-color': layers.permitAreas.color,
              'fill-opacity': 0.2
            }
          });
          
          // Add outline layer
          map.current.addLayer({
            id: 'permit-areas-outline',
            type: 'line',
            source: 'permit-areas',
            paint: {
              'line-color': layers.permitAreas.color,
              'line-width': 1
            }
          });
          
          // Add focused highlight layers (initially invisible)
          map.current.addLayer({
            id: 'permit-areas-focused-fill',
            type: 'fill',
            source: 'permit-areas',
            filter: ['==', 'id', ''],
            paint: {
              'fill-color': '#3b82f6',
              'fill-opacity': 0.3
            }
          });
          
          map.current.addLayer({
            id: 'permit-areas-focused-outline',
            type: 'line',
            source: 'permit-areas',
            filter: ['==', 'id', ''],
            paint: {
              'line-color': '#3b82f6',
              'line-width': 3,
              'line-dasharray': [1, 1]
            }
          });
          
          // Setup event listeners
          setupTooltipListeners();
          setupPermitAreaClickListeners();
          
          // Update state
          setLayers(prev => ({
            ...prev,
            permitAreas: { ...prev.permitAreas, loading: false }
          }));
          
          console.log('Permit areas loaded');
        })
        .catch(error => {
          console.error('Error loading permit areas:', error);
          setLayers(prev => ({
            ...prev,
            permitAreas: { ...prev.permitAreas, loading: false, error: true }
          }));
        });
    };
    
    // Setup tooltip event listeners for permit areas
    const setupTooltipListeners = () => {
      if (!map.current) return;
      
      // Change cursor to pointer when mouse is over a permit area
      map.current.on('mouseenter', 'permit-areas-fill', () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });
      
      // Restore cursor when mouse leaves permit area
      map.current.on('mouseleave', 'permit-areas-fill', () => {
        map.current.getCanvas().style.cursor = '';
        // Hide tooltip
        setTooltip(prev => ({ ...prev, visible: false }));
      });
      
      // Show tooltip content on mousemove
      map.current.on('mousemove', 'permit-areas-fill', (e) => {
        if (e.features.length === 0) return;
        
        // Get feature properties
        const feature = e.features[0].properties;
        
        // Construct tooltip content based on available properties
        const tooltipContent = buildTooltipContent(feature);
        
        // Only show tooltip if we have content
        if (tooltipContent) {
          setTooltip({
            visible: true,
            x: e.point.x,
            y: e.point.y,
            content: tooltipContent
          });
        }
      });
    };
    
    // Build tooltip content based on available properties
    const buildTooltipContent = (properties) => {
      if (!properties) return null;
      
      const fields = [];
      
      // Check for each field and add if available
      if (properties.propertyname) {
        fields.push({ label: 'Property', value: properties.propertyname });
      }
      
      if (properties.subpropertyname) {
        fields.push({ label: 'Sub-Property', value: properties.subpropertyname });
      }
      
      if (properties.name) {
        fields.push({ label: 'Name', value: properties.name });
      }
      
      return fields.length > 0 ? fields : null;
    };

    // Load scripts and initialize
    const loadAndInit = () => {
      loadCSS();

      // Stadia Maps Search Box
      const loadSearchBox = () => {
        if (window.maplibreSearchBox) {
          console.log('Search box already loaded');
          return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
          const searchScript = document.createElement('script');
          searchScript.src = 'https://unpkg.com/@stadiamaps/maplibre-search-box/dist/maplibre-search-box.umd.js';
          searchScript.onload = () => {
            console.log('Search box loaded');
            resolve();
          };
          searchScript.onerror = (e) => {
            console.error('Failed to load search box:', e);
            reject(e);
          };
          document.head.appendChild(searchScript);
        });
      };

      // Check if MapLibre is already available
      if (window.maplibregl) {
        console.log('MapLibre already loaded');
        
        Promise.all([
          window.MapboxDraw ? Promise.resolve() : loadDrawScript(),
          loadSearchBox()
        ]).then(() => {
          initializeMap();
        }).catch(error => {
          console.error('Error loading dependencies:', error);
          setMapLoaded(false);
        });
        
        return;
      }

      // Load MapLibre
      console.log('Loading MapLibre...');
      const mapScript = document.createElement('script');
      mapScript.src = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js';
      
      mapScript.onload = () => {
        console.log('MapLibre loaded successfully');
        
        // Load Draw and Search Box in parallel
        Promise.all([
          loadDrawScript(),
          loadSearchBox()
        ]).then(() => {
          // Small delay to ensure everything is ready
          setTimeout(initializeMap, 100);
        }).catch(error => {
          console.error('Error loading dependencies:', error);
          setMapLoaded(false);
        });
      };
      
      mapScript.onerror = (e) => {
        console.error('Failed to load MapLibre:', e);
        setMapLoaded(false);
      };
      
      document.head.appendChild(mapScript);
      
      // Function to load Draw script
      function loadDrawScript() {
        if (window.MapboxDraw) {
          return Promise.resolve();
        }
        
        return new Promise((resolve, reject) => {
          const drawScript = document.createElement('script');
          drawScript.src = 'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.3/mapbox-gl-draw.js';
          drawScript.onload = () => {
            console.log('Draw loaded successfully');
            resolve();
          };
          drawScript.onerror = (e) => {
            console.error('Failed to load Draw:', e);
            reject(e);
          };
          document.head.appendChild(drawScript);
        });
      }
    };

    loadAndInit();

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  const toggleLayer = (layerId) => {
    // Only allow toggling non-permit layers if an area is focused
    if (layerId !== 'permitAreas' && !focusedArea) {
      console.log('Please focus on a permit area first to enable infrastructure layers');
      return;
    }
    
    // Update state
    setLayers(prev => ({
      ...prev,
      [layerId]: { ...prev[layerId], visible: !prev[layerId].visible }
    }));
    
    // If it's the permit areas layer, toggle visibility
    if (layerId === 'permitAreas' && map.current) {
      const visibility = !layers[layerId].visible ? 'visible' : 'none';
      
      // Check if the layers exist first
      if (map.current.getLayer('permit-areas-fill')) {
        map.current.setLayoutProperty('permit-areas-fill', 'visibility', visibility);
      }
      if (map.current.getLayer('permit-areas-outline')) {
        map.current.setLayoutProperty('permit-areas-outline', 'visibility', visibility);
      }
      
      console.log(`Layer ${layerId} visibility set to ${visibility}`);
    } else if (focusedArea) {
      // Infrastructure layer toggling
      const willBeVisible = !layers[layerId].visible;
      
      if (willBeVisible) {
        // Load the layer if turning on
        loadInfrastructureLayer(layerId);
      } else {
        // Just toggle visibility if turning off
        toggleInfrastructureLayerVisibility(layerId, false);
      }
      
      console.log(`Layer ${layerId} visibility set to ${willBeVisible ? 'visible' : 'hidden'}`);
    }
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

  const updateShapeLabel = () => {
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
  };

  // Function to handle object drag start
  const handleObjectDragStart = (e, objectType) => {
    const rect = e.target.getBoundingClientRect();
    setDraggedObject(objectType);
    setDragOffset({
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2
    });
    
    // Add visual feedback
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', objectType.id);
  };

  // Function to handle drag over map
  const handleMapDragOver = (e) => {
    if (draggedObject) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  // Function to handle drop on map
  const handleMapDrop = (e) => {
    if (!draggedObject || !map.current) return;
    
    e.preventDefault();
    
    // Get map container bounds
    const mapContainer = map.current.getContainer();
    const mapRect = mapContainer.getBoundingClientRect();
    
    // Calculate position relative to map
    const x = e.clientX - mapRect.left - dragOffset.x;
    const y = e.clientY - mapRect.top - dragOffset.y;
    
    // Convert pixel position to lat/lng
    const lngLat = map.current.unproject([x, y]);
    
    // Create new dropped object
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
  };

  // Function to remove dropped object
  const removeDroppedObject = (objectId) => {
    setDroppedObjects(prev => prev.filter(obj => obj.id !== objectId));
  };

  // Function to get object style
  const getObjectStyle = useCallback((object) => {
    const objectType = placeableObjects.find(p => p.id === object.type);
    if (!objectType || !map.current) return { display: 'none' };
    
    // Convert lat/lng to current screen coordinates
    const pixel = map.current.project([object.position.lng, object.position.lat]);
    
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
      transform: 'translateZ(0)', // Force GPU acceleration
      willChange: 'transform' // Optimize for frequent changes
    };
  }, [placeableObjects]);

  // Update objects positions when map moves
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    
    let rafId = null;
    
    const updateObjectPositions = () => {
      // Cancel any pending animation frame
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      
      // Use requestAnimationFrame for smooth updates
      rafId = requestAnimationFrame(() => {
        // Use a simple counter to trigger re-renders
        setObjectUpdateTrigger(prev => prev + 1);
      });
    };
    
    // Add event listeners after map is loaded
    const addEventListeners = () => {
      if (!map.current) return;
      
      // Listen to all possible map change events
      const events = [
        'move',
        'moveend', 
        'zoom',
        'zoomend',
        'rotate',
        'rotateend',
        'pitch',
        'pitchend',
        'resize',
        'wheel',
        'touchmove',
        'touchend'
      ];
      
      events.forEach(event => {
        map.current.on(event, updateObjectPositions);
      });
      
      console.log('Added event listeners for object positioning');
    };
    
    // Remove event listeners
    const removeEventListeners = () => {
      if (!map.current) return;
      
      const events = [
        'move',
        'moveend', 
        'zoom',
        'zoomend',
        'rotate',
        'rotateend',
        'pitch',
        'pitchend',
        'resize',
        'wheel',
        'touchmove',
        'touchend'
      ];
      
      events.forEach(event => {
        map.current.off(event, updateObjectPositions);
      });
    };
    
    // Add listeners immediately if map is loaded, or wait for load event
    if (map.current.loaded()) {
      addEventListeners();
    } else {
      map.current.once('load', addEventListeners);
    }
    
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      removeEventListeners();
    };
  }, [mapLoaded]); // Depend on mapLoaded to ensure map is ready

  // Clear dropped objects when focus changes
  useEffect(() => {
    if (focusedArea) {
      // Load infrastructure data for layers that are visible
      Object.entries(layers).forEach(([layerId, config]) => {
        if (layerId !== 'permitAreas' && config.visible) {
          loadInfrastructureLayer(layerId);
        }
      });
    } else {
      // Remove all infrastructure layers and clear dropped objects when focus is cleared
      if (map.current) {
        ['trees', 'hydrants', 'parking', 'benches', 'streetlights', 'busStops'].forEach(layerId => {
          removeInfrastructureLayer(layerId);
        });
      }
    }
  }, [focusedArea]);

  // Function to export event plan
  const exportPlan = () => {
    if (!map.current || !draw.current) return;
    
    const data = {
      metadata: {
        created: new Date().toISOString(),
        center: map.current.getCenter(),
        zoom: map.current.getZoom(),
        bounds: map.current.getBounds().toArray()
      },
      layers: layers,
      customShapes: draw.current.getAll(),
      droppedObjects: droppedObjects // Include dropped objects in export
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-plan-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const importPlan = (e) => {
    const file = e.target.files[0];
    if (file && map.current && draw.current) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          
          if (data.metadata) {
            map.current.setCenter(data.metadata.center);
            map.current.setZoom(data.metadata.zoom);
          }
          
          if (data.customShapes) {
            draw.current.set(data.customShapes);
            setCustomShapes(data.customShapes.features.map(f => ({
              id: f.id,
              type: f.geometry.type,
              label: f.properties.label || '',
              properties: f.properties
            })));
          }
          
          // Import dropped objects
          if (data.droppedObjects) {
            setDroppedObjects(data.droppedObjects);
          }
        } catch (error) {
          console.error('Error importing plan:', error);
          alert('Error importing plan. Please check the file format.');
        }
      };
      reader.readAsText(file);
    }
  };

  const activateDrawingTool = (mode) => {
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
  };

  // Use effect for permit area search filtering
  useEffect(() => {
    if (!permitAreaSearch.trim() || permitAreaSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    // Simple search with debouncing
    const timer = setTimeout(() => {
      const query = permitAreaSearch.toLowerCase().trim();
      
      const results = permitAreas
        .filter(area => {
          const name = (area.properties.name || '').toLowerCase();
          const propertyName = (area.properties.propertyname || '').toLowerCase();
          const subPropertyName = (area.properties.subpropertyname || '').toLowerCase();
          
          return name.includes(query) || 
                 propertyName.includes(query) || 
                 subPropertyName.includes(query);
        })
        .slice(0, 10); // Limit to 10 results for performance
      
      setSearchResults(results);
      setIsSearching(false);
    }, 250);
    
    return () => clearTimeout(timer);
  }, [permitAreaSearch, permitAreas]);

  // Function to highlight search term in text
  const highlightSearchTerm = (text, term) => {
    if (!text || !term.trim()) return text;
    
    const regex = new RegExp(`(${term.trim()})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? <span key={index} className="search-highlight">{part}</span> : part
    );
  };

  // Function to fly to permit area
  const flyToPermitArea = (permitArea) => {
    if (!map.current || !permitArea) return;
    
    // Set focus on the permit area
    focusOnPermitArea(permitArea);
    
    // Clear search results
    setSearchResults([]);
    setPermitAreaSearch('');
  };

  // Calculate bounds for a geometry
  const calculateGeometryBounds = (geometry) => {
    if (!geometry || !geometry.coordinates) return null;
    
    let coordinates = [];
    
    if (geometry.type === 'Polygon') {
      coordinates = geometry.coordinates[0]; // Outer ring
    } else if (geometry.type === 'MultiPolygon') {
      // Flatten all coordinates from all polygons
      geometry.coordinates.forEach(polygon => {
        coordinates = coordinates.concat(polygon[0]);
      });
    } else {
      return null;
    }
    
    if (coordinates.length === 0) return null;
    
    // Find min/max coords
    let minX = coordinates[0][0];
    let minY = coordinates[0][1];
    let maxX = coordinates[0][0];
    let maxY = coordinates[0][1];
    
    coordinates.forEach(coord => {
      minX = Math.min(minX, coord[0]);
      minY = Math.min(minY, coord[1]);
      maxX = Math.max(maxX, coord[0]);
      maxY = Math.max(maxY, coord[1]);
    });
    
    return [[minX, minY], [maxX, maxY]];
  };

  // Function to focus on a specific permit area
  const focusOnPermitArea = (permitArea) => {
    if (!map.current || !permitArea) return;
    
    console.log('Focusing on permit area:', permitArea.properties);
    
    // Set the focused area state
    setFocusedArea(permitArea);
    setShowFocusInfo(true);
    
    // Get the area ID for filtering
    const areaId = permitArea.id || permitArea.properties.id || permitArea.properties.OBJECTID;
    
    if (areaId) {
      // Update the focused area highlight layers
      if (map.current.getLayer('permit-areas-focused-fill')) {
        map.current.setFilter('permit-areas-focused-fill', ['==', 'id', areaId]);
        map.current.setFilter('permit-areas-focused-outline', ['==', 'id', areaId]);
      }
    }
    
    // Calculate bounds and fit map view
    const bounds = calculateGeometryBounds(permitArea.geometry);
    if (bounds) {
      // Add some padding around the area
      const padding = 50;
      
      try {
        map.current.fitBounds(bounds, {
          padding: padding,
          maxZoom: 18,
          duration: 1000
        });
      } catch (error) {
        console.error('Error fitting bounds:', error);
        // Fallback to center point
        if (permitArea.geometry && permitArea.geometry.type === 'Point') {
          map.current.flyTo({
            center: permitArea.geometry.coordinates,
            zoom: 16,
            duration: 1000
          });
        }
      }
    }
    
    console.log('Permit area focused successfully');
  };

  // Enhanced function to setup permit area click listeners with overlap handling
  const setupPermitAreaClickListeners = () => {
    if (!map.current) return;
    
    // Single click to handle overlapping areas
    map.current.on('click', 'permit-areas-fill', (e) => {
      if (e.features.length === 0) return;
      
      // Prevent event propagation
      e.preventDefault();
      
      // Get ALL features at this click point (including overlapping ones)
      const point = [e.point.x, e.point.y];
      const allFeatures = map.current.queryRenderedFeatures(point, {
        layers: ['permit-areas-fill']
      });
      
      console.log(`Found ${allFeatures.length} overlapping features at click point`);
      
      // Store click position for overlay menu
      setClickPosition({ x: e.point.x, y: e.point.y });
      
      if (allFeatures.length > 1) {
        // Multiple overlapping areas - show selector
        console.log('Multiple areas detected, showing selector');
        setOverlappingAreas(allFeatures);
        setSelectedOverlapIndex(0);
        setShowOverlapSelector(true);
        
        // Highlight all overlapping areas temporarily
        highlightOverlappingAreas(allFeatures);
      } else {
        // Single area - focus directly
        console.log('Single area detected, focusing directly');
        focusOnPermitArea(allFeatures[0]);
        setShowOverlapSelector(false);
      }
    });
    
    // Double click for direct focus (bypass overlap selector)
    map.current.on('dblclick', 'permit-areas-fill', (e) => {
      if (e.features.length === 0) return;
      
      e.preventDefault();
      console.log('Double-click detected, focusing on top feature');
      const feature = e.features[0];
      focusOnPermitArea(feature);
      setShowOverlapSelector(false);
      clearOverlapHighlights();
    });
    
    // Click elsewhere to hide overlap selector
    map.current.on('click', (e) => {
      // Check if click was on a permit area
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ['permit-areas-fill']
      });
      
      if (features.length === 0) {
        console.log('Clicked outside permit areas, hiding selector');
        setShowOverlapSelector(false);
        clearOverlapHighlights();
      }
    });
  };

  // Function to select an overlapping area
  const selectOverlappingArea = (index) => {
    console.log(`Selecting overlapping area at index ${index}`);
    
    if (index < 0 || index >= overlappingAreas.length) {
      console.error('Invalid index for overlapping area selection');
      return;
    }
    
    setSelectedOverlapIndex(index);
    const selectedFeature = overlappingAreas[index];
    
    console.log('Selected feature:', selectedFeature.properties);
    
    // Focus on the selected area
    focusOnPermitArea(selectedFeature);
    
    // Hide the selector and clear highlights
    setShowOverlapSelector(false);
    clearOverlapHighlights();
  };

  // Function to highlight overlapping areas
  const highlightOverlappingAreas = (features) => {
    if (!map.current) return;
    
    // Extract feature IDs - try multiple possible ID fields
    const featureIds = features.map(f => {
      return f.id || f.properties.id || f.properties.OBJECTID || f.properties.fid;
    }).filter(id => id !== undefined && id !== null);
    
    console.log('Highlighting overlapping areas with IDs:', featureIds);
    
    // Remove existing overlap highlight layer
    if (map.current.getLayer('permit-areas-overlap-highlight')) {
      map.current.removeLayer('permit-areas-overlap-highlight');
    }
    
    if (featureIds.length === 0) {
      console.warn('No valid feature IDs found for highlighting');
      return;
    }
    
    try {
      // Add highlight layer for overlapping areas
      map.current.addLayer({
        id: 'permit-areas-overlap-highlight',
        type: 'line',
        source: 'permit-areas',
        filter: ['in', ['get', 'id'], ['literal', featureIds]],
        paint: {
          'line-color': '#ff6b35',
          'line-width': 3,
          'line-dasharray': [1, 1],
          'line-opacity': 0.8
        }
      });
      
      console.log('Overlap highlight layer added successfully');
    } catch (error) {
      console.error('Error adding overlap highlight layer:', error);
    }
  };

  // Enhanced clear focus function
  const clearFocus = () => {
    console.log('Clearing focus');
    
    setFocusedArea(null);
    setShowFocusInfo(false);
    setShowOverlapSelector(false);
    clearOverlapHighlights();
    
    // Reset the focused area filters
    if (map.current && map.current.getLayer('permit-areas-focused-fill')) {
      map.current.setFilter('permit-areas-focused-fill', ['==', 'id', '']);
      map.current.setFilter('permit-areas-focused-outline', ['==', 'id', '']);
    }
    
    // Remove all infrastructure layers when focus is cleared
    if (map.current) {
      ['trees', 'hydrants', 'parking', 'benches', 'streetlights', 'busStops'].forEach(layerId => {
        removeInfrastructureLayer(layerId);
      });
    }
    
    // Reset infrastructure data cache
    setInfrastructureData({
      trees: null,
      hydrants: null,
      parking: null,
      benches: null,
      streetlights: null,
      busStops: null
    });
    
    // Reset layer visibility states to false (except permit areas)
    setLayers(prev => ({
      ...prev,
      bikeLanes: { ...prev.bikeLanes, visible: false, loading: false },
      trees: { ...prev.trees, visible: false, loading: false },
      hydrants: { ...prev.hydrants, visible: false, loading: false },
      parking: { ...prev.parking, visible: false, loading: false },
      benches: { ...prev.benches, visible: false, loading: false },
      streetlights: { ...prev.streetlights, visible: false, loading: false },
      busStops: { ...prev.busStops, visible: false, loading: false }
    }));
    
    // Clear dropped objects
    setDroppedObjects([]);
  };

  // Effect to handle loading data when focus changes
  useEffect(() => {
    if (focusedArea) {
      // Load infrastructure data for layers that are visible
      Object.entries(layers).forEach(([layerId, config]) => {
        if (layerId !== 'permitAreas' && config.visible) {
          loadInfrastructureLayer(layerId);
        }
      });
    } else {
      // Remove all infrastructure layers when focus is cleared
      if (map.current) {
        ['trees', 'hydrants', 'parking', 'benches', 'streetlights', 'busStops'].forEach(layerId => {
          removeInfrastructureLayer(layerId);
        });
      }
    }
  }, [focusedArea]);

  // Helper function to get the correct API endpoint and field name for each infrastructure type
  const getInfrastructureEndpoint = (layerId) => {
    switch(layerId) {
      case 'bikeLanes':
        return {
          baseUrl: 'https://data.cityofnewyork.us/resource/mzxg-pwib.geojson',
          geoField: 'the_geom',
          isLocal: false
        };
      case 'trees':
        return {
          baseUrl: 'https://data.cityofnewyork.us/resource/hn5i-inap.geojson',
          geoField: 'location',
          isLocal: false
        };
      case 'hydrants':
        return {
          baseUrl: 'https://data.cityofnewyork.us/resource/5bgh-vtsn.geojson',
          geoField: 'the_geom',
          isLocal: false
        };
      case 'parking':
        return {
          baseUrl: 'https://data.cityofnewyork.us/resource/hn5i-inap.geojson',
          geoField: 'location',
          isLocal: false
        };
      case 'benches':
        return {
          baseUrl: 'https://data.cityofnewyork.us/resource/hn5i-inap.geojson',
          geoField: 'location',
          isLocal: false
        };
      case 'streetlights':
        return {
          baseUrl: 'https://data.cityofnewyork.us/resource/hn5i-inap.geojson',
          geoField: 'location',
          isLocal: false
        };
      case 'busStops':
        return {
          baseUrl: '/data/static/gtfs/bus_stops_nyc.geojson',
          geoField: null, // Not applicable for local files
          isLocal: true
        };
      default:
        return {
          baseUrl: 'https://data.cityofnewyork.us/resource/hn5i-inap.geojson',
          geoField: 'location',
          isLocal: false
        };
    }
  };

  // Function to filter features by type based on their properties
  const filterFeaturesByType = (features, layerId) => {
    if (!features || !Array.isArray(features)) return [];
    
    // Map to ensure each feature is complete and valid
    return features.filter(feature => {
      if (!feature || !feature.properties) return false;
      
      const props = feature.properties || {};
      
      // Check for different patterns in properties to identify feature types
      switch(layerId) {
        case 'trees':
          return props.genusspecies || 
                props.tpstructure || 
                (props.dbh && Number(props.dbh) > 0) ||
                Object.values(props).some(val => 
                  typeof val === 'string' && val.toLowerCase().includes('tree')
                );
        
        case 'hydrants':
          return Object.values(props).some(val => 
            typeof val === 'string' && val.toLowerCase().includes('hydrant')
          );
          
        case 'parking':
          return Object.values(props).some(val => 
            typeof val === 'string' && (
              val.toLowerCase().includes('meter') ||
              val.toLowerCase().includes('parking')
            )
          );
          
        case 'benches':
          return Object.values(props).some(val => 
            typeof val === 'string' && val.toLowerCase().includes('bench')
          );
          
        case 'streetlights':
          return Object.values(props).some(val => 
            typeof val === 'string' && (
              val.toLowerCase().includes('light') ||
              val.toLowerCase().includes('lamp')
            )
          );
          
        case 'busStops':
          // Bus stops from GTFS data - no filtering needed, all features are bus stops
          return true;
          
        default:
          return false;
      }
    }).map(feature => {
      // Ensure each feature has proper structure
      return {
        type: 'Feature',
        geometry: feature.geometry || { type: 'Point', coordinates: [0, 0] },
        properties: feature.properties || {}
      };
    });
  };

  // Function to load infrastructure data
  const loadInfrastructureLayer = (layerId) => {
    if (!map.current || !focusedArea) return;
    
    // Skip if data is already loaded
    if (infrastructureData[layerId]) {
      toggleInfrastructureLayerVisibility(layerId, true);
      return;
    }

    // Update loading state
    setLayers(prev => ({
      ...prev,
      [layerId]: { ...prev[layerId], loading: true }
    }));
    
    // Get the correct endpoint and field name for this layer type
    const { baseUrl, geoField, isLocal } = getInfrastructureEndpoint(layerId);
    
    let url;
    
    if (isLocal) {
      // For local files, use the path directly
      url = baseUrl;
      console.log(`Loading ${layerId} from local file: ${url}`);
    } else {
      // For API endpoints, build URL with bbox filter
      const bounds = calculateGeometryBounds(focusedArea.geometry);
      if (!bounds) return;
      
      // Convert bounds to a format usable for filtering the API request
      // Expand bounds slightly to make sure we get all features
      const expandFactor = 0.001; // Expand by about 100 meters
      const minLng = bounds[0][0] - expandFactor;
      const minLat = bounds[0][1] - expandFactor;
      const maxLng = bounds[1][0] + expandFactor;
      const maxLat = bounds[1][1] + expandFactor;
      
      // Build URL with correct field name
      const bboxFilter = `$where=within_box(${geoField}, ${minLat}, ${minLng}, ${maxLat}, ${maxLng})`;
      url = `${baseUrl}?${bboxFilter}&$limit=5000`;
      console.log(`Loading ${layerId} from API: ${url}`);
    }
    
    fetch(url)
      .then(async response => {
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API Error (${response.status}): ${errorText}`);
          throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
        }
        return response.json();
      })
      .then(data => {
        if (!map.current || !focusedArea) return;
        
        try {
          // Ensure data has features array
          if (!data.features || !Array.isArray(data.features)) {
            console.warn('No features found in response');
            data.features = [];
          }
          
          let filteredFeatures = data.features;
          
          // For local files (like bus stops), filter by geometry bounds
          if (isLocal) {
            const bounds = calculateGeometryBounds(focusedArea.geometry);
            if (bounds) {
              // Filter features that are within the focused area bounds
              filteredFeatures = data.features.filter(feature => {
                if (!feature.geometry || feature.geometry.type !== 'Point') return false;
                
                const [lng, lat] = feature.geometry.coordinates;
                return lng >= bounds[0][0] && lng <= bounds[1][0] && 
                       lat >= bounds[0][1] && lat <= bounds[1][1];
              });
            }
          } else {
            // For API endpoints, apply type filtering (except for hydrants)
            if (layerId !== 'hydrants') {
              filteredFeatures = filterFeaturesByType(data.features, layerId);
            }
          }
          
          const filteredData = {
            type: 'FeatureCollection',
            features: filteredFeatures,
            crs: data.crs || { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } }
          };
          
          // Log success with feature count
          console.log(`Loaded ${layerId}: ${filteredData.features.length} features found`);
          
          // Save the data for reuse
          setInfrastructureData(prev => ({
            ...prev,
            [layerId]: filteredData
          }));
          
          // Remove existing source and layer if they exist
          removeInfrastructureLayer(layerId);
          
          // Add source
          const sourceId = `source-${layerId}`;
          map.current.addSource(sourceId, {
            type: 'geojson',
            data: filteredData
          });
          
          // Add layer with specialized styling for each type
          const pointLayerId = `layer-${layerId}-point`;
          const layerStyle = getLayerStyle(layerId);
          
          map.current.addLayer({
            id: pointLayerId,
            type: layerStyle.type,
            source: sourceId,
            paint: layerStyle.paint
          });
          
          // Add hover effect
          map.current.on('mouseenter', pointLayerId, () => {
            map.current.getCanvas().style.cursor = 'pointer';
          });
          
          map.current.on('mouseleave', pointLayerId, () => {
            map.current.getCanvas().style.cursor = '';
          });
          
          // Add click event to show details
          map.current.on('click', pointLayerId, (e) => {
            if (e.features.length === 0) return;
            
            // Show details in a tooltip
            const feature = e.features[0];
            const props = feature.properties;
            
            // Create tooltip content based on the layer type
            const content = createTooltipContent(props, layerId);
            
            setTooltip({
              visible: true,
              x: e.point.x,
              y: e.point.y,
              content: content
            });
          });
          
          // Update loading state
          setLayers(prev => ({
            ...prev,
            [layerId]: { ...prev[layerId], loading: false }
          }));
        } catch (error) {
          console.error(`Error processing ${layerId} data:`, error);
          
          // Update loading state
          setLayers(prev => ({
            ...prev,
            [layerId]: { ...prev[layerId], loading: false, error: true, visible: false }
          }));
        }
      })
      .catch(error => {
        console.error(`Error loading ${layerId}:`, error);
        
        // Show more user-friendly error message
        alert(`Failed to load ${layers[layerId].name}. The data may not be available for this area.`);
        
        // Update loading state
        setLayers(prev => ({
          ...prev,
          [layerId]: { ...prev[layerId], loading: false, error: true, visible: false }
        }));
      });
  };
  
  // Remove infrastructure layer and source
  const removeInfrastructureLayer = (layerId) => {
    if (!map.current) return;
    
    const pointLayerId = `layer-${layerId}-point`;
    const sourceId = `source-${layerId}`;
    
    try {
      // Remove layer if it exists
      if (map.current.getLayer(pointLayerId)) {
        // Remove event listeners
        map.current.off('mouseenter', pointLayerId);
        map.current.off('mouseleave', pointLayerId);
        map.current.off('click', pointLayerId);
        
        map.current.removeLayer(pointLayerId);
        console.log(`Removed layer ${pointLayerId}`);
      }
      
      // Remove source if it exists
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
        console.log(`Removed source ${sourceId}`);
      }
    } catch (error) {
      console.error(`Error removing ${layerId} layer/source:`, error);
    }
  };

  // Toggle infrastructure layer visibility
  const toggleInfrastructureLayerVisibility = (layerId, visible) => {
    if (!map.current) return;
    
    const pointLayerId = `layer-${layerId}-point`;
    
    try {
      // Set visibility if layer exists
      if (map.current.getLayer(pointLayerId)) {
        map.current.setLayoutProperty(
          pointLayerId,
          'visibility',
          visible ? 'visible' : 'none'
        );
        console.log(`Set ${pointLayerId} visibility to ${visible ? 'visible' : 'hidden'}`);
      }
    } catch (error) {
      console.error(`Error toggling ${layerId} visibility:`, error);
    }
  };

  // Helper function to get specialized layer style for each infrastructure type
  const getLayerStyle = (layerId) => {
    const baseColor = layers[layerId].color;
    
    switch(layerId) {
      case 'hydrants':
        return {
          type: 'circle',
          paint: {
            'circle-radius': 5,
            'circle-color': baseColor,
            'circle-opacity': 0.9,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': 'white'
          }
        };
      case 'trees':
        return {
          type: 'circle',
          paint: {
            'circle-radius': 4,
            'circle-color': baseColor,
            'circle-opacity': 0.8,
            'circle-stroke-width': 1,
            'circle-stroke-color': 'white'
          }
        };
      case 'busStops':
        return {
          type: 'circle',
          paint: {
            'circle-radius': 6,
            'circle-color': baseColor,
            'circle-opacity': 0.9,
            'circle-stroke-width': 2,
            'circle-stroke-color': 'white'
          }
        };
      default:
        return {
          type: 'circle',
          paint: {
            'circle-radius': 4,
            'circle-color': baseColor,
            'circle-opacity': 0.8,
            'circle-stroke-width': 1,
            'circle-stroke-color': 'white'
          }
        };
    }
  };

  // Helper function to create appropriate tooltip content for each infrastructure type
  const createTooltipContent = (properties, layerId) => {
    if (!properties) return [];
    
    // Remove geometry fields
    const filteredProps = Object.entries(properties)
      .filter(([key, value]) => value && 
        typeof value === 'string' && 
        !['geom', 'geometry', 'the_geom', 'shape'].includes(key.toLowerCase())
      );
    
    // Special handling for different layer types
    if (layerId === 'hydrants') {
      const importantFields = [
        { key: 'unitid', label: 'Hydrant ID' },
        { key: 'status', label: 'Status' },
        { key: 'rj_type', label: 'Type' }
      ];
      
      const content = [];
      
      // Add important fields first if they exist
      importantFields.forEach(field => {
        const value = properties[field.key];
        if (value) {
          content.push({
            label: field.label,
            value: value
          });
        }
      });
      
      // Add any other fields (up to a total of 5)
      filteredProps.forEach(([key, value]) => {
        if (content.length < 5 && !importantFields.some(field => field.key === key)) {
          content.push({
            label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            value: value
          });
        }
      });
      
      return content;
    } else if (layerId === 'busStops') {
      // Special handling for bus stops (GTFS data)
      const importantFields = [
        { key: 'stop_name', label: 'Stop Name' },
        { key: 'stop_id', label: 'Stop ID' },
        { key: 'stop_code', label: 'Stop Code' },
        { key: 'route_ids', label: 'Routes' },
        { key: 'wheelchair_boarding', label: 'Wheelchair Access' }
      ];
      
      const content = [];
      
      // Add important fields first if they exist
      importantFields.forEach(field => {
        const value = properties[field.key];
        if (value) {
          content.push({
            label: field.label,
            value: value
          });
        }
      });
      
      // Add any other fields (up to a total of 5)
      filteredProps.forEach(([key, value]) => {
        if (content.length < 5 && !importantFields.some(field => field.key === key)) {
          content.push({
            label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            value: value
          });
        }
      });
      
      return content;
    }
    
    // Generic handling for other layers
    return filteredProps
      .slice(0, 5)
      .map(([key, value]) => ({
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
        value: value
      }));
  };

  // New function to export permit area siteplan
  const exportPermitAreaSiteplan = async (format = 'png') => {
    if (!map.current || !focusedArea) {
      alert('Please focus on a permit area first');
      return;
    }

    try {
      console.log('Starting export process...');
      
      // Ensure map is loaded and idle
      await new Promise((resolve) => {
        if (map.current.loaded()) {
          if (map.current.areTilesLoaded()) {
            resolve();
          } else {
            map.current.once('idle', resolve);
          }
        } else {
          map.current.once('load', () => {
            map.current.once('idle', resolve);
          });
        }
      });

      console.log('Map is ready for export');

      // Hide UI elements that shouldn't appear in export
      const elementsToHide = [
        '.maplibregl-control-container',
        '.maplibre-search-box',
        '.active-tool-indicator',
        '.map-tooltip'
      ];
      
      const hiddenElements = [];
      elementsToHide.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          hiddenElements.push({ element: el, display: el.style.display });
          el.style.display = 'none';
        });
      });

      // Force a repaint
      map.current.triggerRepaint();
      
      // Wait for repaint to complete
      await new Promise(resolve => {
        map.current.once('render', resolve);
      });

      // Additional wait to ensure everything is rendered
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('Getting canvas data...');
      
      // Get map canvas
      const mapCanvas = map.current.getCanvas();
      console.log('Canvas dimensions:', mapCanvas.width, 'x', mapCanvas.height);
      
      // Try different methods to get the image data
      let mapImageData;
      try {
        // Method 1: Direct canvas export
        mapImageData = mapCanvas.toDataURL('image/png');
        console.log('Canvas export successful, data length:', mapImageData.length);
      } catch (canvasError) {
        console.error('Canvas export failed:', canvasError);
        throw new Error('Cannot export map canvas - this may be due to CORS restrictions with map tiles');
      }

      // Check if we actually got image data
      if (!mapImageData || mapImageData === 'data:,') {
        throw new Error('Canvas appears to be empty - map may not be fully loaded');
      }

      console.log('Creating export canvas...');
      
      // Create export canvas
      const exportCanvas = document.createElement('canvas');
      const ctx = exportCanvas.getContext('2d');
      
      // Set dimensions
      const scale = 2;
      const width = 1200 * scale;
      const height = 800 * scale;
      exportCanvas.width = width;
      exportCanvas.height = height;
      
      ctx.scale(scale, scale);
      
      // White background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width / scale, height / scale);
      
      // Load map image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          console.log('Map image loaded successfully');
          
          try {
            // Calculate map area
            const mapArea = {
              x: 50,
              y: 80,
              width: 800,
              height: 600
            };
            
            // Draw map image
            ctx.drawImage(img, mapArea.x, mapArea.y, mapArea.width, mapArea.height);
            console.log('Map image drawn to canvas');
            
            // Add cartographic elements
            addTitle(ctx, width / scale);
            addLegend(ctx, mapArea);
            addScaleBar(ctx, mapArea);
            addNorthArrow(ctx, mapArea);
            addMetadata(ctx, width / scale, height / scale);
            
            console.log('All elements added, creating blob...');
            
            // Export
            exportCanvas.toBlob((blob) => {
              if (blob) {
                console.log('Blob created successfully, size:', blob.size);
                downloadBlob(blob, `siteplan-${getSafeFilename()}.${format}`);
              } else {
                console.error('Failed to create blob');
                alert('Failed to create export file');
              }
              
              // Restore UI elements
              hiddenElements.forEach(({ element, display }) => {
                element.style.display = display;
              });
              
              resolve();
            }, `image/${format}`, 0.95);
            
          } catch (drawError) {
            console.error('Error drawing to canvas:', drawError);
            reject(drawError);
          }
        };
        
        img.onerror = (err) => {
          console.error('Failed to load map image:', err);
          reject(new Error('Failed to load captured map image'));
        };
        
        console.log('Setting image source...');
        img.src = mapImageData;
      });

    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error.message}`);
      
      // Restore UI elements on error
      const elementsToHide = [
        '.maplibregl-control-container',
        '.maplibre-search-box',
        '.active-tool-indicator',
        '.map-tooltip'
      ];
      
      elementsToHide.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          el.style.display = '';
        });
      });
    }
  };

  // Helper function to add title
  const addTitle = (ctx, width) => {
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    const title = `Site Plan: ${focusedArea.properties.name || 'Permit Area'}`;
    ctx.fillText(title, width / 2, 40);
    
    // Add subtitle
    ctx.font = '16px Arial';
    ctx.fillStyle = '#6b7280';
    let subtitle = '';
    if (focusedArea.properties.propertyname) {
      subtitle += focusedArea.properties.propertyname;
    }
    if (focusedArea.properties.subpropertyname) {
      subtitle += ` › ${focusedArea.properties.subpropertyname}`;
    }
    if (subtitle) {
      ctx.fillText(subtitle, width / 2, 65);
    }
  };

  // Helper function to add legend to the canvas
  const addLegend = (ctx, mapArea) => {
    const legendX = mapArea.x + mapArea.width + 20;
    const legendY = mapArea.y + 20;
    let currentY = legendY;
    
    // Legend title
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Legend', legendX, currentY);
    currentY += 30;
    
    // Add permit area legend
    ctx.fillStyle = layers.permitAreas.color;
    ctx.fillRect(legendX, currentY - 10, 15, 15);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, currentY - 10, 15, 15);
    
    ctx.fillStyle = '#374151';
    ctx.font = '12px Arial';
    ctx.fillText('Permit Area', legendX + 25, currentY);
    currentY += 25;
    
    // Add visible infrastructure layers
    Object.entries(layers).forEach(([layerId, config]) => {
      if (layerId !== 'permitAreas' && config.visible && focusedArea) {
        // Draw colored circle for point features
        ctx.fillStyle = config.color;
        ctx.beginPath();
        ctx.arc(legendX + 7, currentY - 5, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.fillStyle = '#374151';
        ctx.font = '12px Arial';
        ctx.fillText(config.name, legendX + 25, currentY);
        currentY += 20;
      }
    });
    
    // Add custom shapes if any
    if (customShapes.length > 0) {
      currentY += 10;
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('Event Fixtures', legendX, currentY);
      currentY += 20;
      
      customShapes.forEach(shape => {
        ctx.fillStyle = '#3b82f6';
        if (shape.type === 'Point') {
          ctx.beginPath();
          ctx.arc(legendX + 7, currentY - 5, 4, 0, 2 * Math.PI);
          ctx.fill();
        } else {
          ctx.fillRect(legendX + 3, currentY - 8, 8, 8);
        }
        
        ctx.fillStyle = '#374151';
        ctx.font = '11px Arial';
        const label = shape.label || `${shape.type} (unlabeled)`;
        ctx.fillText(label, legendX + 20, currentY);
        currentY += 18;
      });
    }
    
    // Add dropped objects if any
    if (droppedObjects.length > 0) {
      currentY += 10;
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('Equipment', legendX, currentY);
      currentY += 20;
      
      // Group by type for cleaner legend
      const objectCounts = droppedObjects.reduce((acc, obj) => {
        acc[obj.type] = (acc[obj.type] || 0) + 1;
        return acc;
      }, {});
      
      Object.entries(objectCounts).forEach(([type, count]) => {
        const objectType = placeableObjects.find(p => p.id === type);
        if (objectType) {
          ctx.fillStyle = objectType.color;
          ctx.fillRect(legendX + 3, currentY - 8, 8, 8);
          
          ctx.fillStyle = '#374151';
          ctx.font = '11px Arial';
          ctx.fillText(`${objectType.name} (${count})`, legendX + 20, currentY);
          currentY += 18;
        }
      });
    }
  };

  // Helper function to add scale bar
  const addScaleBar = (ctx, mapArea) => {
    const scaleBarX = mapArea.x + 20;
    const scaleBarY = mapArea.y + mapArea.height - 40;
    
    // Calculate scale based on current zoom
    const zoom = map.current.getZoom();
    const metersPerPixel = 40075016.686 * Math.abs(Math.cos(map.current.getCenter().lat * Math.PI / 180)) / Math.pow(2, zoom + 8);
    
    // Determine appropriate scale bar length
    let scaleLength = 100; // pixels
    let scaleMeters = Math.round(scaleLength * metersPerPixel);
    
    // Round to nice numbers
    if (scaleMeters > 1000) {
      scaleMeters = Math.round(scaleMeters / 1000) * 1000;
    } else if (scaleMeters > 100) {
      scaleMeters = Math.round(scaleMeters / 100) * 100;
    } else if (scaleMeters > 10) {
      scaleMeters = Math.round(scaleMeters / 10) * 10;
    }
    
    scaleLength = scaleMeters / metersPerPixel;
    
    // Draw scale bar
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scaleBarX, scaleBarY);
    ctx.lineTo(scaleBarX + scaleLength, scaleBarY);
    ctx.stroke();
    
    // Draw end marks
    ctx.beginPath();
    ctx.moveTo(scaleBarX, scaleBarY - 5);
    ctx.lineTo(scaleBarX, scaleBarY + 5);
    ctx.moveTo(scaleBarX + scaleLength, scaleBarY - 5);
    ctx.lineTo(scaleBarX + scaleLength, scaleBarY + 5);
    ctx.stroke();
    
    // Add scale text
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    const scaleText = scaleMeters >= 1000 ? `${scaleMeters / 1000}km` : `${scaleMeters}m`;
    ctx.fillText(scaleText, scaleBarX + scaleLength / 2, scaleBarY - 10);
  };

  // Helper function to add north arrow
  const addNorthArrow = (ctx, mapArea) => {
    const arrowX = mapArea.x + mapArea.width - 50;
    const arrowY = mapArea.y + 50;
    
    // Draw north arrow
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY - 20);
    ctx.lineTo(arrowX - 8, arrowY);
    ctx.lineTo(arrowX + 8, arrowY);
    ctx.closePath();
    ctx.fill();
    
    // Add "N" label
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('N', arrowX, arrowY + 15);
  };

  // Helper function to add metadata
  const addMetadata = (ctx, width, height) => {
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    
    const metadata = [
      `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      'NYC Public Space Event Stager',
      'Data: NYC Open Data Portal'
    ];
    
    let y = height - 30;
    metadata.forEach(line => {
      ctx.fillText(line, 50, y);
      y += 12;
    });
  };

  // Helper function to create safe filename
  const getSafeFilename = () => {
    const name = focusedArea?.properties?.name || 'permit-area';
    return name.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '-' + new Date().toISOString().split('T')[0];
  };

  // Helper function to download blob
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Map className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">NYC Public Space Event Stager</h1>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Info className="w-5 h-5 text-gray-600" />
            </button>
            <label className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
              <Upload className="w-5 h-5 text-gray-600" />
              <input type="file" accept=".json" onChange={importPlan} className="hidden" />
            </label>
            <button
              onClick={exportPlan}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Export Event Plan"
            >
              <Download className="w-5 h-5 text-gray-600" />
            </button>
            {/* New Export Siteplan Menu */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={!focusedArea}
                className={`p-2 rounded-lg transition-colors ${
                  focusedArea 
                    ? 'hover:bg-gray-100 text-gray-600' 
                    : 'text-gray-400 cursor-not-allowed'
                }`}
                title="Export Permit Area Siteplan"
              >
                <FileImage className="w-5 h-5" />
              </button>
              
              {showExportMenu && focusedArea && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-2">
                    <div className="text-xs font-medium text-gray-500 mb-2 px-2">Export Siteplan</div>
                    <button
                      onClick={() => {
                        exportPermitAreaSiteplan('png');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center space-x-2"
                    >
                      <FileImage className="w-4 h-4" />
                      <span>PNG Image</span>
                    </button>
                    <button
                      onClick={() => {
                        exportPermitAreaSiteplan('jpg');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center space-x-2"
                    >
                      <FileImage className="w-4 h-4" />
                      <span>JPG Image</span>
                    </button>
                    <button
                      onClick={() => {
                        exportPermitAreaSiteplan('pdf');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center space-x-2"
                    >
                      <FileText className="w-4 h-4" />
                      <span>PDF Document</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Click outside to close export menu */}
      {showExportMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowExportMenu(false)}
        />
      )}

      {/* Info Panel */}
      {showInfo && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
          <div className="flex items-start space-x-2">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Event Staging Tool for NYC Permits</p>
              <p>Draw custom event fixtures and export your siteplan for permit applications. NYC infrastructure layers coming soon with optimized data loading.</p>
            </div>
          </div>
        </div>
      )}

      {/* Focus Info Panel */}
      {focusedArea && showFocusInfo && (
        <div className="bg-blue-600 text-white border-b border-blue-700 px-4 py-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2">
              <Map className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">
                  Focused on: {focusedArea.properties.name || 'Unnamed Area'}
                </p>
                <p>
                  {focusedArea.properties.propertyname || ''} 
                  {focusedArea.properties.subpropertyname ? ` › ${focusedArea.properties.subpropertyname}` : ''}
                </p>
              </div>
            </div>
            <button 
              onClick={() => setShowFocusInfo(false)}
              className="text-white hover:text-blue-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-80 bg-white shadow-lg z-10 flex flex-col">
          {/* Drawing Tools */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Drawing Tools</h3>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => activateDrawingTool(activeTool === 'point' ? null : 'point')}
                className={`p-3 rounded-lg transition-all ${
                  activeTool === 'point' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
                title="Add Point"
              >
                <Circle className="w-5 h-5" />
              </button>
              <button
                onClick={() => activateDrawingTool(activeTool === 'line' ? null : 'line')}
                className={`p-3 rounded-lg transition-all ${
                  activeTool === 'line' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
                title="Draw Line"
              >
                <Pencil className="w-5 h-5" />
              </button>
              <button
                onClick={() => activateDrawingTool(activeTool === 'polygon' ? null : 'polygon')}
                className={`p-3 rounded-lg transition-all ${
                  activeTool === 'polygon' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
                title="Draw Polygon"
              >
                <Square className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  if (selectedShape && draw.current) {
                    draw.current.delete(selectedShape);
                  }
                }}
                className="p-3 bg-gray-100 hover:bg-red-100 text-gray-700 hover:text-red-600 rounded-lg transition-all"
                title="Delete Selected"
                disabled={!selectedShape}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Shape Properties */}
          {selectedShape && (
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Shape Properties</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Label</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={shapeLabel}
                      onChange={(e) => setShapeLabel(e.target.value)}
                      placeholder="e.g., Stage, Food Truck, Info Booth"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <button
                      onClick={updateShapeLabel}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Permit Area Search */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Search Permit Areas</h3>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={permitAreaSearch}
                onChange={(e) => setPermitAreaSearch(e.target.value)}
                placeholder="Search for permit areas..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            
            {isSearching && (
              <div className="mt-2 text-center py-2">
                <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                <span className="ml-2 text-xs text-gray-500">Searching...</span>
              </div>
            )}
            
            {searchResults.length > 0 && (
              <div className="mt-2 search-results">
                {searchResults.map((result, index) => (
                  <div 
                    key={index}
                    onClick={() => flyToPermitArea(result)}
                    className="p-2 hover:bg-blue-50 cursor-pointer rounded-md transition-colors search-result"
                  >
                    <div className="font-medium text-sm text-gray-800">
                      {highlightSearchTerm(result.properties.name || '(Unnamed)', permitAreaSearch)}
                    </div>
                                       {result.properties.propertyname && (
                      <div className="text-xs text-gray-600">
                        {highlightSearchTerm(result.properties.propertyname, permitAreaSearch)}
                        {result.properties.subpropertyname && ` › ${highlightSearchTerm(result.properties.subpropertyname, permitAreaSearch)}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {permitAreaSearch.length >= 2 && searchResults.length === 0 && !isSearching && (
              <div className="mt-2 py-2 text-center text-xs text-gray-500">
                No matching permit areas found
              </div>
            )}
          </div>

          {/* NYC Data Layers */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">NYC Infrastructure Layers</h3>
              
              {/* Remove nested navigation info */}
              
              {focusedArea && (
                <div className="mb-3 bg-blue-50 p-2 rounded-md text-xs text-blue-700 flex justify-between items-center">
                  <div>
                    <span className="font-medium">Focus active:</span> {focusedArea.properties.name || 'Unnamed Area'}
                  </div>
                  <button 
                    onClick={clearFocus}
                    className="text-blue-600 hover:text-blue-800 p-1"
                    title="Clear Focus"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              
              {!focusedArea && (
                <div className="mb-3 bg-amber-50 p-2 rounded-md text-xs text-amber-700">
                  Click on permit areas to explore overlapping zones. Multiple areas? Use the selector popup.
                </div>
              )}
              
              <div className="space-y-2">
                {Object.entries(layers).map(([layerId, config]) => (
                  <div
                    key={layerId}
                    className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg ${
                      layerId === 'permitAreas' || focusedArea ? '' : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => toggleLayer(layerId)}
                        className={`p-1 rounded ${layerId === 'permitAreas' || focusedArea ? 'cursor-pointer hover:bg-gray-200' : 'cursor-not-allowed'}`}
                        disabled={layerId !== 'permitAreas' && !focusedArea}
                      >
                        {config.visible ? (
                          <Eye className={`w-5 h-5 ${(layerId === 'permitAreas' || focusedArea) ? 'text-blue-600' : 'text-gray-400'}`} />
                        ) : (
                          <EyeOff className={`w-5 h-5 ${(layerId === 'permitAreas' || focusedArea) ? 'text-gray-600' : 'text-gray-400'}`} />
                        )}
                      </button>
                      <div
                        className={`w-4 h-4 rounded-full ${config.loading ? 'animate-pulse' : ''}`}
                        style={{ backgroundColor: config.color, opacity: config.visible ? 1 : 0.5 }}
                      />
                      <span className={`text-sm font-medium ${config.visible ? 'text-gray-800' : 'text-gray-500'}`}>
                        {config.name}
                        {config.loading && ' (Loading...)'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Placeable Objects Palette */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              <Grid3X3 className="w-4 h-4 inline mr-2" />
              Equipment & Objects
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {placeableObjects.map(obj => (
                <div
                  key={obj.id}
                  draggable
                  onDragStart={(e) => handleObjectDragStart(e, obj)}
                  className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-grab active:cursor-grabbing transition-colors border-2 border-transparent hover:border-blue-300"
                  title={`Drag to place ${obj.name}`}
                >
                  <div className="text-center">
                    <div 
                      className="w-8 h-8 mx-auto mb-1 rounded flex items-center justify-center text-white text-lg"
                      style={{ backgroundColor: obj.color }}
                    >
                      {obj.icon}
                    </div>
                    <div className="text-xs font-medium text-gray-700">{obj.name}</div>
                    <div className="text-xs text-gray-500">{obj.category}</div>
                  </div>
                </div>
              ))}
            </div>
            {draggedObject && (
              <div className="mt-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
                Drag "{draggedObject.name}" to the map to place it
              </div>
            )}
          </div>

          {/* Custom Shapes List */}
          {customShapes.length > 0 && (
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Event Fixtures ({customShapes.length})</h3>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {customShapes.map(shape => (
                  <div
                    key={shape.id}
                    onClick={() => {
                      if (draw.current) {
                        draw.current.changeMode('simple_select', { featureIds: [shape.id] });
                        setSelectedShape(shape.id);
                      }
                    }}
                    className={`px-3 py-2 text-sm rounded cursor-pointer transition-colors ${
                      selectedShape === shape.id 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-white hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {shape.label || `${shape.type} (unlabeled)`}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dropped Objects List */}
          {droppedObjects.length > 0 && (
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Placed Objects ({droppedObjects.length})</h3>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {droppedObjects.map(obj => {
                  const objectType = placeableObjects.find(p => p.id === obj.type);
                  return (
                    <div
                      key={obj.id}
                      className="flex items-center justify-between px-3 py-2 text-sm bg-white hover:bg-gray-100 rounded transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-4 h-4 rounded flex items-center justify-center text-white text-xs"
                          style={{ backgroundColor: objectType?.color || '#gray' }}
                        >
                          {objectType?.icon}
                        </div>
                        <span className="text-gray-700">{obj.name}</span>
                      </div>
                      <button
                        onClick={() => removeDroppedObject(obj.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove object"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          <div 
            ref={mapContainer} 
            className="absolute inset-0"
            style={{ width: '100%', height: '100%' }}
            onDragOver={handleMapDragOver}
            onDrop={handleMapDrop}
          />
          
          {/* Render Dropped Objects */}
          {droppedObjects.map(obj => {
            const objectType = placeableObjects.find(p => p.id === obj.type);
            if (!objectType) return null;
            
            return (
              <div
                key={`${obj.id}-${objectUpdateTrigger}`} // Use update trigger instead
                style={getObjectStyle(obj)}
                onClick={() => removeDroppedObject(obj.id)}
                title={`${obj.name} - Click to remove`}
              >
                {objectType.icon}
              </div>
            );
          })}

          {/* Map Loading Indicator */}
          {!mapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">Loading map...</p>
                <p className="text-xs text-gray-500 mt-2">Check console for debugging info</p>
              </div>
            </div>
          )}

          {/* Active Tool Indicator */}
          {activeTool && (
            <div className="absolute top-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg active-tool-indicator">
              <p className="text-sm font-medium">
                {activeTool === 'point' && 'Click to add point'}
                {activeTool === 'line' && 'Click to start drawing line'}
                {activeTool === 'polygon' && 'Click to start drawing polygon'}
              </p>
              <p className="text-xs opacity-90 mt-1">Press ESC to cancel</p>
            </div>
          )}
          
          {/* Map Feature Tooltip */}
          {tooltip.visible && tooltip.content && (
            <div 
              className="map-tooltip absolute z-50 bg-white p-2 rounded-lg shadow-lg border border-gray-200 max-w-xs"
              style={{ 
                left: tooltip.x + 10, 
                top: tooltip.y + 10
              }}
            >
              {tooltip.content.map((field, index) => (
                <div key={index} className="text-xs">
                  <span className="font-medium text-gray-700">{field.label}:</span>
                  <span className="text-gray-600 ml-1">{field.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Overlapping Areas Selector */}
          {showOverlapSelector && overlappingAreas.length > 1 && (
            <div 
              className="absolute bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 min-w-80 max-w-sm"
              style={{ 
                left: Math.min(clickPosition.x + 10, window.innerWidth - 350), 
                top: Math.min(clickPosition.y + 10, window.innerHeight - 200)
              }}
              onClick={(e) => e.stopPropagation()} // Prevent click from propagating to map
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800">Multiple Areas Found</h3>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOverlapSelector(false);
                    clearOverlapHighlights();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <p className="text-xs text-gray-600 mb-3">
                {overlappingAreas.length} overlapping permit areas detected. Select one to focus:
              </p>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {overlappingAreas.map((area, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log(`Button clicked for area ${index}`);
                      selectOverlappingArea(index);
                    }}
                    className={`w-full text-left p-3 rounded-md border transition-all cursor-pointer hover:shadow-md ${
                      index === selectedOverlapIndex 
                        ? 'border-blue-500 bg-blue-50 text-blue-900' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-sm">
                      {getAreaDisplayName(area)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {getAreaDescription(area)}
                    </div>
                  </button>
                ))}
              </div>
              
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                <span>Click an area above to focus</span>
                <span>Double-click map to bypass</span>
              </div>
            </div>
          )}

          {/* Overlap Navigation Instructions */}
          {showOverlapSelector && (
            <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm text-gray-800 px-4 py-3 rounded-lg shadow-lg border border-gray-200 max-w-sm">
              <div className="flex items-start space-x-2">
                <Layers className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Overlapping Areas Detected</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• <strong>Click</strong> an area in the popup to focus</li>
                    <li>• <strong>Double-click</strong> map to focus top area</li>
                    <li>• <strong>↑↓ keys</strong> to cycle through options</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventStager;