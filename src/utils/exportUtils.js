// utils/exportUtils.js
import { PLACEABLE_OBJECTS } from '../constants/placeableObjects';
import { getIconDataUrl, INFRASTRUCTURE_ICONS } from './iconUtils';

import { switchBasemap } from './mapUtils';

// Detect current basemap key used by the app (carto or satellite)
const detectBasemapKey = (map) => {
  try {
    if (map?.getLayer && map.getLayer('nyc-satellite-layer')) return 'satellite';
    const style = map?.getStyle ? map.getStyle() : null;
    if (style?.sprite && String(style.sprite).includes('cartocdn')) return 'carto';
  } catch (_) {}
  return 'carto';
};

// Export siteplan/event plan (versioned JSON serializer)
// options: { geographyType?: string, focusedArea?: object, appVersion?: string }
export const exportPlan = (map, draw, droppedObjects, layers, customShapes, options = {}) => {
  if (!map || !draw) return;

  const { geographyType = 'parks', focusedArea = null, appVersion = undefined } = options || {};

  const nowIso = new Date().toISOString();
  const center = map.getCenter();
  const data = {
    schemaVersion: 1,
    app: { name: 'space-stager', version: appVersion },
    createdAt: nowIso,
    updatedAt: nowIso,
    geography: { type: geographyType },
    focusedArea: focusedArea ? {
      id: focusedArea.id ?? undefined,
      system: focusedArea.properties?.system ?? undefined,
      name: focusedArea.properties?.name ?? undefined,
      // Minimal fallback geometry so a consumer could refocus if needed
      geometry: focusedArea.geometry ?? undefined
    } : null,
    basemap: { key: detectBasemapKey(map) },
    view: {
      center: { lng: center.lng, lat: center.lat },
      zoom: map.getZoom(),
      bearing: typeof map.getBearing === 'function' ? map.getBearing() : 0,
      pitch: typeof map.getPitch === 'function' ? map.getPitch() : 0
    },
    layers: layers,
    customShapes: draw.current ? draw.current.getAll() : { type: 'FeatureCollection', features: [] },
    droppedObjects: droppedObjects
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `siteplan-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

// Import event plan
// Import siteplan/event plan from JSON (supports v0 legacy and v1 schema)
// helpers: { selectGeography?: (type) => void, focusAreaByIdentity?: ({ type, system, id }) => void }
export const importPlan = (eOrFile, map, draw, setCustomShapes, setDroppedObjects, setLayers, helpers = {}) => {
  const file = eOrFile && eOrFile.target && eOrFile.target.files ? eOrFile.target.files[0] : eOrFile;
  if (!file || !map || !draw) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);

      const isV1 = typeof data.schemaVersion === 'number' && data.schemaVersion >= 1;

      // Restore basemap (best-effort)
      try {
        const key = isV1 ? (data.basemap?.key || 'carto') : 'carto';
        await switchBasemap(map, key);
      } catch (_) {}

      // Restore geography and focus
      try {
        if (isV1 && data.geography?.type && typeof helpers.selectGeography === 'function') {
          helpers.selectGeography(data.geography.type);
        }
      } catch (_) {}
      try {
        if (isV1 && data.focusedArea && typeof helpers.focusAreaByIdentity === 'function') {
          const ident = { type: data.geography?.type, system: data.focusedArea.system, id: data.focusedArea.id };
          helpers.focusAreaByIdentity(ident);
        }
      } catch (_) {}

      // Restore layers
      try {
        if (setLayers && (isV1 ? data.layers : data.layers)) {
          setLayers(data.layers);
        }
      } catch (_) {}

      // Restore shapes
      try {
        const shapes = isV1 ? data.customShapes : (data.customShapes || { type: 'FeatureCollection', features: [] });
        if (shapes && draw?.current?.set) {
          draw.current.set(shapes);
        }
      } catch (_) {}

      // Restore dropped objects
      try {
        if (setDroppedObjects && (isV1 ? data.droppedObjects : data.droppedObjects)) {
          setDroppedObjects(data.droppedObjects || []);
        }
      } catch (_) {}

      // Restore map view
      try {
        if (isV1 && data.view) {
          if (data.view.center) map.setCenter(data.view.center);
          if (typeof data.view.zoom === 'number') map.setZoom(data.view.zoom);
          if (typeof data.view.bearing === 'number' && map.setBearing) map.setBearing(data.view.bearing);
          if (typeof data.view.pitch === 'number' && map.setPitch) map.setPitch(data.view.pitch);
        } else if (data.metadata) {
          if (data.metadata.center) map.setCenter(data.metadata.center);
          if (typeof data.metadata.zoom === 'number') map.setZoom(data.metadata.zoom);
        }
      } catch (_) {}
    } catch (error) {
      console.error('Error importing plan:', error);
      alert('Error importing plan. Please check the file format.');
    }
  };
  reader.readAsText(file);
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

    const debugPitch0 = isExportDebug() && (localStorage.getItem('EXPORT_DEBUG_PITCH0') === 'true');
    const ISOMETRIC_PITCH_DEG = 45;
    offscreen.setPitch(debugPitch0 ? 0 : ISOMETRIC_PITCH_DEG);
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
      // Hide any MapboxDraw layers on the offscreen style; we render annotations ourselves
      try {
        const style = offscreen.getStyle();
        style.layers?.forEach(layer => {
          const id = layer.id || '';
          if (id.startsWith('mapbox-gl-draw') || id.startsWith('gl-draw')) {
            try { offscreen.setLayoutProperty(id, 'visibility', 'none'); } catch (_) {}
          }
        });
      } catch (_) {}
    } catch (_) {}

    // Fit bounds to the left 75% viewport without scaling the image output
    offscreen.fitBounds(bounds, { padding: 12, duration: 0 });

    await new Promise((resolve) => {
      if (offscreen.loaded() && offscreen.areTilesLoaded()) resolve();
      else offscreen.once('idle', resolve);
    });

    const baseCanvas = offscreen.getCanvas();
    if (isExportDebug()) {
      try {
        const dpr = window.devicePixelRatio || 1;
        console.log('[ExportDebug] dpr', dpr, 'offscreen CSS', { w: mapPx.width, h: mapPx.height }, 'offscreen backing', { w: baseCanvas.width, h: baseCanvas.height });
      } catch (_) {}
    }
    const baseImageUrl = baseCanvas.toDataURL('image/png');
    if (!baseImageUrl || baseImageUrl === 'data:,') throw new Error('Failed to capture basemap image');

    // Preload PNG icons for visible layers for both PDF and PNG flows
    const pngIcons = await loadVisibleLayerIconsAsPngDataUrls(layers);
    const droppedObjectPngs = await loadDroppedObjectIconPngs(droppedObjects);
    // Collect street parking regulations and parking meters separately within the focused area
    const regulationFeatures = (infrastructureData?.streetParkingSigns?.features || []).filter(f => f && f.geometry && f.geometry.type === 'Point');
    const meterFeatures = (infrastructureData?.parkingMeters?.features || []).filter(f => f && f.geometry && f.geometry.type === 'Point');
    const regulationsInArea = numberParkingFeaturesWithinArea(regulationFeatures, focusedArea);
    const metersInArea = numberParkingFeaturesWithinArea(meterFeatures, focusedArea);

    if (format === 'png') {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(pageMm.width * pxPerMm);
      canvas.height = Math.round(pageMm.height * pxPerMm);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const img = await loadImage(baseImageUrl);
      if (isExportDebug()) {
        console.log('[ExportDebug] baseImage natural size', { w: img.naturalWidth || img.width, h: img.naturalHeight || img.height }, 'dest draw', mapPx);
      }
      ctx.drawImage(img, 0, 0, mapPx.width, mapPx.height);

      drawOverlaysOnCanvas(ctx, offscreen, mapPx, { x: 0, y: 0 }, layers, customShapes, droppedObjects, infrastructureData, focusedArea, pngIcons);
      drawCustomShapesOnCanvas(ctx, { x: 0, y: 0, width: mapPx.width, height: mapPx.height }, offscreen, customShapes);
      // Label regulations (P) and meters (M) on the map image
      if (regulationsInArea.length > 0) {
        drawParkingFeatureLabelsOnCanvas(ctx, offscreen, { x: 0, y: 0 }, regulationsInArea, 'P');
      }
      if (metersInArea.length > 0) {
        drawParkingFeatureLabelsOnCanvas(ctx, offscreen, { x: 0, y: 0 }, metersInArea, 'M');
      }
      // Draw dropped objects on top of basemap and overlays
      await drawDroppedObjectsOnCanvas(ctx, { x: 0, y: 0, width: mapPx.width, height: mapPx.height }, offscreen, droppedObjects);

      const legendPx = { x: mapPx.width, y: 0, width: canvas.width - mapPx.width, height: canvas.height };
      const numbered = numberCustomShapes(customShapes || []);
      await drawLegendOnCanvas(ctx, legendPx, layers, numbered, droppedObjects, focusedArea, pngIcons, droppedObjectPngs);

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
    drawInfrastructureOnPdf(pdf, layers, infrastructureData, project, toMm, mmFromPx, pngIcons);
    // Label regulations (P) and meters (M) on PDF map page
    if (regulationsInArea.length > 0) {
      drawParkingFeatureLabelsOnPdf(pdf, project, toMm, regulationsInArea, 'P');
    }
    if (metersInArea.length > 0) {
      drawParkingFeatureLabelsOnPdf(pdf, project, toMm, metersInArea, 'M');
    }
    drawDroppedObjectsOnPdf(pdf, droppedObjects, project, toMm, droppedObjectPngs);
    drawCustomShapesOnPdf(pdf, numberedShapes, project, toMm);

    drawLegendOnPdf(pdf, { x: legendMm.x, y: legendMm.y, width: legendMm.width, height: legendMm.height }, layers, numberedShapes, droppedObjects, focusedArea, pngIcons, droppedObjectPngs);

    // Add separate tables for meters and regulations
    if (metersInArea.length > 0) {
      pdf.addPage('a4', 'landscape');
      drawParkingMetersSummaryPage(pdf, metersInArea);
    }
    if (regulationsInArea.length > 0) {
      pdf.addPage('a4', 'landscape');
      drawParkingSignsSummaryPage(pdf, regulationsInArea);
    }

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

// Canvas legend renderer (for PNG export)
// Basic greedy word-wrap for Canvas 2D contexts using current ctx.font
const wrapCanvasLines = (ctx, text, maxWidth) => {
  if (!text) return [];
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i += 1) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      // If a single word is longer than maxWidth, hard-break it
      if (ctx.measureText(words[i]).width > maxWidth) {
        let chunk = '';
        for (const ch of words[i]) {
          const trial = chunk + ch;
          if (ctx.measureText(trial).width <= maxWidth) chunk = trial; else { lines.push(chunk); chunk = ch; }
        }
        line = chunk;
      } else {
        line = words[i];
      }
    }
  }
  if (line) lines.push(line);
  return lines;
};

const drawLegendOnCanvas = async (ctx, rectPx, layers, numberedShapes, droppedObjects, focusedArea, pngIcons, droppedObjectImages) => {
  // background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(rectPx.x, rectPx.y, rectPx.width, rectPx.height);

  const margin = 12;
  let cursorY = rectPx.y + margin;
  const leftX = rectPx.x + margin;

  // Title (wrapped)
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const title = `Site Plan: ${String(focusedArea?.properties?.name || 'Permit Area')}`;
  const titleMaxWidth = rectPx.width - 2 * margin;
  const titleLines = wrapCanvasLines(ctx, title, titleMaxWidth);
  const titleLineHeight = 22;
  titleLines.forEach((line, idx) => {
    ctx.fillText(line, leftX, cursorY + idx * titleLineHeight);
  });
  cursorY += titleLines.length * titleLineHeight;

  // Layers header
  cursorY += 12;
  ctx.fillStyle = '#374151';
  ctx.font = '12px Arial';
  ctx.fillText('Layers', leftX, cursorY);
  cursorY += 8;

  // Visible layers list with PNG icons if available
  for (const [id, cfg] of Object.entries(layers)) {
    if (id === 'permitAreas' || !cfg.visible) continue;
    const png = pngIcons?.[id];
    if (png) {
      try {
        const img = await loadImage(png);
        ctx.drawImage(img, leftX, cursorY - 10, 12, 12);
      } catch {}
    } else {
      // fallback colored square
      ctx.fillStyle = cfg.color || '#333333';
      ctx.fillRect(leftX, cursorY - 8, 10, 10);
    }
    // Wrapped layer name next to icon
    ctx.fillStyle = '#374151';
    ctx.font = '12px Arial';
    const layerText = String(cfg.name || id);
    const textX = leftX + 16;
    const maxTextWidth = rectPx.width - 2 * margin - 16;
    const lines = wrapCanvasLines(ctx, layerText, maxTextWidth);
    const lineH = 16;
    lines.forEach((line, li) => {
      ctx.fillText(line, textX, cursorY + li * lineH);
    });
    cursorY += Math.max(lineH, lines.length * lineH);
  }

  // Equipment header
  cursorY += 4;
  ctx.fillStyle = '#374151';
  ctx.font = '12px Arial';
  ctx.fillText('Equipment', leftX, cursorY);
  cursorY += 8;

  // Aggregated dropped objects with images
  const counts = (droppedObjects || []).reduce((acc, o) => { acc[o.type] = (acc[o.type] || 0) + 1; return acc; }, {});
  for (const [type, count] of Object.entries(counts)) {
    const objType = PLACEABLE_OBJECTS.find(p => p.id === type);
    if (objType?.imageUrl) {
      try {
        const img = await loadImage(objType.imageUrl);
        ctx.drawImage(img, leftX, cursorY - 10, 14, 14);
      } catch {
        ctx.fillStyle = '#666666';
        ctx.fillRect(leftX, cursorY - 8, 10, 10);
      }
    } else {
      ctx.fillStyle = '#666666';
      ctx.fillRect(leftX, cursorY - 8, 10, 10);
    }
    // Wrapped equipment entry
    ctx.fillStyle = '#374151';
    ctx.font = '12px Arial';
    const equipText = `${objType?.name || type} (${count})`;
    const equipX = leftX + 18;
    const equipMaxWidth = rectPx.width - 2 * margin - 18;
    const equipLines = wrapCanvasLines(ctx, equipText, equipMaxWidth);
    const equipLineH = 16;
    equipLines.forEach((line, li) => ctx.fillText(line, equipX, cursorY + li * equipLineH));
    cursorY += Math.max(equipLineH, equipLines.length * equipLineH);
  }

  // Annotations header
  cursorY += 4;
  ctx.fillStyle = '#374151';
  ctx.font = '12px Arial';
  ctx.fillText('Annotations', leftX, cursorY);
  cursorY += 8;

  // Numbered annotations list (wrapped)
  (numberedShapes || []).forEach((shape) => {
    const num = shape.properties?.__number;
    const label = shape.properties?.label || shape.geometry?.type || 'Shape';
    const text = `${num}. ${label}`;
    ctx.fillStyle = '#1f2937';
    ctx.font = '12px Arial';
    const lines = wrapCanvasLines(ctx, text, rectPx.width - 2 * margin);
    const lineH = 14;
    lines.forEach((line, li) => ctx.fillText(line, leftX, cursorY + li * lineH));
    cursorY += Math.max(lineH, lines.length * lineH);
  });
};

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

// Convert array of absolute points [{x,y}, ...] to jsPDF relative segment vectors [[dx,dy], ...]
const toRelativeSegments = (points) => {
  if (!points || points.length < 2) return [];
  const segments = [];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const cur = points[i];
    segments.push([cur.x - prev.x, cur.y - prev.y]);
  }
  return segments;
};

const drawPermitAreaOnPdf = (pdf, focusedArea, project, toMm) => {
  if (!focusedArea?.geometry) return;
  const drawPolygon = (coords) => {
    let pts = coords.map(([lng, lat]) => toMm(project(lng, lat)));
    pts = normalizeRingPoints(pts);
    if (pts.length < 3) return;
    const segments = toRelativeSegments(pts);
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

const drawInfrastructureOnPdf = (pdf, layers, infrastructureData, project, toMm, mmFromPx, pngIcons) => {
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
        // Treat fire lanes and disaster routes as lines only (no icons)
        if (layerId === 'fireLanes' || layerId === 'specialDisasterRoutes') return;
        const p = toMm(project(g.coordinates[0], g.coordinates[1]));
        const iconSrc = pngIcons?.[layerId];
        if (iconSrc) {
          // Match (and slightly upscale) UI symbol size for print legibility
          const areaScale = (INFRASTRUCTURE_ICONS[layerId]?.areaScale ?? 1);
          const sizeScale = Math.sqrt(areaScale);
          const uiPx = 72 * sizeScale; // 1.5x larger than previous (48px * 1.5)
          let w = uiPx * mmFromPx.x;
          let h = uiPx * mmFromPx.y;
          // Ensure a minimum physical size for readability
          const minMm = 3.8;
          w = Math.max(w, minMm);
          h = Math.max(h, minMm);
          pdf.addImage(iconSrc, 'PNG', p.x - w / 2, p.y - h / 2, w, h);
        } else {
          pdf.circle(p.x, p.y, 1.2, 'F');
        }
      } else if (g.type === 'LineString') {
        const coords = g.coordinates.map(([lng, lat]) => toMm(project(lng, lat)));
        if (coords.length < 2) return;
        // Thicker, semi-transparent bike lanes; default for others
        const isBike = layerId === 'bikeLanes';
        const lw = isBike ? 1.2 : 0.6;
        pdf.setLineWidth(lw);
        // Apply 0.6 opacity for bike lanes when supported
        let restoreOpacity = false;
        if (isBike && pdf.setGState) {
          try {
            const gs = new pdf.GState({ opacity: 0.6 });
            pdf.setGState(gs);
            restoreOpacity = true;
          } catch (_) {}
        }
        pdf.lines(toRelativeSegments(coords), coords[0].x, coords[0].y, [1, 1], 'S', false);
        if (restoreOpacity && pdf.saveGraphicsState && pdf.restoreGraphicsState) {
          try { pdf.restoreGraphicsState(); } catch (_) {}
        }
      } else if (g.type === 'MultiLineString') {
        g.coordinates.forEach(line => {
          const coords = line.map(([lng, lat]) => toMm(project(lng, lat)));
          if (coords.length < 2) return;
          const isBike = layerId === 'bikeLanes';
          const lw = isBike ? 1.2 : 0.6;
          pdf.setLineWidth(lw);
          let restoreOpacity = false;
          if (isBike && pdf.setGState) {
            try {
              const gs = new pdf.GState({ opacity: 0.6 });
              pdf.setGState(gs);
              restoreOpacity = true;
            } catch (_) {}
          }
          pdf.lines(toRelativeSegments(coords), coords[0].x, coords[0].y, [1, 1], 'S', false);
          if (restoreOpacity && pdf.saveGraphicsState && pdf.restoreGraphicsState) {
            try { pdf.restoreGraphicsState(); } catch (_) {}
          }
        });
      } else if (g.type === 'Polygon') {
        let ring = g.coordinates[0].map(([lng, lat]) => toMm(project(lng, lat)));
        ring = normalizeRingPoints(ring);
        if (ring.length < 3) return;
        const segs = toRelativeSegments(ring);
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
          const segs = toRelativeSegments(ring);
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

const drawDroppedObjectsOnPdf = (pdf, droppedObjects, project, toMm, droppedObjectPngs) => {
  if (!droppedObjects || droppedObjects.length === 0) return;
  droppedObjects.forEach((obj) => {
    const p = toMm(project(obj.position.lng, obj.position.lat));
    const objType = PLACEABLE_OBJECTS.find(p => p.id === obj.type);
    const imgPng = droppedObjectPngs?.[obj.type];
    if (imgPng) {
      try {
        // Scale up 3x compared to base size
        const basePx = Math.max((objType.size?.width || 28), (objType.size?.height || 28)) * 3;
        const sizeMm = basePx * 0.2645 / 3; // rough px->mm mapping aligned to earlier scale
        // jsPDF lacks a stable per-image mirror API across builds; render unflipped for PDF
        pdf.addImage(imgPng, 'PNG', p.x - sizeMm / 2, p.y - sizeMm / 2, sizeMm, sizeMm);
      } catch (e) {
        pdf.setFillColor(40, 40, 40);
        pdf.circle(p.x, p.y, 1.8, 'F');
      }
    } else {
      pdf.setFillColor(40, 40, 40);
      pdf.circle(p.x, p.y, 1.8, 'F');
    }
  });
};

const drawCustomShapesOnPdf = (pdf, shapes, project, toMm) => {
  if (!shapes || shapes.length === 0) return;
  pdf.setDrawColor(59, 130, 246);
  // Remove fills for custom annotations to avoid mismatched geometry rendering
  shapes.forEach((shape) => {
    const g = shape.geometry;
    if (!g) return;
    let labelPoint = null;
    if (g.type === 'Point') {
      const p = toMm(project(g.coordinates[0], g.coordinates[1]));
      pdf.circle(p.x, p.y, 1.2, 'S');
      labelPoint = p;
    } else if (g.type === 'LineString') {
      const coords = g.coordinates.map(([lng, lat]) => toMm(project(lng, lat)));
      if (coords.length < 2) return;
      if (isExportDebug()) {
        coords.forEach((p, i) => console.log('[ExportDebug][PDF] line vertex', i, p));
      }
      pdf.setLineWidth(0.5);
      pdf.lines(toRelativeSegments(coords), coords[0].x, coords[0].y, [1, 1], 'S', false);
      labelPoint = coords[Math.floor(coords.length / 2)];
    } else if (g.type === 'Polygon') {
      const ring = g.coordinates[0].map(([lng, lat]) => toMm(project(lng, lat)));
      if (ring.length < 2) return;
      if (isExportDebug()) {
        ring.forEach((p, i) => console.log('[ExportDebug][PDF] poly vertex', i, p));
      }
      // Stroke-only outline, no fill, to avoid incorrect polygon fills
      pdf.setLineWidth(0.6);
      pdf.lines(toRelativeSegments(ring), ring[0].x, ring[0].y, [1, 1], 'S', true);
      labelPoint = centroidOfRing(ring);
    }
    if (labelPoint) drawBadge(pdf, labelPoint.x, labelPoint.y, String(shape.properties?.__number || '?'));
  });
};

const drawBadge = (pdf, x, y, text) => {
  const r = 3.2; // radius in mm
  // Circle background
  pdf.setFillColor(255, 255, 255);
  pdf.circle(x, y, r, 'F');
  // Circle stroke
  pdf.setDrawColor(59, 130, 246);
  pdf.setLineWidth(0.4);
  pdf.circle(x, y, r, 'S');
  // Centered number
  pdf.setTextColor(59, 130, 246);
  const fontSizePt = 8;
  pdf.setFontSize(fontSizePt);
  // Approximate text height in mm: 1pt ≈ 0.3528 mm
  const textHeightMm = fontSizePt * 0.3528;
  // Position baseline so text is visually centered within the circle
  const baselineOffset = textHeightMm * 0.35;
  pdf.text(text, x, y + baselineOffset, { align: 'center' });
};

// Basic greedy word-wrap for jsPDF given font size and available width
const wrapPdfLines = (pdf, text, maxWidthMm, fontSize = 10) => {
  if (!text) return [];
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  const w = (t) => pdf.getTextWidth(t) * (fontSize / pdf.getFontSize());
  for (let i = 0; i < words.length; i += 1) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (w(test) <= maxWidthMm) {
      line = test;
    } else {
      if (line) lines.push(line);
      // Hard-break very long single words
      if (w(words[i]) > maxWidthMm) {
        let chunk = '';
        for (const ch of words[i]) {
          const trial = chunk + ch;
          if (w(trial) <= maxWidthMm) chunk = trial; else { lines.push(chunk); chunk = ch; }
        }
        line = chunk;
      } else {
        line = words[i];
      }
    }
  }
  if (line) lines.push(line);
  return lines;
};

const drawLegendOnPdf = (pdf, rect, layers, numberedShapes, droppedObjects, focusedArea, pngIcons, droppedObjectPngs) => {
  // Solid white background behind legend so map content doesn't show through
  pdf.setFillColor(255, 255, 255);
  pdf.rect(rect.x, rect.y, rect.width, rect.height, 'F');

  const margin = 6;
  let cursorY = rect.y + margin;
  const leftX = rect.x + margin;
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(14);
  const title = `Site Plan: ${String(focusedArea?.properties?.name || 'Permit Area')}`;
  const titleWidth = rect.width - 2 * margin;
  const savedSize = pdf.getFontSize();
  pdf.setFontSize(14);
  wrapPdfLines(pdf, title, titleWidth, 14).forEach((line) => {
    pdf.text(line, leftX, cursorY);
    cursorY += 6;
  });
  pdf.setFontSize(10);
  pdf.setFontSize(10);
  pdf.setTextColor(55, 65, 81);
  pdf.text('Layers', leftX, cursorY);
  cursorY += 5;
  Object.entries(layers)
    .filter(([id, cfg]) => id !== 'permitAreas' && cfg.visible)
    .forEach(([id, cfg]) => {
      // Try to use real icon if available
      const icon = INFRASTRUCTURE_ICONS[id];
      const png = pngIcons?.[id] || null;
      if (png) {
        // Embed PNG icon at a larger, UI-consistent legend size
        pdf.addImage(png, 'PNG', leftX, cursorY - 7.5, 9, 9);
      } else if (icon && icon.type === 'svg') {
        // Fallback: colored square using configured color
        const c = hexToRgb(cfg.color || '#333');
        pdf.setFillColor(c.r, c.g, c.b);
        pdf.rect(leftX, cursorY - 4.5, 9, 9, 'F');
      } else {
        const c = hexToRgb(cfg.color || '#333');
        pdf.setFillColor(c.r, c.g, c.b);
        pdf.rect(leftX, cursorY - 4.5, 9, 9, 'F');
      }
      pdf.setTextColor(55, 65, 81);
      const txt = String(cfg.name || id);
      const maxW = rect.width - 2 * margin - 9;
      wrapPdfLines(pdf, txt, maxW).forEach((line) => {
        pdf.text(line, leftX + 9, cursorY);
        cursorY += 5;
      });
    });
  cursorY += 2;
  pdf.setTextColor(55, 65, 81);
  pdf.text('Equipment', leftX, cursorY);
  cursorY += 5;
  const counts = (droppedObjects || []).reduce((acc, o) => { acc[o.type] = (acc[o.type] || 0) + 1; return acc; }, {});
  Object.entries(counts).forEach(([type, count]) => {
    // Use the object icon if available
    const objType = PLACEABLE_OBJECTS.find(p => p.id === type);
    const iconPng = droppedObjectPngs?.[type] || null;
    if (iconPng) {
      try {
        pdf.addImage(iconPng, 'PNG', leftX, cursorY - 6, 10, 10);
      } catch {
        pdf.setFillColor(100, 100, 100);
        pdf.rect(leftX, cursorY - 3.5, 6, 6, 'F');
      }
    } else {
      pdf.setFillColor(100, 100, 100);
      pdf.rect(leftX, cursorY - 3.5, 6, 6, 'F');
    }
    pdf.setTextColor(55, 65, 81);
    const entry = `${objType?.name || type} (${count})`;
    const maxW2 = rect.width - 2 * margin - 9;
    wrapPdfLines(pdf, entry, maxW2).forEach((line) => {
      pdf.text(line, leftX + 9, cursorY);
      cursorY += 5;
    });
  });
  cursorY += 2;
  pdf.setTextColor(55, 65, 81);
  pdf.text('Annotations', leftX, cursorY);
  cursorY += 5;
  (numberedShapes || []).forEach((shape) => {
    const num = shape.properties?.__number;
    const label = shape.properties?.label || shape.geometry?.type || 'Shape';
    const text = `${num}. ${label}`;
    pdf.setTextColor(31, 41, 55);
    wrapPdfLines(pdf, text, rect.width - 2 * margin).forEach((line) => {
      pdf.text(line, leftX, cursorY);
      cursorY += 5;
    });
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
const rasterizeToPngDataUrl = async (src, size = 64) => {
  const img = await loadImage(src);
  const dpr = Math.max(2, Math.floor(window.devicePixelRatio || 1));
  const canvas = document.createElement('canvas');
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  // @ts-ignore
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  // Draw with contain, centered
  const scale = Math.min(size / img.width, size / img.height);
  const drawW = Math.round(img.width * scale);
  const drawH = Math.round(img.height * scale);
  const dx = Math.floor((size - drawW) / 2);
  const dy = Math.floor((size - drawH) / 2);
  ctx.drawImage(img, dx, dy, drawW, drawH);
  return canvas.toDataURL('image/png');
};

// Prepares visible layer icons as PNG data URLs for safe embedding in PDFs
const loadVisibleLayerIconsAsPngDataUrls = async (layers) => {
  const result = {};
  try {
    const entries = Object.entries(layers).filter(([id, cfg]) => id !== 'permitAreas' && cfg.visible);
    for (const [id] of entries) {
      const icon = INFRASTRUCTURE_ICONS[id];
      if (!icon || !icon.src) continue;
      // Rasterize everything into a PNG data URL for jsPDF compatibility
      try {
        result[id] = await rasterizeToPngDataUrl(icon.src, 96);
      } catch (e) {
        // ignore failures; caller will fall back
      }
    }
  } catch {}
  return result;
};

// Preload dropped object images to ensure consistency in canvas and PDF
// Prepare dropped object icons as PNG data URLs for jsPDF
const loadDroppedObjectIconPngs = async (droppedObjects) => {
  const map = {};
  if (!droppedObjects || droppedObjects.length === 0) return map;
  const uniqueTypes = Array.from(new Set(droppedObjects.map(o => o.type)));
  for (const type of uniqueTypes) {
    const objType = PLACEABLE_OBJECTS.find(p => p.id === type);
    if (objType?.imageUrl) {
      try {
        // High-res rasterization for crisp PDF rendering
        map[type] = await rasterizeToPngDataUrl(objType.imageUrl, 192);
      } catch {
        // ignore
      }
    }
  }
  return map;
};

// Project and draw P{index} labels for parking signs on canvas
const drawParkingFeatureLabelsOnCanvas = (ctx, offscreen, originPx, features, prefix) => {
  const project = (lng, lat) => offscreen.project([lng, lat]);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 11px Arial';
  features.forEach((s) => {
    const p = project(s.lng, s.lat);
    const x = originPx.x + p.x;
    const y = originPx.y + p.y;
    const label = `${prefix}${s.index}`;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    const w = ctx.measureText(label).width + 6;
    const h = 14;
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = '#111827';
    ctx.fillText(label, x, y + 0.5);
  });
  ctx.restore();
};

// Draw prefixed labels for parking features on PDF
const drawParkingFeatureLabelsOnPdf = (pdf, project, toMm, features, prefix) => {
  pdf.setTextColor(17, 24, 39);
  const oldSize = pdf.getFontSize();
  pdf.setFontSize(9);
  features.forEach((s) => {
    const p = toMm(project(s.lng, s.lat));
    const label = `${prefix}${s.index}`;
    pdf.setFillColor(255, 255, 255);
    const textW = pdf.getTextWidth(label) + 2;
    const textH = 5;
    pdf.rect(p.x - textW / 2, p.y - textH / 2, textW, textH, 'F');
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(p.x - textW / 2, p.y - textH / 2, textW, textH);
    pdf.text(label, p.x, p.y + 1.5, { align: 'center' });
  });
  pdf.setFontSize(oldSize);
};

// Geometry helpers
const isPointInPolygon = (lng, lat, polygon) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

// Debug flag helper
const isExportDebug = () => {
  try {
    return localStorage.getItem('EXPORT_DEBUG') === 'true';
  } catch (_) {
    return false;
  }
};

const isPointInFocusedArea = (lng, lat, focusedArea) => {
  if (!focusedArea?.geometry) return false;
  const g = focusedArea.geometry;
  try {
    if (g.type === 'Polygon') {
      const ring = g.coordinates[0];
      return isPointInPolygon(lng, lat, ring);
    }
    if (g.type === 'MultiPolygon') {
      return g.coordinates.some(poly => isPointInPolygon(lng, lat, poly[0]));
    }
  } catch (_) {}
  return false;
};

// Number point features within the focused area and return sorted label list
const numberParkingFeaturesWithinArea = (features, focusedArea) => {
  if (!features || features.length === 0 || !focusedArea) return [];
  const inArea = features
    .filter(f => f?.geometry?.type === 'Point')
    .map((f) => ({
      feature: f,
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      props: f.properties || {}
    }))
    .filter(p => isPointInFocusedArea(p.lng, p.lat, focusedArea));
  inArea.sort((a, b) => {
    const as = String(a.props.on_street || '').toLowerCase();
    const bs = String(b.props.on_street || '').toLowerCase();
    if (as !== bs) return as.localeCompare(bs);
    const af = String(a.props.from_street || '').toLowerCase();
    const bf = String(b.props.from_street || '').toLowerCase();
    if (af !== bf) return af.localeCompare(bf);
    if (a.lng !== b.lng) return a.lng - b.lng;
    return a.lat - b.lat;
  });
  return inArea.map((p, idx) => ({ index: idx, lng: p.lng, lat: p.lat, props: p.props }));
};

// Render a separate PDF page with a table of parking signs
const drawParkingSignsSummaryPage = (pdf, signs) => {
  pdf.setFontSize(14);
  pdf.setTextColor(31, 41, 55);
  pdf.text('Street Parking Signs within Permit Area', 10, 15);

  const headers = ['ID', 'Order #', 'On', 'From', 'To', 'Side', 'Description'];
  const colX = [10, 26, 44, 78, 112, 146, 164];
  const colW = [14, 16, 32, 32, 32, 16, 120];
  let y = 22;
  const lineH = 5;

  pdf.setFontSize(10);
  pdf.setTextColor(55, 65, 81);
  headers.forEach((h, i) => pdf.text(h, colX[i], y));
  y += 2;
  pdf.setDrawColor(200, 200, 200);
  pdf.line(10, y, 287, y);
  y += 3;

  pdf.setTextColor(31, 41, 55);
  signs.forEach((s) => {
    const idText = `P${s.index}`;
    const order = String(s.props.order_number || '');
    const on = String(s.props.on_street || '');
    const from = String(s.props.from_street || '');
    const to = String(s.props.to_street || '');
    const side = String(s.props.side_of_street || '');
    const desc = String(s.props.sign_description || '');

    const cells = [idText, order, on, from, to, side, desc];
    const wrapped = cells.map((t, i) => wrapPdfLines(pdf, t, colW[i]));
    const rowLines = Math.max(...wrapped.map(arr => Math.max(1, arr.length)));
    const rowH = rowLines * lineH + 2;

    pdf.setDrawColor(235, 235, 235);
    pdf.rect(10, y - 2, 277, rowH, 'S');

    wrapped.forEach((arr, i) => {
      arr.forEach((line, li) => {
        pdf.text(line, colX[i], y + li * lineH);
      });
    });
    y += rowH;

    if (y > 200) {
      pdf.addPage('a4', 'landscape');
      y = 15;
    }
  });
};

// Render a separate PDF page with a table of parking meters
const drawParkingMetersSummaryPage = (pdf, meters) => {
  pdf.setFontSize(14);
  pdf.setTextColor(31, 41, 55);
  pdf.text('Parking Meters within Permit Area', 10, 15);

  // Columns: ID, On, From, To, Side, Meter #, Status, Hours, Facility
  const headers = ['ID', 'On', 'From', 'To', 'Side', 'Meter #', 'Status', 'Hours', 'Facility'];
  const colX = [10, 26, 60, 94, 128, 146, 168, 184, 206];
  const colW = [14, 30, 30, 30, 14, 16, 20, 20, 78];
  let y = 22;
  const lineH = 5;

  pdf.setFontSize(10);
  pdf.setTextColor(55, 65, 81);
  headers.forEach((h, i) => pdf.text(h, colX[i], y));
  y += 2;
  pdf.setDrawColor(200, 200, 200);
  pdf.line(10, y, 287, y);
  y += 3;

  pdf.setTextColor(31, 41, 55);
  meters.forEach((m) => {
    const idText = `M${m.index}`;
    const on = String(m.props.on_street || '');
    const from = String(m.props.from_street || '');
    const to = String(m.props.to_street || '');
    const side = String(m.props.side_of_street || '');
    const meterNo = String(m.props.meter_number || '');
    const status = String(m.props.status || '');
    const hours = String(m.props.meter_hours || '');
    const facility = String(m.props.parking_facility_name || m.props.facility || '');

    const cells = [idText, on, from, to, side, meterNo, status, hours, facility];
    const wrapped = cells.map((t, i) => wrapPdfLines(pdf, t, colW[i]));
    const rowLines = Math.max(...wrapped.map(arr => Math.max(1, arr.length)));
    const rowH = rowLines * lineH + 2;

    pdf.setDrawColor(235, 235, 235);
    pdf.rect(10, y - 2, 277, rowH, 'S');

    wrapped.forEach((arr, i) => {
      arr.forEach((line, li) => {
        pdf.text(line, colX[i], y + li * lineH);
      });
    });
    y += rowH;

    if (y > 200) {
      pdf.addPage('a4', 'landscape');
      y = 15;
    }
  });
};

// Draw visible infrastructure overlays onto PNG canvas (points with icons, lines with stroke; polygons skipped)
const drawOverlaysOnCanvas = (ctx, offscreen, mapPx, originPx, layers, customShapes, droppedObjects, infrastructureData, focusedArea, pngIcons) => {
  const project = (lng, lat) => offscreen.project([lng, lat]);
  if (isExportDebug()) {
    console.log('[ExportDebug] drawing overlays with originPx', originPx, 'mapPx', mapPx);
  }
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
          // Treat fire lanes and disaster routes as lines, not point icons
          if (id === 'fireLanes' || id === 'specialDisasterRoutes') return;
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
          // Thicker, semi-transparent for bike lanes
          if (id === 'bikeLanes') {
            ctx.lineWidth = 6;
            ctx.globalAlpha = 0.6;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
          } else {
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        } else if (g.type === 'MultiLineString') {
          g.coordinates.forEach(line => {
            const pts = line.map(([lng, lat]) => project(lng, lat));
            ctx.beginPath();
            pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x + originPx.x, p.y + originPx.y) : ctx.lineTo(p.x + originPx.x, p.y + originPx.y));
            if (id === 'bikeLanes') {
              ctx.lineWidth = 6;
              ctx.globalAlpha = 0.6;
              ctx.stroke();
              ctx.globalAlpha = 1.0;
            } else {
              ctx.lineWidth = 2;
              ctx.stroke();
            }
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
        const mapPixelX = mapArea.x + pixel.x;
        const mapPixelY = mapArea.y + pixel.y;
        
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
        let lastPx = null;
        shape.geometry.coordinates.forEach((coord, index) => {
          const pixel = map.project([coord[0], coord[1]]);
          const mapPixelX = mapArea.x + pixel.x;
          const mapPixelY = mapArea.y + pixel.y;

          if (isExportDebug()) {
            console.log('[ExportDebug] line vertex', index, { lng: coord[0], lat: coord[1] }, { x: mapPixelX, y: mapPixelY });
          }

          if (index === 0) {
            ctx.moveTo(mapPixelX, mapPixelY);
          } else {
            ctx.lineTo(mapPixelX, mapPixelY);
          }
          lastPx = { x: mapPixelX, y: mapPixelY };
        });
        ctx.stroke();
        
        // Draw label at midpoint if available
        if (shape.properties && shape.properties.label) {
          const midIndex = Math.floor(shape.geometry.coordinates.length / 2);
          const midCoord = shape.geometry.coordinates[midIndex];
          const pixel = map.project([midCoord[0], midCoord[1]]);
          const mapPixelX = mapArea.x + pixel.x;
          const mapPixelY = mapArea.y + pixel.y;
          
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
      // Draw polygon annotation (stroke only to avoid mismatched fills)
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
        
        ctx.beginPath();
        shape.geometry.coordinates[0].forEach((coord, index) => {
          const pixel = map.project([coord[0], coord[1]]);
          const mapPixelX = mapArea.x + pixel.x;
          const mapPixelY = mapArea.y + pixel.y;

          if (isExportDebug()) {
            console.log('[ExportDebug] poly vertex', index, { lng: coord[0], lat: coord[1] }, { x: mapPixelX, y: mapPixelY });
          }

          if (index === 0) {
            ctx.moveTo(mapPixelX, mapPixelY);
          } else {
            ctx.lineTo(mapPixelX, mapPixelY);
          }
        });
        ctx.closePath();
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
          const mapPixelX = mapArea.x + pixel.x;
          const mapPixelY = mapArea.y + pixel.y;
          
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
      console.error('Error drawing custom shape:', error, shape);
    }
  });
};

// Draw dropped objects on the export canvas
const drawDroppedObjectsOnCanvas = async (ctx, mapArea, map, droppedObjects) => {
  if (!droppedObjects || droppedObjects.length === 0) return;
  
  console.log('Drawing', droppedObjects.length, 'dropped objects on export canvas');
  
  for (let index = 0; index < droppedObjects.length; index += 1) {
    const obj = droppedObjects[index];
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
      
      // Draw the object icon (prefer PNG image if available)
      const objSize = Math.max(objectType.size.width, objectType.size.height, 28) * 3;
      if (objectType.imageUrl) {
        const img = await loadImage(objectType.imageUrl);
        if (obj?.properties?.flipped) {
          ctx.save();
          // Mirror around the image center
          ctx.translate(mapPixelX, mapPixelY);
          ctx.scale(-1, 1);
          ctx.drawImage(img, -objSize / 2, -objSize / 2, objSize, objSize);
          ctx.restore();
        } else {
          ctx.drawImage(img, mapPixelX - objSize / 2, mapPixelY - objSize / 2, objSize, objSize);
        }
      } else {
        // Fallback simple marker
        ctx.fillStyle = objectType.color;
        ctx.beginPath();
        ctx.arc(mapPixelX, mapPixelY, objSize / 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.font = `bold ${objSize * 0.6}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(objectType.icon, mapPixelX, mapPixelY);
      }
      
    } catch (error) {
      console.error('Error drawing dropped object:', error, obj);
    }
  }
};