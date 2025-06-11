import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Map, Layers, Download, Upload, Pencil, Square, Circle, Type, Trash2, Eye, EyeOff, Settings, Info } from 'lucide-react';

const EventStager = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const draw = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [layers, setLayers] = useState({
    trees: { visible: false, name: 'Street Trees', color: '#22c55e', loading: false },
    hydrants: { visible: false, name: 'Fire Hydrants', color: '#ef4444', loading: false },
    parking: { visible: false, name: 'Parking Meters', color: '#3b82f6', loading: false },
    benches: { visible: false, name: 'Public Benches', color: '#8b5cf6', loading: false },
    streetlights: { visible: false, name: 'Street Lights', color: '#f59e0b', loading: false }
  });
  const [customShapes, setCustomShapes] = useState([]);
  const [selectedShape, setSelectedShape] = useState(null);
  const [shapeLabel, setShapeLabel] = useState('');
  const [showInfo, setShowInfo] = useState(false);

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
          zoom: 16
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

    // Load scripts and initialize
    const loadAndInit = () => {
      loadCSS();

      // Check if MapLibre is already available
      if (window.maplibregl) {
        console.log('MapLibre already loaded');
        if (window.MapboxDraw) {
          console.log('Draw already loaded');
          initializeMap();
        } else {
          // Load Draw
          const drawScript = document.createElement('script');
          drawScript.src = 'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.3/mapbox-gl-draw.js';
          drawScript.onload = () => {
            console.log('Draw loaded');
            initializeMap();
          };
          document.head.appendChild(drawScript);
        }
        return;
      }

      // Load MapLibre
      console.log('Loading MapLibre...');
      const mapScript = document.createElement('script');
      mapScript.src = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js';
      
      mapScript.onload = () => {
        console.log('MapLibre loaded successfully');
        
        // Load Draw
        const drawScript = document.createElement('script');
        drawScript.src = 'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.3/mapbox-gl-draw.js';
        
        drawScript.onload = () => {
          console.log('Draw loaded successfully');
          // Small delay to ensure everything is ready
          setTimeout(initializeMap, 100);
        };
        
        drawScript.onerror = (e) => {
          console.error('Failed to load Draw:', e);
        };
        
        document.head.appendChild(drawScript);
      };
      
      mapScript.onerror = (e) => {
        console.error('Failed to load MapLibre:', e);
        setMapLoaded(false);
      };
      
      document.head.appendChild(mapScript);
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
    console.log(`Layer ${layerId} functionality coming soon`);
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
      customShapes: draw.current.getAll()
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
            >
              <Download className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

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

          {/* NYC Data Layers */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">NYC Infrastructure Layers</h3>
              <p className="text-xs text-gray-500 mb-3 italic">Coming soon: Smart data loading</p>
              <div className="space-y-2">
                {Object.entries(layers).map(([layerId, config]) => (
                  <div
                    key={layerId}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg opacity-50 cursor-not-allowed"
                  >
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => toggleLayer(layerId)}
                        className="p-1 rounded cursor-not-allowed"
                        disabled={true}
                      >
                        {config.visible ? (
                          <Eye className="w-5 h-5 text-gray-400" />
                        ) : (
                          <EyeOff className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                      <div
                        className="w-4 h-4 rounded-full opacity-50"
                        style={{ backgroundColor: config.color }}
                      />
                      <span className="text-sm font-medium text-gray-500">{config.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          <div 
            ref={mapContainer} 
            className="absolute inset-0"
            style={{ width: '100%', height: '100%' }}
          />
          
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
            <div className="absolute top-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
              <p className="text-sm font-medium">
                {activeTool === 'point' && 'Click to add point'}
                {activeTool === 'line' && 'Click to start drawing line'}
                {activeTool === 'polygon' && 'Click to start drawing polygon'}
              </p>
              <p className="text-xs opacity-90 mt-1">Press ESC to cancel</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventStager;