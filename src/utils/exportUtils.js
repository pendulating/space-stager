// utils/exportUtils.js
import { PLACEABLE_OBJECTS } from '../constants/placeableObjects';

// Export event plan
export const exportPlan = (map, draw, droppedObjects, layers, customShapes) => {
  if (!map || !draw) return;
  
  const data = {
    metadata: {
      created: new Date().toISOString(),
      center: map.getCenter(),
      zoom: map.getZoom(),
      bounds: map.getBounds().toArray()
    },
    layers: layers,
    customShapes: draw.getAll(),
    droppedObjects: droppedObjects
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `event-plan-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

// Import event plan
export const importPlan = (e, map, draw, setCustomShapes, setDroppedObjects, setLayers) => {
  const file = e.target.files[0];
  if (file && map && draw) {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        
        if (data.metadata) {
          map.setCenter(data.metadata.center);
          map.setZoom(data.metadata.zoom);
        }
        
        if (data.customShapes) {
          draw.set(data.customShapes);
          setCustomShapes(data.customShapes.features.map(f => ({
            id: f.id,
            type: f.geometry.type,
            label: f.properties.label || '',
            properties: f.properties
          })));
        }
        
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

// Export permit area siteplan
export const exportPermitAreaSiteplan = async (map, focusedArea, layers, customShapes, droppedObjects, format = 'png') => {
  if (!map || !focusedArea) {
    alert('Please focus on a permit area first');
    return;
  }

  try {
    console.log('Starting export process...');
    
    // Ensure map is loaded and idle
    await new Promise((resolve) => {
      if (map.loaded()) {
        if (map.areTilesLoaded()) {
          resolve();
        } else {
          map.once('idle', resolve);
        }
      } else {
        map.once('load', () => {
          map.once('idle', resolve);
        });
      }
    });

    console.log('Map is ready for export');

    // Ensure all visible infrastructure layers are loaded and visible
    const visibleInfrastructureLayers = Object.entries(layers)
      .filter(([layerId, config]) => layerId !== 'permitAreas' && config.visible)
      .map(([layerId]) => layerId);
    
    console.log('Visible infrastructure layers for export:', visibleInfrastructureLayers);

    // Ensure infrastructure layers are visible on the map
    visibleInfrastructureLayers.forEach(layerId => {
      try {
        // Check if the layer exists and is visible
        const pointLayerId = `layer-${layerId}-point`;
        const lineLayerId = `layer-${layerId}-line`;
        
        if (map.getLayer(pointLayerId)) {
          map.setLayoutProperty(pointLayerId, 'visibility', 'visible');
        }
        if (map.getLayer(lineLayerId)) {
          map.setLayoutProperty(lineLayerId, 'visibility', 'visible');
        }
      } catch (error) {
        console.log(`Could not ensure visibility for layer ${layerId}:`, error);
      }
    });

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
    map.triggerRepaint();
    
    // Wait for repaint to complete
    await new Promise(resolve => {
      map.once('render', resolve);
    });

    // Additional wait to ensure everything is rendered
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Getting canvas data...');
    
    // Get map canvas
    const mapCanvas = map.getCanvas();
    console.log('Canvas dimensions:', mapCanvas.width, 'x', mapCanvas.height);
    
    // Try different methods to get the image data
    let mapImageData;
    try {
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
          
          // Draw dropped objects on the export canvas
          if (droppedObjects && droppedObjects.length > 0) {
            console.log('Drawing dropped objects:', droppedObjects.length);
            drawDroppedObjectsOnCanvas(ctx, mapArea, map, droppedObjects);
          }
          
          // Add cartographic elements
          addTitle(ctx, width / scale, focusedArea);
          addLegend(ctx, mapArea, layers, customShapes, droppedObjects);
          addScaleBar(ctx, mapArea, map);
          addCompass(ctx, mapArea);
          addMetadata(ctx, width / scale, height / scale);
          
          console.log('All elements added, creating blob...');
          
          // Export
          exportCanvas.toBlob((blob) => {
            if (blob) {
              console.log('Blob created successfully, size:', blob.size);
              downloadBlob(blob, `siteplan-${getSafeFilename(focusedArea)}.${format}`);
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

// Helper functions for siteplan export
const addTitle = (ctx, width, focusedArea) => {
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

const addLegend = (ctx, mapArea, layers, customShapes, droppedObjects) => {
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
    if (layerId !== 'permitAreas' && config.visible) {
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
  if (customShapes && customShapes.length > 0) {
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
  if (droppedObjects && droppedObjects.length > 0) {
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
      const objectType = PLACEABLE_OBJECTS.find(p => p.id === type);
      if (!objectType) return;
      
      // Draw object representation
      ctx.fillStyle = objectType.color;
      ctx.fillRect(legendX + 3, currentY - 8, 8, 8);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1;
      ctx.strokeRect(legendX + 3, currentY - 8, 8, 8);
      
      ctx.fillStyle = '#374151';
      ctx.font = '11px Arial';
      ctx.fillText(`${objectType.name} (${count})`, legendX + 20, currentY);
      currentY += 18;
    });
  }
};

const addScaleBar = (ctx, mapArea, map) => {
  const scaleBarX = mapArea.x + 20;
  const scaleBarY = mapArea.y + mapArea.height - 40;
  
  // Calculate scale based on current zoom
  const zoom = map.getZoom();
  const metersPerPixel = 40075016.686 * Math.abs(Math.cos(map.getCenter().lat * Math.PI / 180)) / Math.pow(2, zoom + 8);
  
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

const addCompass = (ctx, mapArea) => {
  const compassX = mapArea.x + mapArea.width - 80;
  const compassY = mapArea.y + 80;
  const radius = 25;
  
  // Draw compass circle
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(compassX, compassY, radius, 0, 2 * Math.PI);
  ctx.stroke();
  
  // Draw inner circle
  ctx.beginPath();
  ctx.arc(compassX, compassY, radius - 8, 0, 2 * Math.PI);
  ctx.stroke();
  
  // Draw north arrow (pointing up)
  ctx.fillStyle = '#dc2626'; // Red for north
  ctx.beginPath();
  ctx.moveTo(compassX, compassY - radius + 5);
  ctx.lineTo(compassX - 6, compassY - 5);
  ctx.lineTo(compassX + 6, compassY - 5);
  ctx.closePath();
  ctx.fill();
  
  // Draw south arrow (pointing down)
  ctx.fillStyle = '#6b7280'; // Gray for south
  ctx.beginPath();
  ctx.moveTo(compassX, compassY + radius - 5);
  ctx.lineTo(compassX - 4, compassY + 5);
  ctx.lineTo(compassX + 4, compassY + 5);
  ctx.closePath();
  ctx.fill();
  
  // Draw cardinal directions
  ctx.fillStyle = '#000';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // North
  ctx.fillText('N', compassX, compassY - radius - 8);
  
  // South
  ctx.fillText('S', compassX, compassY + radius + 12);
  
  // East
  ctx.fillText('E', compassX + radius + 8, compassY);
  
  // West
  ctx.fillText('W', compassX - radius - 8, compassY);
  
  // Add intermediate directions
  ctx.font = '10px Arial';
  
  // Northeast
  ctx.fillText('NE', compassX + radius * 0.7, compassY - radius * 0.7);
  
  // Northwest
  ctx.fillText('NW', compassX - radius * 0.7, compassY - radius * 0.7);
  
  // Southeast
  ctx.fillText('SE', compassX + radius * 0.7, compassY + radius * 0.7);
  
  // Southwest
  ctx.fillText('SW', compassX - radius * 0.7, compassY + radius * 0.7);
  
  // Draw center dot
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(compassX, compassY, 2, 0, 2 * Math.PI);
  ctx.fill();
};

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

const getSafeFilename = (focusedArea) => {
  const name = focusedArea?.properties?.name || 'permit-area';
  return name.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '-' + new Date().toISOString().split('T')[0];
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// Draw dropped objects on the export canvas
const drawDroppedObjectsOnCanvas = (ctx, mapArea, map, droppedObjects) => {
  if (!droppedObjects || droppedObjects.length === 0) return;
  
  droppedObjects.forEach(obj => {
    const objectType = PLACEABLE_OBJECTS.find(p => p.id === obj.type);
    if (!objectType) return;
    
    try {
      // Convert lat/lng to pixel coordinates on the export canvas
      const pixel = map.project([obj.position.lng, obj.position.lat]);
      
      // Calculate position relative to the map area on the export canvas
      const mapPixelX = mapArea.x + (pixel.x / map.getCanvas().width) * mapArea.width;
      const mapPixelY = mapArea.y + (pixel.y / map.getCanvas().height) * mapArea.height;
      
      // Draw the object
      const objWidth = objectType.size.width;
      const objHeight = objectType.size.height;
      const x = mapPixelX - objWidth / 2;
      const y = mapPixelY - objHeight / 2;
      
      // Draw background
      ctx.fillStyle = objectType.color;
      ctx.fillRect(x, y, objWidth, objHeight);
      
      // Draw border
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, objWidth, objHeight);
      
      // Draw icon (simplified - just a colored rectangle for now)
      ctx.fillStyle = 'white';
      ctx.font = `${objHeight * 0.6}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(objectType.icon, x + objWidth / 2, y + objHeight / 2);
      
    } catch (error) {
      console.error('Error drawing dropped object:', error);
    }
  });
};