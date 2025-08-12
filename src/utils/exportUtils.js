// utils/exportUtils.js
import { PLACEABLE_OBJECTS } from '../constants/placeableObjects';
import { getIconDataUrl, INFRASTRUCTURE_ICONS } from './iconUtils';

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

// New siteplan export (PDF vector first, PNG optional). Uses offscreen map for basemap and draws vector overlays.
export const exportPermitAreaSiteplanV2 = async (
  map,
  focusedArea,
  layers,
  customShapes,
  droppedObjects,
  format = 'pdf',
  infrastructureData = null
) => {
  if (!map || !focusedArea) {
    alert('Please focus on a permit area first');
    return;
  }

  try {
    // Page setup: A4 landscape in mm
    const pageMm = { width: 297, height: 210 };
    const mapMm = { width: pageMm.width * 0.75, height: pageMm.height };
    const legendMm = { x: mapMm.width, y: 0, width: pageMm.width * 0.25, height: pageMm.height };

    const dpi = 150; // basemap raster quality
    const pxPerMm = dpi / 25.4;
    const mapPx = {
      width: Math.round(mapMm.width * pxPerMm),
      height: Math.round(mapMm.height * pxPerMm)
    };

    // Offscreen container
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '-10000px';
    container.style.width = `${mapPx.width}px`;
    container.style.height = `${mapPx.height}px`;
    document.body.appendChild(container);

    const baseStyle = map.getStyle ? map.getStyle() : undefined;
    if (!window.maplibregl) throw new Error('MapLibre is not available');
    const offscreen = new window.maplibregl.Map({
      container,
      style: baseStyle || map.getStyle?.(),
      preserveDrawingBuffer: true,
      interactive: false,
      attributionControl: false
    });

    offscreen.setPitch(0);
    offscreen.setBearing(0);

    const bounds = getPermitAreaBounds(focusedArea);
    if (!bounds) throw new Error('Invalid focused area geometry');

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Offscreen map style load timeout')), 8000);
      const ready = () => { clearTimeout(timeout); resolve(); };
      if (offscreen.isStyleLoaded()) ready(); else offscreen.once('style.load', ready);
    });

    // Ensure only the focused permit area is visible on the offscreen map
    try {
      const system = focusedArea?.properties?.system || '';
      if (offscreen.getLayer('permit-areas-fill')) {
        offscreen.setLayoutProperty('permit-areas-fill', 'visibility', 'none');
      }
      if (offscreen.getLayer('permit-areas-outline')) {
        offscreen.setLayoutProperty('permit-areas-outline', 'visibility', 'none');
      }
      if (offscreen.getLayer('permit-areas-focused-fill')) {
        offscreen.setFilter('permit-areas-focused-fill', ['==', ['get', 'system'], system]);
        offscreen.setLayoutProperty('permit-areas-focused-fill', 'visibility', 'visible');
      }
      if (offscreen.getLayer('permit-areas-focused-outline')) {
        offscreen.setFilter('permit-areas-focused-outline', ['==', ['get', 'system'], system]);
        offscreen.setLayoutProperty('permit-areas-focused-outline', 'visibility', 'visible');
      }
    } catch (_) {}

    // Fit bounds to the left 75% viewport without scaling the image output
    offscreen.fitBounds(bounds, { padding: 12, duration: 0 });

    await new Promise((resolve) => {
      if (offscreen.loaded() && offscreen.areTilesLoaded()) resolve();
      else offscreen.once('idle', resolve);
    });

    const baseImageUrl = offscreen.getCanvas().toDataURL('image/png');
    if (!baseImageUrl || baseImageUrl === 'data:,') throw new Error('Failed to capture basemap image');

    // Preload PNG icons for visible layers for both PDF and PNG flows
    const pngIcons = await loadVisiblePngIcons(layers);

    if (format === 'png') {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(pageMm.width * pxPerMm);
      canvas.height = Math.round(pageMm.height * pxPerMm);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const img = await loadImage(baseImageUrl);
      ctx.drawImage(img, 0, 0, mapPx.width, mapPx.height);

      drawOverlaysOnCanvas(ctx, offscreen, mapPx, { x: 0, y: 0 }, layers, customShapes, droppedObjects, infrastructureData, focusedArea, pngIcons);

      const legendPx = { x: mapPx.width, y: 0, width: canvas.width - mapPx.width, height: canvas.height };
      const numbered = numberCustomShapes(customShapes || []);
      drawLegendOnCanvas(ctx, legendPx, layers, numbered, droppedObjects, focusedArea, pngIcons);

      canvas.toBlob((blob) => {
        if (!blob) { alert('Failed to create PNG'); cleanupOffscreen(offscreen, container); return; }
        downloadBlob(blob, `siteplan-${getSafeFilename(focusedArea)}.png`);
        cleanupOffscreen(offscreen, container);
      }, 'image/png', 0.95);
      return;
    }

    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    pdf.addImage(baseImageUrl, 'PNG', 0, 0, mapMm.width, mapMm.height);

    const mmFromPx = { x: mapMm.width / mapPx.width, y: mapMm.height / mapPx.height };
    const toMm = (pt) => ({ x: pt.x * mmFromPx.x, y: pt.y * mmFromPx.y });
    const project = (lng, lat) => offscreen.project([lng, lat]);

    const numberedShapes = numberCustomShapes(customShapes);

    // Skip manual orange permit overlay; rely on underlying dashed permit styling if present
    // drawPermitAreaOnPdf(pdf, focusedArea, project, toMm);
    drawInfrastructureOnPdf(pdf, layers, infrastructureData, project, toMm, pngIcons);
    drawDroppedObjectsOnPdf(pdf, droppedObjects, project, toMm);
    drawCustomShapesOnPdf(pdf, numberedShapes, project, toMm);

    drawLegendOnPdf(pdf, { x: legendMm.x, y: legendMm.y, width: legendMm.width, height: legendMm.height }, layers, numberedShapes, droppedObjects, focusedArea, pngIcons);

    pdf.save(`siteplan-${getSafeFilename(focusedArea)}.pdf`);
    cleanupOffscreen(offscreen, container);
  } catch (error) {
    console.error('Export failed:', error);
    alert(`Export failed: ${error.message}`);
  }
};

