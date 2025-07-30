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
    customShapes: draw.current ? draw.current.getAll() : { features: [] },
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
          draw.current.set(data.customShapes);
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

  // Store current map state to restore later
  let originalCenter, originalZoom, originalPitch, originalBearing;
  
  try {
    console.log('Starting export process...');
    
    // Store current map state to restore later
    originalCenter = map.getCenter();
    originalZoom = map.getZoom();
    originalPitch = map.getPitch();
    originalBearing = map.getBearing();
    
    // Set map to 2D view for export (top-down view)
    map.setPitch(0);
    map.setBearing(0);
    
    // Wait for the map to update after setting pitch and bearing
    await new Promise(resolve => {
      map.once('moveend', resolve);
      // Force a move to trigger the event
      map.triggerRepaint();
    });
    
    // Get the permit area bounds and fit the map optimally to it
    const permitBounds = getPermitAreaBounds(focusedArea);
    if (permitBounds) {
      console.log('Permit area bounds:', permitBounds);
      
      // Calculate expanded bounds to include context around the permit area
      const permitWidth = permitBounds[1][0] - permitBounds[0][0];
      const permitHeight = permitBounds[1][1] - permitBounds[0][1];
      
      // Expand by 40% of the permit area size in each direction for better context
      const expansionFactor = 0.4;
      const expandedBounds = [
        [
          permitBounds[0][0] - (permitWidth * expansionFactor),
          permitBounds[0][1] - (permitHeight * expansionFactor)
        ],
        [
          permitBounds[1][0] + (permitWidth * expansionFactor),
          permitBounds[1][1] + (permitHeight * expansionFactor)
        ]
      ];
      
      console.log('Setting bounds for export:', expandedBounds);
      
      // Fit to the expanded bounds in one step for consistent alignment
      map.fitBounds(expandedBounds, {
        duration: 0, // Instant fit
        padding: 20  // Minimal padding for consistent alignment
      });
      
      // Wait for the fit to complete
      await new Promise(resolve => {
        map.once('moveend', resolve);
      });
    }
    
    // Wait for map to be ready
    await new Promise((resolve) => {
      if (map.loaded() && map.areTilesLoaded()) {
        resolve();
      } else {
        map.once('idle', resolve);
      }
    });

    console.log('Map is ready for export');

    // Hide UI elements that shouldn't appear in export
    const elementsToHide = [
      '.maplibregl-control-container',
      '.maplibre-search-box',
      '.active-tool-indicator',
      '.map-tooltip',
      '.placed-object',
      '.custom-shape-label'
    ];
    
    const hiddenElements = [];
    elementsToHide.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        hiddenElements.push({ element: el, display: el.style.display });
        el.style.display = 'none';
      });
    });

    // Force a repaint and wait
    map.triggerRepaint();
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('Getting canvas data...');
    
    // Get map canvas
    const mapCanvas = map.getCanvas();
    console.log('Canvas dimensions:', mapCanvas.width, 'x', mapCanvas.height);
    
    // Get image data
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
    
    // Set dimensions for A4 paper (landscape)
    const scale = 2;
    const width = 1400 * scale;  // A4 landscape width
    const height = 1000 * scale; // A4 landscape height
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
          // Calculate map area to maximize space usage while leaving room for title and legend
          const mapArea = {
            x: 30,
            y: 80,
            width: 1340,  // Use ~96% of canvas width
            height: 840   // Use ~84% of canvas height
          };
          
          // Draw map image
          ctx.drawImage(img, mapArea.x, mapArea.y, mapArea.width, mapArea.height);
          console.log('Map image drawn to canvas');
          
          // Draw custom shapes (annotations) on the export canvas
          if (customShapes && customShapes.length > 0) {
            console.log('Drawing custom shapes:', customShapes.length);
            drawCustomShapesOnCanvas(ctx, mapArea, map, customShapes);
          }
          
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
          
          // Export based on format
          if (format === 'pdf') {
            // For PDF, we need to convert the canvas to PDF
            console.log('Creating PDF...');
            // For now, we'll create a high-quality PNG and suggest using a PDF converter
            exportCanvas.toBlob((blob) => {
              if (blob) {
                console.log('Blob created successfully, size:', blob.size);
                // Convert PNG to PDF using jsPDF
                import('jspdf').then(({ default: jsPDF }) => {
                  const pdf = new jsPDF('landscape', 'mm', 'a4');
                  const imgData = URL.createObjectURL(blob);
                  
                  pdf.addImage(imgData, 'PNG', 0, 0, 297, 210); // A4 landscape dimensions
                  pdf.save(`siteplan-${getSafeFilename(focusedArea)}.pdf`);
                  
                  URL.revokeObjectURL(imgData);
                }).catch(() => {
                  // Fallback to PNG if jsPDF is not available
                  downloadBlob(blob, `siteplan-${getSafeFilename(focusedArea)}.png`);
                  alert('PDF generation failed. PNG file created instead.');
                });
              } else {
                console.error('Failed to create blob');
                alert('Failed to create export file');
              }
              
              // Restore map state
              map.setCenter(originalCenter);
              map.setZoom(originalZoom);
              map.setPitch(originalPitch);
              map.setBearing(originalBearing);
              
              // Restore UI elements
              hiddenElements.forEach(({ element, display }) => {
                element.style.display = display;
              });
              
              resolve();
            }, 'image/png', 0.95);
          } else {
            // For PNG and JPG
            exportCanvas.toBlob((blob) => {
              if (blob) {
                console.log('Blob created successfully, size:', blob.size);
                downloadBlob(blob, `siteplan-${getSafeFilename(focusedArea)}.${format}`);
              } else {
                console.error('Failed to create blob');
                alert('Failed to create export file');
              }
              
              // Restore map state
              map.setCenter(originalCenter);
              map.setZoom(originalZoom);
              map.setPitch(originalPitch);
              map.setBearing(originalBearing);
              
              // Restore UI elements
              hiddenElements.forEach(({ element, display }) => {
                element.style.display = display;
              });
              
              resolve();
            }, `image/${format}`, 0.95);
          }
          
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
    
    // Restore map state on error
    try {
      map.setCenter(originalCenter);
      map.setZoom(originalZoom);
      map.setPitch(originalPitch);
      map.setBearing(originalBearing);
    } catch (restoreError) {
      console.error('Failed to restore map state:', restoreError);
    }
    
    // Restore UI elements on error
    const elementsToHide = [
      '.maplibregl-control-container',
      '.maplibre-search-box',
      '.active-tool-indicator',
      '.map-tooltip',
      '.placed-object',
      '.custom-shape-label'
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

// Get bounding box of permit area
const getPermitAreaBounds = (focusedArea) => {
  if (!focusedArea || !focusedArea.geometry) return null;
  
  try {
    const coordinates = focusedArea.geometry.coordinates;
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;
    
    // Handle different geometry types
    if (focusedArea.geometry.type === 'Polygon') {
      coordinates[0].forEach(coord => {
        minLng = Math.min(minLng, coord[0]);
        maxLng = Math.max(maxLng, coord[0]);
        minLat = Math.min(minLat, coord[1]);
        maxLat = Math.max(maxLat, coord[1]);
      });
    } else if (focusedArea.geometry.type === 'MultiPolygon') {
      coordinates.forEach(polygon => {
        polygon[0].forEach(coord => {
          minLng = Math.min(minLng, coord[0]);
          maxLng = Math.max(maxLng, coord[0]);
          minLat = Math.min(minLat, coord[1]);
          maxLat = Math.max(maxLat, coord[1]);
        });
      });
    }
    
    if (minLng === Infinity || maxLng === -Infinity) return null;
    
    return [[minLng, minLat], [maxLng, maxLat]];
  } catch (error) {
    console.error('Error calculating permit area bounds:', error);
    return null;
  }
};

// Draw custom shapes (annotations) on the export canvas
const drawCustomShapesOnCanvas = (ctx, mapArea, map, customShapes) => {
  if (!customShapes || customShapes.length === 0) return;
  
  customShapes.forEach(shape => {
    try {
      if (shape.geometry.type === 'Point') {
        // Draw point annotation
        const pixel = map.project([shape.geometry.coordinates[0], shape.geometry.coordinates[1]]);
        const mapCanvas = map.getCanvas();
        
        // Use normalized coordinates for better alignment
        const normalizedX = pixel.x / mapCanvas.width;
        const normalizedY = pixel.y / mapCanvas.height;
        const mapPixelX = mapArea.x + normalizedX * mapArea.width;
        const mapPixelY = mapArea.y + normalizedY * mapArea.height;
        
        // Draw point marker
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(mapPixelX, mapPixelY, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw label if available
        if (shape.properties && shape.properties.label) {
          ctx.fillStyle = '#1f2937';
          ctx.font = 'bold 12px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          
          // Add background for label
          const textWidth = ctx.measureText(shape.properties.label).width;
          const labelX = mapPixelX;
          const labelY = mapPixelY - 15;
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(labelX - textWidth/2 - 4, labelY - 12, textWidth + 8, 16);
          
          ctx.fillStyle = '#1f2937';
          ctx.fillText(shape.properties.label, labelX, labelY);
        }
        
      } else if (shape.geometry.type === 'LineString') {
        // Draw line annotation
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        shape.geometry.coordinates.forEach((coord, index) => {
          const pixel = map.project([coord[0], coord[1]]);
          const mapCanvas = map.getCanvas();
          const normalizedX = pixel.x / mapCanvas.width;
          const normalizedY = pixel.y / mapCanvas.height;
          const mapPixelX = mapArea.x + normalizedX * mapArea.width;
          const mapPixelY = mapArea.y + normalizedY * mapArea.height;
          
          if (index === 0) {
            ctx.moveTo(mapPixelX, mapPixelY);
          } else {
            ctx.lineTo(mapPixelX, mapPixelY);
          }
        });
        ctx.stroke();
        
        // Draw label at midpoint if available
        if (shape.properties && shape.properties.label) {
          const midIndex = Math.floor(shape.geometry.coordinates.length / 2);
          const midCoord = shape.geometry.coordinates[midIndex];
          const pixel = map.project([midCoord[0], midCoord[1]]);
          const mapCanvas = map.getCanvas();
          const normalizedX = pixel.x / mapCanvas.width;
          const normalizedY = pixel.y / mapCanvas.height;
          const mapPixelX = mapArea.x + normalizedX * mapArea.width;
          const mapPixelY = mapArea.y + normalizedY * mapArea.height;
          
          ctx.fillStyle = '#1f2937';
          ctx.font = 'bold 12px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Add background for label
          const textWidth = ctx.measureText(shape.properties.label).width;
          const labelX = mapPixelX;
          const labelY = mapPixelY;
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(labelX - textWidth/2 - 4, labelY - 8, textWidth + 8, 16);
          
          ctx.fillStyle = '#1f2937';
          ctx.fillText(shape.properties.label, labelX, labelY);
        }
        
      } else if (shape.geometry.type === 'Polygon') {
        // Draw polygon annotation
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        shape.geometry.coordinates[0].forEach((coord, index) => {
          const pixel = map.project([coord[0], coord[1]]);
          const mapCanvas = map.getCanvas();
          const normalizedX = pixel.x / mapCanvas.width;
          const normalizedY = pixel.y / mapCanvas.height;
          const mapPixelX = mapArea.x + normalizedX * mapArea.width;
          const mapPixelY = mapArea.y + normalizedY * mapArea.height;
          
          if (index === 0) {
            ctx.moveTo(mapPixelX, mapPixelY);
          } else {
            ctx.lineTo(mapPixelX, mapPixelY);
          }
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Draw label at centroid if available
        if (shape.properties && shape.properties.label) {
          // Calculate centroid
          let sumLng = 0, sumLat = 0;
          shape.geometry.coordinates[0].forEach(coord => {
            sumLng += coord[0];
            sumLat += coord[1];
          });
          const centroidLng = sumLng / shape.geometry.coordinates[0].length;
          const centroidLat = sumLat / shape.geometry.coordinates[0].length;
          
          const pixel = map.project([centroidLng, centroidLat]);
          const mapCanvas = map.getCanvas();
          const normalizedX = pixel.x / mapCanvas.width;
          const normalizedY = pixel.y / mapCanvas.height;
          const mapPixelX = mapArea.x + normalizedX * mapArea.width;
          const mapPixelY = mapArea.y + normalizedY * mapArea.height;
          
          ctx.fillStyle = '#1f2937';
          ctx.font = 'bold 12px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Add background for label
          const textWidth = ctx.measureText(shape.properties.label).width;
          const labelX = mapPixelX;
          const labelY = mapPixelY;
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(labelX - textWidth/2 - 4, labelY - 8, textWidth + 8, 16);
          
          ctx.fillStyle = '#1f2937';
          ctx.fillText(shape.properties.label, labelX, labelY);
        }
      }
      
    } catch (error) {
      console.error('Error drawing custom shape:', error);
    }
  });
};

// Draw dropped objects on the export canvas
const drawDroppedObjectsOnCanvas = (ctx, mapArea, map, droppedObjects) => {
  if (!droppedObjects || droppedObjects.length === 0) return;
  
  console.log('Drawing', droppedObjects.length, 'dropped objects on export canvas');
  
  droppedObjects.forEach((obj, index) => {
    const objectType = PLACEABLE_OBJECTS.find(p => p.id === obj.type);
    if (!objectType) {
      console.warn('Object type not found for:', obj.type);
      return;
    }
    
    try {
      // Convert lat/lng to normalized screen coordinates (0-1)
      const pixel = map.project([obj.position.lng, obj.position.lat]);
      const mapCanvas = map.getCanvas();
      
      // Normalize pixel coordinates to 0-1 range
      const normalizedX = pixel.x / mapCanvas.width;
      const normalizedY = pixel.y / mapCanvas.height;
      
      // Check if object is within visible bounds
      if (normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1) {
        console.warn(`Object ${index} is outside visible bounds:`, { normalizedX, normalizedY });
      }
      
      // Transform to export canvas coordinates
      const mapPixelX = mapArea.x + normalizedX * mapArea.width;
      const mapPixelY = mapArea.y + normalizedY * mapArea.height;
      
      console.log(`Object ${index} (${objectType.name}):`, {
        lat: obj.position.lat,
        lng: obj.position.lng,
        pixel: { x: pixel.x, y: pixel.y },
        normalized: { x: normalizedX, y: normalizedY },
        canvas: { x: mapPixelX, y: mapPixelY }
      });
      
      // Draw the object with better styling
      const objSize = Math.max(objectType.size.width, objectType.size.height, 28);
      
      // Draw background circle
      ctx.fillStyle = objectType.color;
      ctx.beginPath();
      ctx.arc(mapPixelX, mapPixelY, objSize / 2, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw border
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Draw icon
      ctx.fillStyle = 'white';
      ctx.font = `bold ${objSize * 0.6}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(objectType.icon, mapPixelX, mapPixelY);
      
    } catch (error) {
      console.error('Error drawing dropped object:', error, obj);
    }
  });
};