const cleanupOffscreen = (offscreen, container) => {
  try { offscreen.remove(); } catch {}
  if (container && container.parentNode) container.parentNode.removeChild(container);
};

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.crossOrigin = 'anonymous';
  img.src = src;
});

const numberCustomShapes = (features) => {
  if (!features || features.length === 0) return [];
  const sorted = [...features].sort((a, b) => {
    const ta = a.geometry?.type || '';
    const tb = b.geometry?.type || '';
    if (ta !== tb) return ta.localeCompare(tb);
    const la = (a.properties?.label || '').toLowerCase();
    const lb = (b.properties?.label || '').toLowerCase();
    return la.localeCompare(lb);
  });
  return sorted.map((f, idx) => ({ ...f, properties: { ...f.properties, __number: idx + 1 } }));
};

const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#333333');
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 51, g: 51, b: 51 };
};

const centroidOfRing = (ring) => {
  let x = 0, y = 0;
  ring.forEach(p => { x += p.x; y += p.y; });
  return { x: x / ring.length, y: y / ring.length };
};

// Remove duplicate closing point if present (first == last)
const normalizeRingPoints = (points) => {
  if (!points || points.length < 2) return points || [];
  const first = points[0];
  const last = points[points.length - 1];
  if (Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.y - last.y) < 1e-6) {
    return points.slice(0, -1);
  }
  return points;
};

const drawPermitAreaOnPdf = (pdf, focusedArea, project, toMm) => {
  if (!focusedArea?.geometry) return;
  const drawPolygon = (coords) => {
    let pts = coords.map(([lng, lat]) => toMm(project(lng, lat)));
    pts = normalizeRingPoints(pts);
    if (pts.length < 3) return;
    const segments = pts.slice(1).map(p => [p.x - pts[0].x, p.y - pts[0].y]);
    // Fill (semi-transparent)
    pdf.saveGraphicsState && pdf.saveGraphicsState();
    const gs = new pdf.GState({ opacity: 0.12 });
    if (pdf.setGState) pdf.setGState(gs);
    pdf.setFillColor(249, 115, 22);
    pdf.lines(segments, pts[0].x, pts[0].y, [1, 1], 'F', true);
    pdf.restoreGraphicsState && pdf.restoreGraphicsState();
    // Stroke
    pdf.setDrawColor(249, 115, 22);
    pdf.setLineWidth(0.5);
    pdf.lines(segments, pts[0].x, pts[0].y, [1, 1], 'S', true);
  };
  if (focusedArea.geometry.type === 'Polygon') {
    drawPolygon(focusedArea.geometry.coordinates[0]);
  } else if (focusedArea.geometry.type === 'MultiPolygon') {
    focusedArea.geometry.coordinates.forEach(poly => drawPolygon(poly[0]));
  }
};

const drawInfrastructureOnPdf = (pdf, layers, infrastructureData, project, toMm, pngIcons) => {
  if (!layers) return;
  const entries = Object.entries(layers).filter(([id, cfg]) => id !== 'permitAreas' && cfg.visible);
  entries.forEach(([layerId, cfg]) => {
    const color = hexToRgb(cfg.color || '#333333');
    const data = infrastructureData?.[layerId];
    if (!data?.features) return;
    pdf.setDrawColor(color.r, color.g, color.b);
    pdf.setFillColor(color.r, color.g, color.b);
    data.features.forEach((feat) => {
      const g = feat.geometry;
      if (!g) return;
      if (g.type === 'Point') {
        const p = toMm(project(g.coordinates[0], g.coordinates[1]));
        const iconSrc = pngIcons?.[layerId];
        if (iconSrc) {
          pdf.addImage(iconSrc, 'PNG', p.x - 1.5, p.y - 1.5, 3, 3);
        } else {
          pdf.circle(p.x, p.y, 1.2, 'F');
        }
      } else if (g.type === 'LineString') {
        const coords = g.coordinates.map(([lng, lat]) => toMm(project(lng, lat)));
        if (coords.length < 2) return;
        pdf.setLineWidth(0.4);
        pdf.lines(
          coords.slice(1).map(p => [p.x - coords[0].x, p.y - coords[0].y]),
          coords[0].x,
          coords[0].y,
          [1, 1],
          'S',
          false
        );
      } else if (g.type === 'MultiLineString') {
        g.coordinates.forEach(line => {
          const coords = line.map(([lng, lat]) => toMm(project(lng, lat)));
          if (coords.length < 2) return;
          pdf.setLineWidth(0.4);
          pdf.lines(
            coords.slice(1).map(p => [p.x - coords[0].x, p.y - coords[0].y]),
            coords[0].x,
            coords[0].y,
            [1, 1],
            'S',
            false
          );
        });
      } else if (g.type === 'Polygon') {
        let ring = g.coordinates[0].map(([lng, lat]) => toMm(project(lng, lat)));
        ring = normalizeRingPoints(ring);
        if (ring.length < 3) return;
        const segs = ring.slice(1).map(p => [p.x - ring[0].x, p.y - ring[0].y]);
        // Fill light
        pdf.saveGraphicsState && pdf.saveGraphicsState();
        if (pdf.setGState) pdf.setGState(new pdf.GState({ opacity: 0.12 }));
        pdf.setFillColor(color.r, color.g, color.b);
        pdf.lines(segs, ring[0].x, ring[0].y, [1, 1], 'F', true);
        pdf.restoreGraphicsState && pdf.restoreGraphicsState();
        // Stroke
        pdf.setDrawColor(color.r, color.g, color.b);
        pdf.setLineWidth(0.4);
        pdf.lines(segs, ring[0].x, ring[0].y, [1, 1], 'S', true);
      } else if (g.type === 'MultiPolygon') {
        g.coordinates.forEach(poly => {
          let ring = poly[0].map(([lng, lat]) => toMm(project(lng, lat)));
          ring = normalizeRingPoints(ring);
          if (ring.length < 3) return;
          const segs = ring.slice(1).map(p => [p.x - ring[0].x, p.y - ring[0].y]);
          pdf.saveGraphicsState && pdf.saveGraphicsState();
          if (pdf.setGState) pdf.setGState(new pdf.GState({ opacity: 0.12 }));
          pdf.setFillColor(color.r, color.g, color.b);
          pdf.lines(segs, ring[0].x, ring[0].y, [1, 1], 'F', true);
          pdf.restoreGraphicsState && pdf.restoreGraphicsState();
          pdf.setDrawColor(color.r, color.g, color.b);
          pdf.setLineWidth(0.4);
          pdf.lines(segs, ring[0].x, ring[0].y, [1, 1], 'S', true);
        });
      }
    });
  });
};

const drawDroppedObjectsOnPdf = (pdf, droppedObjects, project, toMm) => {
  if (!droppedObjects || droppedObjects.length === 0) return;
  droppedObjects.forEach((obj) => {
    const p = toMm(project(obj.position.lng, obj.position.lat));
    pdf.setFillColor(40, 40, 40);
    pdf.circle(p.x, p.y, 1.8, 'F');
  });
};

const drawCustomShapesOnPdf = (pdf, shapes, project, toMm) => {
  if (!shapes || shapes.length === 0) return;
  pdf.setDrawColor(59, 130, 246);
  pdf.setFillColor(59, 130, 246);
  shapes.forEach((shape) => {
    const g = shape.geometry;
    if (!g) return;
    let labelPoint = null;
    if (g.type === 'Point') {
      const p = toMm(project(g.coordinates[0], g.coordinates[1]));
      pdf.circle(p.x, p.y, 1.2, 'F');
      labelPoint = p;
    } else if (g.type === 'LineString') {
      const coords = g.coordinates.map(([lng, lat]) => toMm(project(lng, lat)));
      if (coords.length < 2) return;
      pdf.setLineWidth(0.5);
      pdf.lines(
        coords.slice(1).map(p => [p.x - coords[0].x, p.y - coords[0].y]),
        coords[0].x,
        coords[0].y,
        [1, 1],
        'S',
        false
      );
      labelPoint = coords[Math.floor(coords.length / 2)];
    } else if (g.type === 'Polygon') {
      const ring = g.coordinates[0].map(([lng, lat]) => toMm(project(lng, lat)));
      if (ring.length < 2) return;
      pdf.lines(
        ring.slice(1).map(p => [p.x - ring[0].x, p.y - ring[0].y]),
        ring[0].x,
        ring[0].y,
        [1, 1],
        'FD',
        true
      );
      labelPoint = centroidOfRing(ring);
    }
    if (labelPoint) drawBadge(pdf, labelPoint.x, labelPoint.y, String(shape.properties?.__number || '?'));
  });
};

const drawBadge = (pdf, x, y, text) => {
  const r = 3.2;
  pdf.setFillColor(255, 255, 255);
  pdf.circle(x, y, r, 'F');
  pdf.setDrawColor(59, 130, 246);
  pdf.setLineWidth(0.4);
  pdf.circle(x, y, r, 'S');
  pdf.setTextColor(59, 130, 246);
  pdf.setFontSize(8);
  pdf.text(text, x, y + 2.2, { align: 'center', baseline: 'middle' });
};

const drawLegendOnPdf = (pdf, rect, layers, numberedShapes, droppedObjects, focusedArea, pngIcons) => {
  // Solid white background behind legend so map content doesn't show through
  pdf.setFillColor(255, 255, 255);
  pdf.rect(rect.x, rect.y, rect.width, rect.height, 'F');

  const margin = 6;
  let cursorY = rect.y + margin;
  const leftX = rect.x + margin;
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(14);
  pdf.text(`Site Plan: ${focusedArea?.properties?.name || 'Permit Area'}`.slice(0, 80), leftX, cursorY);
  cursorY += 8;
  pdf.setFontSize(10);
  pdf.setTextColor(55, 65, 81);
  pdf.text('Layers', leftX, cursorY);
  cursorY += 5;
  Object.entries(layers)
    .filter(([id, cfg]) => id !== 'permitAreas' && cfg.visible)
    .forEach(([id, cfg]) => {
      // Try to use real icon if available
      const icon = INFRASTRUCTURE_ICONS[id];
      const png = pngIcons?.[id] || (icon && icon.type === 'png' ? icon.src : null);
      if (png) {
        // Embed PNG icon
        pdf.addImage(png, 'PNG', leftX, cursorY - 6, 6, 6);
      } else if (icon && icon.type === 'svg') {
        // Fallback: colored square using configured color
        const c = hexToRgb(cfg.color || '#333');
        pdf.setFillColor(c.r, c.g, c.b);
        pdf.rect(leftX, cursorY - 3.5, 6, 6, 'F');
      } else {
        const c = hexToRgb(cfg.color || '#333');
        pdf.setFillColor(c.r, c.g, c.b);
        pdf.rect(leftX, cursorY - 3.5, 6, 6, 'F');
      }
      pdf.setTextColor(55, 65, 81);
      pdf.text(String(cfg.name || id), leftX + 9, cursorY);
      cursorY += 6;
    });
  cursorY += 2;
  pdf.setTextColor(55, 65, 81);
  pdf.text('Equipment', leftX, cursorY);
  cursorY += 5;
  const counts = (droppedObjects || []).reduce((acc, o) => { acc[o.type] = (acc[o.type] || 0) + 1; return acc; }, {});
  Object.entries(counts).forEach(([type, count]) => {
    // Use the object icon if available
    const objType = PLACEABLE_OBJECTS.find(p => p.id === type);
    if (objType && objType.icon) {
      pdf.setTextColor(55, 65, 81);
      pdf.text(objType.icon, leftX + 3, cursorY + 1, { align: 'center', baseline: 'middle' });
    } else {
      pdf.setFillColor(100, 100, 100);
      pdf.rect(leftX, cursorY - 3.5, 6, 6, 'F');
    }
    pdf.setTextColor(55, 65, 81);
    pdf.text(`${objType?.name || type} (${count})`, leftX + 9, cursorY);
    cursorY += 6;
  });
  cursorY += 2;
  pdf.setTextColor(55, 65, 81);
  pdf.text('Annotations', leftX, cursorY);
  cursorY += 5;
  (numberedShapes || []).forEach((shape) => {
    const num = shape.properties?.__number;
    const label = shape.properties?.label || shape.geometry?.type || 'Shape';
    pdf.setTextColor(31, 41, 55);
    pdf.text(`${num}. ${label}`.slice(0, 80), leftX, cursorY);
    cursorY += 5;
  });
};

// (Old scale bar and compass helpers removed in V2 export)

// (Old compass helper removed in V2 export)

// (Old metadata helper removed in V2 export)

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

// Preload PNG icons for visible layers; returns a map { layerId: src }
const loadVisiblePngIcons = async (layers) => {
  const result = {};
  try {
    Object.entries(layers)
      .filter(([id, cfg]) => id !== 'permitAreas' && cfg.visible)
      .forEach(([id]) => {
        const icon = INFRASTRUCTURE_ICONS[id];
        if (icon && icon.type === 'png' && icon.src) {
          result[id] = icon.src; // Same-origin PNGs in /public
        }
      });
  } catch {}
  return result;
};

// Draw visible infrastructure overlays onto PNG canvas (points with icons, lines with stroke; polygons skipped)
const drawOverlaysOnCanvas = (ctx, offscreen, mapPx, originPx, layers, customShapes, droppedObjects, infrastructureData, focusedArea, pngIcons) => {
  const project = (lng, lat) => offscreen.project([lng, lat]);
  Object.entries(layers)
    .filter(([id, cfg]) => id !== 'permitAreas' && cfg.visible)
    .forEach(([id, cfg]) => {
      const data = infrastructureData?.[id];
      if (!data?.features) return;
      const color = cfg.color || '#333333';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      data.features.forEach((feat) => {
        const g = feat.geometry;
        if (!g) return;
        if (g.type === 'Point') {
          const p = project(g.coordinates[0], g.coordinates[1]);
          const iconSrc = pngIcons?.[id];
          if (iconSrc) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, p.x + originPx.x - 6, p.y + originPx.y - 6, 12, 12);
            img.src = iconSrc;
          } else {
            ctx.beginPath();
            ctx.arc(p.x + originPx.x, p.y + originPx.y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (g.type === 'LineString') {
          const pts = g.coordinates.map(([lng, lat]) => project(lng, lat));
          ctx.beginPath();
          pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x + originPx.x, p.y + originPx.y) : ctx.lineTo(p.x + originPx.x, p.y + originPx.y));
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (g.type === 'MultiLineString') {
          g.coordinates.forEach(line => {
            const pts = line.map(([lng, lat]) => project(lng, lat));
            ctx.beginPath();
            pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x + originPx.x, p.y + originPx.y) : ctx.lineTo(p.x + originPx.x, p.y + originPx.y));
            ctx.lineWidth = 2;
            ctx.stroke();
          });
        }
        // Intentionally skip Polygon/MultiPolygon to avoid misalignment and unwanted fills
      });
    });
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