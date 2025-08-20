// Draw simple dimensions for rectangular dropped objects (e.g., stages)
const drawObjectDimensionsOnPdf = (pdf, droppedObjects, project, toMm, units = 'ft') => {
  try {
    const theme = BLUEPRINT_THEME;
    setPdfFont(pdf, 'body', theme.sizesMm.small);
    pdf.setDrawColor(theme.colors.muted.r, theme.colors.muted.g, theme.colors.muted.b);
    (droppedObjects || []).forEach((obj) => {
      if (!obj?.geometry || obj.geometry.type !== 'Polygon') return;
      const ringLngLat = obj.geometry.coordinates?.[0] || [];
      if (ringLngLat.length < 4) return;
      const pts = ringLngLat.map(([lng, lat]) => toMm(project(lng, lat)));
      // Label width/height at center
      const a = pts[0], b = pts[1], c = pts[2], d = pts[3];
      const cx = (a.x + c.x) / 2; const cy = (a.y + c.y) / 2;
      // Compute physical width/height using turf distance in meters
      try {
        const wMeters = turfDistance(obj.geometry.coordinates[0][0], obj.geometry.coordinates[0][1], { units: 'meters' });
      } catch (_) {}
      let label = obj.name || 'Object';
      // Prefer user-provided dimensions in meters if present
      const dims = obj?.properties?.dimensions || obj?.properties?.user_dimensions_m || null;
      if (dims) {
        if (units === 'ft') {
          const wFt = Math.round((dims.width || 0) * 3.28084);
          const hFt = Math.round((dims.height || 0) * 3.28084);
          label = `${label} ${wFt} ft × ${hFt} ft`;
        } else {
          label = `${label} ${(dims.width || 0).toFixed(1)} m × ${(dims.height || 0).toFixed(1)} m`;
        }
      }
      drawTextWithWipe(pdf, label, cx, cy, { paddingMm: 0.8 });
    });
  } catch (_) {}
};
// utils/exportUtils.js
import { PLACEABLE_OBJECTS } from '../constants/placeableObjects';
import autoTable from 'jspdf-autotable';
import { BLUEPRINT_THEME, registerBlueprintFonts, setPdfFont, drawTextWithWipe, drawNorthArrow, drawScaleBar, ptFromMm } from './exportStyles';
import { loadInfrastructureData } from '../services/infrastructureService';
import { INFRASTRUCTURE_ENDPOINTS, EXPORT_ENDPOINTS } from '../constants/endpoints';
import { distance as turfDistance, destination as turfDestination, bearing as turfBearing, buffer as turfBuffer, booleanIntersects as turfBooleanIntersects } from '@turf/turf';
import { getIconDataUrl, INFRASTRUCTURE_ICONS } from './iconUtils';
import { switchBasemap } from './mapUtils';

// Import transit & parking helper functions
import {
  drawParkingFeatureLabelsOnPdf,
  drawParkingFeatureLabelsOnCanvas,
  numberParkingFeaturesWithinArea,
  listSubwayStationsWithinArea,
  listBusStopsWithinArea,
  numberBusStopsWithinArea,
  drawParkingAndTransitPage,
  drawParkingSignsSummaryPage,
  drawParkingMetersSummaryPage,
  listStreetParkingSignsVisibleOnMap,
  listDcwpGaragesWithinMap,
  listSubwayStationsVisibleOnMap,
  listBusStopsVisibleOnMap,
  drawBusStopFeatureLabelsOnPdf,
  drawBusStopFeatureLabelsOnCanvas,
  isFeatureVisibleOnMap,
  isPointInFocusedArea,
  isPointInPolygon
} from './transitParkingUtils';

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
  infrastructureData = null,
  exportOptions = {},
  eventInfo = null
) => {
  if (!map || !focusedArea) {
    alert('Please focus on a permit area first');
    return;
  }

  try {
    // Page setup: A4 landscape in mm
    const pageMm = { width: 297, height: 210 };
    const { noLegend = false } = exportOptions || {};
    const mapMm = noLegend ? { width: pageMm.width, height: pageMm.height } : { width: pageMm.width * 0.75, height: pageMm.height };
    const legendMm = noLegend ? { x: 0, y: 0, width: 0, height: 0 } : { x: mapMm.width, y: 0, width: pageMm.width * 0.25, height: pageMm.height };

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

    // Projection: default top-down unless explicitly set to current
    const projectionMode = exportOptions?.mapProjectionMode || 'topDown';
    if (projectionMode === 'current') {
      try {
        const curPitch = typeof map.getPitch === 'function' ? map.getPitch() : 0;
        const curBearing = typeof map.getBearing === 'function' ? map.getBearing() : 0;
        offscreen.setPitch(curPitch);
        offscreen.setBearing(curBearing);
      } catch (_) {
        offscreen.setPitch(0);
        offscreen.setBearing(0);
      }
    } else {
      // Top-down
      offscreen.setPitch(0);
      offscreen.setBearing(0);
    }

    // If a sub-focus area is present in options, prefer that geometry for bounds
    const areaForExport = (exportOptions && exportOptions.subFocusArea && exportOptions.subFocusArea.geometry) ? exportOptions.subFocusArea : focusedArea;
    const bounds = getPermitAreaBounds(areaForExport);
    if (!bounds) throw new Error('Invalid focused area geometry');

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Offscreen map style load timeout')), 8000);
      const ready = () => { clearTimeout(timeout); resolve(); };
      if (offscreen.isStyleLoaded()) ready(); else offscreen.once('style.load', ready);
    });

    // Ensure only the focused permit area is visible on the offscreen map
    try {
      const system = areaForExport?.properties?.system || focusedArea?.properties?.system || '';
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
      // Hide CARTO sidewalk dashed lines and app-added infrastructure layers from the offscreen raster
      try {
        const style = offscreen.getStyle();
        const hideIf = (layer) => {
          try {
            if (!layer || !layer.id) return false;
            // Heuristic: dashed line layers related to sidewalks/footways/paths
            const id = String(layer.id).toLowerCase();
            const srcLayer = String(layer['source-layer'] || '').toLowerCase();
            const isLine = layer.type === 'line';
            const hasDash = !!(layer.paint && (layer.paint['line-dasharray'] || layer.paint['line-dasharray-transition']));
            const looksLikeSidewalk = /sidewalk|footway|pedestrian/.test(id) || /sidewalk|footway|pedestrian/.test(srcLayer);
            return isLine && hasDash && looksLikeSidewalk;
          } catch (_) { return false; }
        };
        style.layers?.forEach((layer) => {
          if (hideIf(layer)) {
            try { offscreen.setLayoutProperty(layer.id, 'visibility', 'none'); } catch (_) {}
          }
        });
        // Also hide any app-added infrastructure layers so they are not baked into the raster
        try {
          Object.keys(layers || {}).forEach((layerId) => {
            if (layerId === 'permitAreas') return;
            const suffixes = ['point', 'line', 'polygon'];
            suffixes.forEach((suf) => {
              const id = `layer-${layerId}-${suf}`;
              try { if (offscreen.getLayer(id)) offscreen.setLayoutProperty(id, 'visibility', 'none'); } catch (_) {}
            });
          });
        } catch (_) {}
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
    // Preload per-feature enhanced variant icons (e.g., linknyc 0..315) when available
    const enhancedVariantPngs = await collectEnhancedVariantPngs(layers, infrastructureData);
    const droppedObjectPngs = await loadDroppedObjectIconPngs(droppedObjects);
    // Ensure we have infra data for meters, signs, and bus stops even if not preloaded
    let ensuredInfra = infrastructureData || {};
    try {
      if (focusedArea) {
        const bounds = getPermitAreaBounds(focusedArea);
        const needSigns = layers?.streetParkingSigns?.visible && !ensuredInfra?.streetParkingSigns?.features;
        const needMeters = layers?.parkingMeters?.visible && !ensuredInfra?.parkingMeters?.features;
        const needBusStops = layers?.busStops?.visible && !ensuredInfra?.busStops?.features;
        if (needSigns || needMeters || needBusStops) {
          const [signsData, metersData, busStopsData] = await Promise.all([
            needSigns ? loadInfrastructureData('streetParkingSigns', bounds) : Promise.resolve(null),
            needMeters ? loadInfrastructureData('parkingMeters', bounds) : Promise.resolve(null),
            needBusStops ? loadInfrastructureData('busStops', bounds) : Promise.resolve(null)
          ]);
          ensuredInfra = {
            ...ensuredInfra,
            ...(signsData ? { streetParkingSigns: signsData } : {}),
            ...(metersData ? { parkingMeters: metersData } : {}),
            ...(busStopsData ? { busStops: busStopsData } : {})
          };
        }
      }
    } catch (_) {}
    // Build parking regulations, meters, and bus stops lists for labeling and summaries
    // For regulations (nfid-uabd), ensure we have Point geometry (prefer labelGeometry if present)
    const regulationFeatures = (ensuredInfra?.streetParkingSigns?.features || [])
      .map(f => (f && f.labelGeometry && f.labelGeometry.type === 'Point')
        ? { type: 'Feature', geometry: f.labelGeometry, properties: f.properties }
        : f)
      .filter(f => f && f.geometry && f.geometry.type === 'Point');
    const meterFeatures = (ensuredInfra?.parkingMeters?.features || []).filter(f => f && f.geometry && f.geometry.type === 'Point');
    const busStopFeatures = (ensuredInfra?.busStops?.features || []).filter(f => f && f.geometry && f.geometry.type === 'Point');
    
    // Number ALL visible parking regulation signs on the exported map extent (not only those intersecting the zone)
    const regsVisible = (layers?.streetParkingSigns?.visible)
      ? listStreetParkingSignsVisibleOnMap(offscreen, mapPx, regulationFeatures)
      : [];
    // Meters: number ALL meters visible on the exported map extent
    const metersVisible = (layers?.parkingMeters?.visible)
      ? listStreetParkingSignsVisibleOnMap(offscreen, mapPx, meterFeatures)
      : [];
    // Bus stops: number ALL visible on the exported map extent
    const busStopsVisible = (layers?.busStops?.visible)
      ? listBusStopsVisibleOnMap(offscreen, mapPx, busStopFeatures)
      : [];

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

      // Draw order for clarity: shapes -> dropped objects -> infrastructure overlays -> labels
      drawCustomShapesOnCanvas(ctx, { x: 0, y: 0, width: mapPx.width, height: mapPx.height }, offscreen, customShapes);
      await drawDroppedObjectsOnCanvas(ctx, { x: 0, y: 0, width: mapPx.width, height: mapPx.height }, offscreen, droppedObjects);
      await drawOverlaysOnCanvas(ctx, offscreen, mapPx, { x: 0, y: 0 }, layers, customShapes, droppedObjects, infrastructureData, focusedArea, pngIcons, enhancedVariantPngs);
      // Labels last so they sit on top of everything
      if (regsVisible.length > 0) {
        drawParkingFeatureLabelsOnCanvas(ctx, offscreen, { x: 0, y: 0 }, regsVisible, 'P');
      }
      if (metersVisible.length > 0) {
        drawParkingFeatureLabelsOnCanvas(ctx, offscreen, { x: 0, y: 0 }, metersVisible, 'M');
      }
      if (busStopsVisible.length > 0) {
        drawBusStopFeatureLabelsOnCanvas(ctx, offscreen, { x: 0, y: 0 }, busStopsVisible, 'B');
      }

      if (!noLegend) {
        const legendPx = { x: mapPx.width, y: 0, width: canvas.width - mapPx.width, height: canvas.height };
        const numbered = numberCustomShapes(customShapes || []);
        await drawLegendOnCanvas(ctx, legendPx, layers, numbered, droppedObjects, areaForExport, pngIcons, droppedObjectPngs, eventInfo);
      }

      canvas.toBlob((blob) => {
        if (!blob) { alert('Failed to create PNG'); cleanupOffscreen(offscreen, container); return; }
        downloadBlob(blob, `siteplan-${getSafeFilename(focusedArea)}.png`);
        cleanupOffscreen(offscreen, container);
      }, 'image/png', 0.95);
      return;
    }

    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    registerBlueprintFonts(pdf);
    // Map image
    pdf.addImage(baseImageUrl, 'PNG', 0, 0, mapMm.width, mapMm.height);

    const mmFromPx = { x: mapMm.width / mapPx.width, y: mapMm.height / mapPx.height };
    const toMm = (pt) => ({ x: pt.x * mmFromPx.x, y: pt.y * mmFromPx.y });
    const project = (lng, lat) => offscreen.project([lng, lat]);

    const numberedShapes = numberCustomShapes(customShapes);

    // Skip manual orange permit overlay; rely on underlying focused permit styling in raster
    // Dimension annotations around the focused area (CAD-style)
    const {
      includeObjectDimensions = true,
      includeZoneDimensions = false,
      includeStreetSidewalkDimensions = false,
      dimensionUnits = 'ft'
    } = exportOptions || {};
    // 1) Zone boundary dimensions (off by default)
    if (includeZoneDimensions) {
      drawDimensionsOnPdf(pdf, areaForExport, project, toMm, dimensionUnits);
    }
    // 2) Street/sidewalk widths (off by default)
    if (includeStreetSidewalkDimensions) {
      try {
        const bounds = offscreen.getBounds();
        const streetData = await loadCsclCenterlines(bounds);
        const visibleStreets = filterVisibleLineFeatures(streetData, offscreen);
        // Build a 100ft buffer around the focused export geometry for label gating
        const zoneBuffer = (() => {
          try { return turfBuffer(areaForExport, 100, { units: 'feet' }); } catch (_) { return areaForExport; }
        })();
        const zoneStreets = { type: 'FeatureCollection', features: (visibleStreets.features || []).filter((f) => {
          try { return turfBooleanIntersects(zoneBuffer, f); } catch (_) { return false; }
        }) };
        drawStreetWidthLabelsOnPdf(pdf, zoneStreets, project, toMm, dimensionUnits);
        // Sidewalk polygons within the zone (+100ft buffer)
        const sidewalks = await loadSidewalks(bounds);
        const visibleSidewalks = filterVisiblePolygonFeatures(sidewalks, offscreen);
        const zoneSidewalks = { type: 'FeatureCollection', features: (visibleSidewalks.features || []).filter((f) => {
          try { return turfBooleanIntersects(zoneBuffer, f); } catch (_) { return false; }
        }) };
        drawSidewalksOnPdf(pdf, zoneSidewalks, project, toMm);
        drawSidewalkWidthLabelsOnPdf(pdf, zoneSidewalks, project, toMm, dimensionUnits);
      } catch (_) {}
    }
    // Draw order: (optional) object dimensions -> dropped objects -> shapes -> infrastructure -> labels on top
    if (includeObjectDimensions) {
      try { drawObjectDimensionsOnPdf(pdf, droppedObjects, project, toMm, dimensionUnits); } catch (_) {}
    }
    drawDroppedObjectsOnPdf(pdf, droppedObjects, project, toMm, droppedObjectPngs);
    drawDroppedObjectNotesOnPdf(pdf, droppedObjects, project, toMm);
    drawCustomShapesOnPdf(pdf, numberedShapes, project, toMm);
    drawInfrastructureOnPdf(pdf, layers, infrastructureData, project, toMm, mmFromPx, pngIcons, enhancedVariantPngs);
    // Labels last so they overlay icons/lines
    if (regsVisible.length > 0) {
      drawParkingFeatureLabelsOnPdf(pdf, project, toMm, regsVisible, 'P');
    }
    if (metersVisible.length > 0) {
      drawParkingFeatureLabelsOnPdf(pdf, project, toMm, metersVisible, 'M');
    }
    if (busStopsVisible.length > 0) {
      drawBusStopFeatureLabelsOnPdf(pdf, project, toMm, busStopsVisible, 'B');
    }

    // Main page legend: only title and annotations, with blueprint theme
    if (!noLegend) {
      drawLegendOnPdf(pdf, { x: legendMm.x, y: legendMm.y, width: legendMm.width, height: legendMm.height }, layers, numberedShapes, droppedObjects, areaForExport, pngIcons, droppedObjectPngs, eventInfo);
    }

    // Citywide context inset (skip when noLegend)
    if (!noLegend) {
      try {
        const insetMargin = 6; // mm
        const insetMaxW = Math.max(20, legendMm.width - insetMargin * 2);
        const insetSizeMm = Math.min(55, insetMaxW); // clamp to 55mm
        const insetX = legendMm.x + insetMargin;
        const insetY = pageMm.height - insetSizeMm - insetMargin;
        const insetCaptionY = insetY - 3; // small caption above
        const insetDataUrl = await renderCitywideInsetDataUrl(areaForExport, 360);
        if (insetDataUrl) {
          // Caption
          setPdfFont(pdf, 'body', BLUEPRINT_THEME.sizesMm.small);
          pdf.setTextColor(BLUEPRINT_THEME.colors.muted.r, BLUEPRINT_THEME.colors.muted.g, BLUEPRINT_THEME.colors.muted.b);
          pdf.text('Location within NYC', insetX, insetCaptionY);
          // Frame background
          pdf.setFillColor(255, 255, 255);
          pdf.rect(insetX - 1, insetY - 1, insetSizeMm + 2, insetSizeMm + 2, 'F');
          // Image
          pdf.addImage(insetDataUrl, 'PNG', insetX, insetY, insetSizeMm, insetSizeMm);
          // Border
          pdf.setDrawColor(220, 220, 220);
          pdf.rect(insetX, insetY, insetSizeMm, insetSizeMm);
        }
      } catch (_) {}
    }

    // Add summary page for Layers and Equipment only if at least one table has rows
    try {
      const hasVisibleLayers = Object.entries(layers || {}).some(([id, cfg]) => id !== 'permitAreas' && !!cfg?.visible);
      const hasEquipment = Array.isArray(droppedObjects) && droppedObjects.length > 0;
      if (hasVisibleLayers || hasEquipment) {
        drawLayersAndEquipmentSummaryPage(pdf, layers, droppedObjects, pngIcons, droppedObjectPngs);
      }
    } catch (_) {}

    // Add combined Parking & Transit summary page (page 3) only if any table has rows
    const subwayStationsVisible = (layers?.subwayEntrances?.visible)
      ? listSubwayStationsVisibleOnMap(offscreen, mapPx, ensuredInfra?.subwayEntrances?.features || [])
      : [];
    // Recompute signs visibility by screen extent (not just polygon inclusion)
    const signsVisible = regsVisible;
    const dcwpGaragesVisible = (layers?.dcwpParkingGarages?.visible)
      ? listDcwpGaragesWithinMap(offscreen, mapPx, ensuredInfra?.dcwpParkingGarages?.features || [])
      : [];
    // Get bus stops within the focused area for the summary table
    const busStopsInArea = (layers?.busStops?.visible)
      ? listBusStopsWithinArea(ensuredInfra?.busStops?.features || [], focusedArea)
      : [];
    const hasParkingTransitData =
      (Array.isArray(signsVisible) && signsVisible.length > 0) ||
      (Array.isArray(metersVisible) && metersVisible.length > 0) ||
      (Array.isArray(subwayStationsVisible) && subwayStationsVisible.length > 0) ||
      (Array.isArray(dcwpGaragesVisible) && dcwpGaragesVisible.length > 0) ||
      (Array.isArray(busStopsInArea) && busStopsInArea.length > 0);
    if (hasParkingTransitData) {
      drawParkingAndTransitPage(pdf, signsVisible, metersVisible, subwayStationsVisible, dcwpGaragesVisible, busStopsInArea);
    }

    // North arrow & scale bar inside map (bottom-left with inner margin) — ensure drawn on page 1
    try {
      if (typeof pdf.setPage === 'function') pdf.setPage(1);
      const inner = 6; // mm
      const nx = inner + 10;
      const ny = mapMm.height - inner - 14;
      drawNorthArrow(pdf, nx, ny, 12);
      // Estimate scale from meters per mm at map center
      const bbox = offscreen.getBounds();
      const centerLat = (bbox.getSouth() + bbox.getNorth()) / 2;
      const metersAcross = turfDistance([bbox.getWest(), centerLat], [bbox.getEast(), centerLat], { units: 'meters' });
      const metersPerMm = metersAcross / mapMm.width;
      drawScaleBar(pdf, inner + 26, mapMm.height - inner - 2, 45, metersPerMm);
    } catch (_) {}

    pdf.save(`siteplan-${getSafeFilename(areaForExport)}.pdf`);
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

// Render a citywide inset using a static NYC boroughs image and mark the site centroid
const renderCitywideInsetDataUrl = async (focusedArea, size = 360) => {
  try {
    if (!focusedArea || !focusedArea.geometry) return null;
    // NYC bbox tuned for boroughs image (nybb)
    const minLng = -74.258; const maxLng = -73.700;
    const minLat = 40.477; const maxLat = 40.917;

    const img = await loadImage('/static/nybb.png');
    const dpr = Math.max(2, Math.floor(window.devicePixelRatio || 1));
    const canvas = document.createElement('canvas');
    canvas.width = size * dpr; canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true; if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    // Draw base image with contain
    const scale = Math.min(size / img.width, size / img.height);
    const drawW = Math.round(img.width * scale);
    const drawH = Math.round(img.height * scale);
    const dx = Math.floor((size - drawW) / 2);
    const dy = Math.floor((size - drawH) / 2);
    ctx.drawImage(img, dx, dy, drawW, drawH);

    // Compute centroid as bbox center for robustness
    const bbox = getPermitAreaBounds(focusedArea);
    if (!bbox) return canvas.toDataURL('image/png');
    const cxLng = (bbox[0][0] + bbox[1][0]) / 2;
    const cyLat = (bbox[0][1] + bbox[1][1]) / 2;
    // Map to image pixel coordinates within the drawn region
    const nx = (cxLng - minLng) / (maxLng - minLng);
    const ny = (maxLat - cyLat) / (maxLat - minLat);
    const px = dx + nx * drawW;
    const py = dy + ny * drawH;

    // Marker: white halo + colored core
    ctx.save();
    ctx.beginPath(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.fillStyle = '#ef4444'; ctx.arc(px, py, 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    return canvas.toDataURL('image/png');
  } catch (_) {
    return null;
  }
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

// Build a human-friendly siteplan title and optional subtitle based on FSN fields
const getSiteplanTitleParts = (focusedArea) => {
  const props = focusedArea?.properties || {};
  const fsn1 = (props.FSN_1 || '').toString().trim();
  const fsn2 = (props.FSN_2 || '').toString().trim();
  const fsn3 = (props.FSN_3 || '').toString().trim();
  const fsn4 = (props.FSN_4 || '').toString().trim();
  const hasFsn1 = fsn1.length > 0;
  const hasFsn2 = fsn2.length > 0;
  const hasFsn3 = fsn3.length > 0;
  const hasFsn4 = fsn4.length > 0;
  const titleCore = hasFsn1 ? (hasFsn2 ? `${fsn1} & ${fsn2}` : fsn1) : (props.name || 'Permit Area');
  const subtitle = (hasFsn3 || hasFsn4) ? [fsn3, fsn4].filter(Boolean).join(' & ') : '';
  return { title: titleCore, subtitle };
};

const drawLegendOnCanvas = async (ctx, rectPx, layers, numberedShapes, droppedObjects, focusedArea, pngIcons, droppedObjectImages, eventInfo) => {
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
  const { title: siteTitle, subtitle: siteSubtitle } = getSiteplanTitleParts(focusedArea);
  const title = `Site Plan: ${String(siteTitle)}`;
  const titleMaxWidth = rectPx.width - 2 * margin;
  const titleLines = wrapCanvasLines(ctx, title, titleMaxWidth);
  const titleLineHeight = 22;
  titleLines.forEach((line, idx) => {
    ctx.fillText(line, leftX, cursorY + idx * titleLineHeight);
  });
  cursorY += titleLines.length * titleLineHeight;

  // Optional subtitle for plazas (FSN_3/FSN_4 present)
  if (siteSubtitle) {
    ctx.fillStyle = '#374151';
    ctx.font = 'italic 13px Arial';
    const subLines = wrapCanvasLines(ctx, siteSubtitle, titleMaxWidth);
    const subLineH = 18;
    subLines.forEach((line, idx) => ctx.fillText(line, leftX, cursorY + idx * subLineH));
    cursorY += subLines.length * subLineH;
  }

  // Event Information (if provided)
  const infoPairs = [];
  try {
    if (eventInfo && typeof eventInfo === 'object') {
      const e = eventInfo;
      if (e.name) infoPairs.push(['Event', e.name]);
      if (e.organizer) infoPairs.push(['Organizer', e.organizer]);
      if (e.contact) infoPairs.push(['Contact', e.contact]);
      if (e.date) infoPairs.push(['Date', e.date]);
      if (e.time) infoPairs.push(['Time', e.time]);
      if (e.attendance) infoPairs.push(['Attendance', String(e.attendance)]);
      if (e.permit) infoPairs.push(['Permit #', e.permit]);
      if (e.notes) infoPairs.push(['Notes', e.notes]);
    }
  } catch (_) {}
  if (infoPairs.length) {
    cursorY += 8;
    ctx.fillStyle = '#374151';
    ctx.font = '12px Arial';
    ctx.fillText('Event Information', leftX, cursorY);
    cursorY += 8;
    ctx.font = '11px Arial';
    const maxW = rectPx.width - 2 * margin;
    infoPairs.forEach(([label, val]) => {
      const text = `${label}: ${val}`;
      const lines = wrapCanvasLines(ctx, text, maxW);
      const lineH = 15;
      lines.forEach((line, li) => ctx.fillText(line, leftX, cursorY + li * lineH));
      cursorY += Math.max(lineH, lines.length * lineH);
    });
  }

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
    // Add extra vertical gap between layer rows for readability
    const gap = 6;
    cursorY += Math.max(lineH, lines.length * lineH) + gap;
  }

  // Equipment header
  cursorY += 4;
  ctx.fillStyle = '#374151';
  ctx.font = '12px Arial';
  ctx.fillText('Equipment', leftX, cursorY);
  cursorY += 10;

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
    // Extra gap between equipment rows
    const equipGap = 6;
    cursorY += Math.max(equipLineH, equipLines.length * equipLineH) + equipGap;
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

// Draw simple CAD-style dimension lines and labels for the focused polygon
// Heuristics: skip very short edges, merge nearly colinear consecutive edges to avoid over-labeling corners
const drawDimensionsOnPdf = (pdf, focusedArea, project, toMm, units = 'm') => {
  try {
    const g = focusedArea?.geometry;
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return;
    const rings = g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map(poly => poly[0]);
    const ring = rings[0];
    if (!ring || ring.length < 2) return;
    // No geometry simplification: follow original vertices so dimension lines adhere to the shape
    // Iterate edges (first ring only) and label length in meters
    const theme = BLUEPRINT_THEME;
    pdf.setDrawColor(theme.colors.muted.r, theme.colors.muted.g, theme.colors.muted.b);
    pdf.setTextColor(theme.colors.text.r, theme.colors.text.g, theme.colors.text.b);
    setPdfFont(pdf, 'body', theme.sizesMm.small);
    const arrow = (x1, y1, x2, y2, size = 1.6) => {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const a1 = angle + Math.PI - 0.5;
      const a2 = angle + Math.PI + 0.5;
      pdf.setLineWidth(theme.linesMm.dim);
      pdf.line(x1, y1, x2, y2);
      pdf.line(x1, y1, x1 + size * Math.cos(a1), y1 + size * Math.sin(a1));
      pdf.line(x1, y1, x1 + size * Math.cos(a2), y1 + size * Math.sin(a2));
    };
    // Determine ring winding to offset outward (assume outer ring counter-clockwise ➜ outward is negative normal)
    const signedArea = (coords) => {
      let a = 0;
      for (let i = 0; i < coords.length - 1; i += 1) {
        a += (coords[i][0] * coords[i+1][1]) - (coords[i+1][0] * coords[i][1]);
      }
      return a / 2;
    };
    const ccw = signedArea(ring) > 0; // geographic coords approx
    const outwardSign = ccw ? -1 : 1;
    const offsetMm = 2.8; // outward offset

    // Label throttling: avoid spamming labels on short curved segments
    const targetSpacingMeters = 22; // place labels roughly every ~22m of perimeter
    let sinceLastLabel = 0;
    for (let i = 0; i < ring.length - 1; i += 1) {
      const aLngLat = ring[i];
      const bLngLat = ring[i + 1];
      // Distance in meters
      let meters = 0;
      try { meters = turfDistance([aLngLat[0], aLngLat[1]], [bLngLat[0], bLngLat[1]], { units: 'meters' }); } catch (_) {}
      if (!isFinite(meters) || meters <= 0) continue;
      sinceLastLabel += meters;
      // Project to PDF space
      const aPx = project(aLngLat[0], aLngLat[1]);
      const bPx = project(bLngLat[0], bLngLat[1]);
      const a = toMm(aPx);
      const b = toMm(bPx);
      // Compute perpendicular offset
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * outwardSign; // normalized outward perpendicular
      const ny = (dx / len) * outwardSign;
      const oa = { x: a.x + nx * offsetMm, y: a.y + ny * offsetMm };
      const ob = { x: b.x + nx * offsetMm, y: b.y + ny * offsetMm };
      // Extension lines from vertices to dim line
      pdf.setLineWidth(theme.linesMm.leader);
      pdf.line(a.x, a.y, oa.x, oa.y);
      pdf.line(b.x, b.y, ob.x, ob.y);
      // Dimension line with small arrows
      arrow(oa.x, oa.y, ob.x, ob.y, 1.8);
      arrow(ob.x, ob.y, oa.x, oa.y, 1.8);
      // Label at spaced intervals only
      if (sinceLastLabel >= targetSpacingMeters) {
        const cx = (oa.x + ob.x) / 2;
        const cy = (oa.y + ob.y) / 2;
        let label;
        if (units === 'ft') {
          const feet = meters * 3.28084;
          label = feet >= 5280 ? `${(feet / 5280).toFixed(2)} mi` : `${feet.toFixed(0)} ft`;
        } else {
          label = meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(1)} m`;
        }
        // Wipe box and centered label
        setPdfFont(pdf, 'body', theme.sizesMm.small);
        drawTextWithWipe(pdf, label, cx, cy, { paddingMm: 0.8 });
        sinceLastLabel = 0;
      }
    }
  } catch (_) {}
};

// Fetch CSCL centerlines within bounds (Socrata inkn-q76z)
const loadCsclCenterlines = async (bounds) => {
  try {
    const endpoint = INFRASTRUCTURE_ENDPOINTS.csclCenterlines;
    const minLng = bounds.getWest();
    const minLat = bounds.getSouth();
    const maxLng = bounds.getEast();
    const maxLat = bounds.getNorth();
    const wktPoly = `POLYGON((${minLng} ${minLat}, ${minLng} ${maxLat}, ${maxLng} ${maxLat}, ${maxLng} ${minLat}, ${minLng} ${minLat}))`;
    const where = encodeURIComponent(`intersects(${endpoint.geoField}, '${wktPoly.replace(/\s+/g, ' ').trim()}')`);
    const select = encodeURIComponent(['the_geom','stname_label','street_name','pre_type','post_type','pre_directional','post_directional','streetwidth','segmentlength','streetwidth_irr','number_total_lanes','number_travel_lanes','posted_speed'].join(','));
    const url = `${endpoint.baseUrl}?$where=${where}&$select=${select}&$limit=5000`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const gj = await resp.json();
    return Array.isArray(gj?.features) ? gj : { type: 'FeatureCollection', features: [] };
  } catch (_) {
    return { type: 'FeatureCollection', features: [] };
  }
};

// Filter line features that are visible on the current map view (rough check)
const filterVisibleLineFeatures = (geojson, offscreenMap) => {
  const bounds = offscreenMap.getBounds();
  const within = (lng, lat) => lng >= bounds.getWest() && lng <= bounds.getEast() && lat >= bounds.getSouth() && lat <= bounds.getNorth();
  const out = { type: 'FeatureCollection', features: [] };
  (geojson?.features || []).forEach((f) => {
    const g = f.geometry;
    if (!g || (g.type !== 'LineString' && g.type !== 'MultiLineString')) return;
    const coords = (g.type === 'LineString') ? [g.coordinates] : g.coordinates;
    const hit = coords.some(line => line.some(([lng, lat]) => within(lng, lat)));
    if (hit) out.features.push(f);
  });
  return out;
};

// Draw street width labels along visible centerlines
const drawStreetWidthLabelsOnPdf = (pdf, csclGeojson, project, toMm, units = 'm') => {
  try {
    const features = csclGeojson?.features || [];
    if (!features.length) return;
    const theme = BLUEPRINT_THEME;
    pdf.setTextColor(theme.colors.accent.r, theme.colors.accent.g, theme.colors.accent.b);
    pdf.setDrawColor(theme.colors.accent.r, theme.colors.accent.g, theme.colors.accent.b);
    setPdfFont(pdf, 'body', theme.sizesMm.small);
    const labelFor = (props) => {
      const width = Number(props.streetwidth_irr || props.streetwidth || props.segmentwidth || props.streetwidth_irregular);
      if (!isFinite(width) || width <= 0) return null;
      // CSCL width is in feet (dataset docs). Convert if needed
      if (units === 'm') return `${(width * 0.3048).toFixed(1)} m`;
      return `${Math.round(width)} ft`;
    };
    const widthFeet = (props) => {
      const width = Number(props.streetwidth_irr || props.streetwidth || props.segmentwidth || props.streetwidth_irregular);
      return isFinite(width) && width > 0 ? width : null;
    };
    const drawArrow = (x1, y1, x2, y2, size = 1.4) => {
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const a1 = ang + Math.PI - 0.5;
      const a2 = ang + Math.PI + 0.5;
      pdf.line(x1, y1, x2, y2);
      pdf.line(x2, y2, x2 + size * Math.cos(a1), y2 + size * Math.sin(a1));
      pdf.line(x2, y2, x2 + size * Math.cos(a2), y2 + size * Math.sin(a2));
    };
    features.forEach((feat) => {
      const g = feat.geometry;
      const props = feat.properties || {};
      const label = labelFor(props);
      if (!label) return;
      const widthFt = widthFeet(props);
      if (!widthFt) return;
      const lines = (g.type === 'LineString') ? [g.coordinates] : g.coordinates;
      lines.forEach((line) => {
        if (!Array.isArray(line) || line.length < 2) return;
        // Use the midpoint of the longest segment to place label
        let bestIdx = -1, bestLen = 0;
        for (let i = 0; i < line.length - 1; i += 1) {
          const a = line[i], b = line[i + 1];
          const ax = toMm(project(a[0], a[1])).x; const ay = toMm(project(a[0], a[1])).y;
          const bx = toMm(project(b[0], b[1])).x; const by = toMm(project(b[0], b[1])).y;
          const len = Math.hypot(bx - ax, by - ay);
          if (len > bestLen) { bestLen = len; bestIdx = i; }
        }
        if (bestIdx >= 0) {
          const a = line[bestIdx], b = line[bestIdx + 1];
          const A = toMm(project(a[0], a[1]));
          const B = toMm(project(b[0], b[1]));
          const cx = (A.x + B.x) / 2;
          const cy = (A.y + B.y) / 2;
          // Build perpendicular dimension line across the roadway centered at (cx, cy)
          try {
            const midLng = (a[0] + b[0]) / 2;
            const midLat = (a[1] + b[1]) / 2;
            const bearingDeg = turfBearing([a[0], a[1]], [b[0], b[1]]);
            const perpDeg = bearingDeg + 90; // degrees
            const halfWidthMeters = (widthFt * 0.3048) / 2;
            const left = turfDestination([midLng, midLat], halfWidthMeters, perpDeg, { units: 'meters' });
            const right = turfDestination([midLng, midLat], halfWidthMeters, perpDeg - 180, { units: 'meters' });
            const L = toMm(project(left.geometry.coordinates[0], left.geometry.coordinates[1]));
            const R = toMm(project(right.geometry.coordinates[0], right.geometry.coordinates[1]));
            // Draw a straight line across with arrowheads on both ends; leave a gap under the text
            pdf.setLineWidth(0.2);
            const gap = Math.max(4, pdf.getTextWidth(label) + 2); // mm
            const vx = R.x - L.x;
            const vy = R.y - L.y;
            const vlen = Math.hypot(vx, vy) || 1;
            const ux = vx / vlen;
            const uy = vy / vlen;
            const halfGap = gap / 2;
            const leftEndX = cx - ux * halfGap;
            const leftEndY = cy - uy * halfGap;
            const rightEndX = cx + ux * halfGap;
            const rightEndY = cy + uy * halfGap;
            // Left half with arrow pointing inward
            drawArrow(L.x, L.y, leftEndX, leftEndY, 1.3);
            // Right half with arrow pointing inward
            drawArrow(R.x, R.y, rightEndX, rightEndY, 1.3);
          } catch (_) {}
          // White-out and label with wipe
          drawTextWithWipe(pdf, label, cx, cy, { paddingMm: 0.8 });
        }
      });
    });
  } catch (_) {}
};

// Load sidewalks within bounds
const loadSidewalks = async (bounds) => {
  try {
    const endpoint = EXPORT_ENDPOINTS.sidewalks;
    const minLng = bounds.getWest();
    const minLat = bounds.getSouth();
    const maxLng = bounds.getEast();
    const maxLat = bounds.getNorth();
    const wktPoly = `POLYGON((${minLng} ${minLat}, ${minLng} ${maxLat}, ${maxLng} ${maxLat}, ${maxLng} ${minLat}, ${minLng} ${minLat}))`;
    const where = encodeURIComponent(`intersects(${endpoint.geoField}, '${wktPoly.replace(/\s+/g, ' ').trim()}')`);
    const select = encodeURIComponent(['the_geom','shape_area','shape_leng','feat_code','status','sub_code'].join(','));
    const url = `${endpoint.baseUrl}?$where=${where}&$select=${select}&$limit=5000`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const gj = await resp.json();
    return Array.isArray(gj?.features) ? gj : { type: 'FeatureCollection', features: [] };
  } catch (_) {
    return { type: 'FeatureCollection', features: [] };
  }
};

// Rough filter for polygons touching current view
const filterVisiblePolygonFeatures = (geojson, offscreenMap) => {
  const b = offscreenMap.getBounds();
  const within = (lng, lat) => lng >= b.getWest() && lng <= b.getEast() && lat >= b.getSouth() && lat <= b.getNorth();
  const out = { type: 'FeatureCollection', features: [] };
  (geojson?.features || []).forEach((f) => {
    const g = f.geometry;
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const hit = polys.some(rings => (rings[0] || []).some(([lng, lat]) => within(lng, lat)));
    if (hit) out.features.push(f);
  });
  return out;
};

// Draw sidewalks as light gray hatching
const drawSidewalksOnPdf = (pdf, sidewalksGeojson, project, toMm) => {
  try {
    const features = sidewalksGeojson?.features || [];
    if (!features.length) return;
    pdf.setDrawColor(156, 163, 175); // gray-400
    pdf.setFillColor(229, 231, 235); // gray-200
    features.forEach((feat) => {
      const g = feat.geometry;
      const drawPoly = (coords) => {
        const pts = coords[0].map(([lng, lat]) => toMm(project(lng, lat)));
        if (pts.length < 3) return;
        const segs = toRelativeSegments(pts);
        // Fill and outline
        pdf.saveGraphicsState && pdf.saveGraphicsState();
        const gs = new pdf.GState({ opacity: 0.2 });
        if (pdf.setGState) pdf.setGState(gs);
        pdf.lines(segs, pts[0].x, pts[0].y, [1, 1], 'F', true);
        pdf.restoreGraphicsState && pdf.restoreGraphicsState();
        pdf.setLineWidth(0.2);
        pdf.lines(segs, pts[0].x, pts[0].y, [1, 1], 'S', true);
      };
      if (g.type === 'Polygon') drawPoly(g.coordinates);
      else if (g.type === 'MultiPolygon') g.coordinates.forEach(poly => drawPoly(poly));
    });
  } catch (_) {}
};

// Dimension sidewalk widths by sampling shortest width via skeleton approximation (per-edge midpoint normals)
const drawSidewalkWidthLabelsOnPdf = (pdf, sidewalksGeojson, project, toMm, units = 'm') => {
  try {
    const features = sidewalksGeojson?.features || [];
    if (!features.length) return;
    const theme = BLUEPRINT_THEME;
    pdf.setTextColor(theme.colors.muted.r, theme.colors.muted.g, theme.colors.muted.b);
    pdf.setDrawColor(theme.colors.muted.r, theme.colors.muted.g, theme.colors.muted.b);
    setPdfFont(pdf, 'body', theme.sizesMm.small);
    const toMetersStr = (m) => units === 'ft' ? `${Math.round(m * 3.28084)} ft` : `${m.toFixed(1)} m`;
    features.forEach((feat) => {
      const g = feat.geometry;
      const rings = g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map(poly => poly[0]);
      const ring = rings[0];
      if (!ring || ring.length < 3) return;
      // Sample every N vertices to avoid clutter
      const step = Math.max(1, Math.floor(ring.length / 12));
      for (let i = 0; i < ring.length - 1; i += step) {
        const a = ring[i];
        const b = ring[i + 1];
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        // Build an inward/outward perpendicular probe ~6 meters each side; take total as width
        let meters = 0;
        try {
          const bearingDeg = turfBearing([a[0], a[1]], [b[0], b[1]]);
          const perpDeg = bearingDeg + 90;
          const left = turfDestination([mid[0], mid[1]], 3, perpDeg, { units: 'meters' });
          const right = turfDestination([mid[0], mid[1]], 3, perpDeg - 180, { units: 'meters' });
          meters = 6; // approximate width; could refine by intersection tests
          const L = toMm(project(left.geometry.coordinates[0], left.geometry.coordinates[1]));
          const R = toMm(project(right.geometry.coordinates[0], right.geometry.coordinates[1]));
          const cx = (L.x + R.x) / 2;
          const cy = (L.y + R.y) / 2;
          // Dimension line with gap under text
          const label = toMetersStr(meters);
          const gap = Math.max(4, pdf.getTextWidth(label) + 2);
          const vx = R.x - L.x, vy = R.y - L.y, vlen = Math.hypot(vx, vy) || 1;
          const ux = vx / vlen, uy = vy / vlen, halfGap = gap / 2;
          const leftEndX = cx - ux * halfGap, leftEndY = cy - uy * halfGap;
          const rightEndX = cx + ux * halfGap, rightEndY = cy + uy * halfGap;
          pdf.setLineWidth(theme.linesMm.leader);
          // open-ended ticks (no arrows) to distinguish from street widths
          pdf.line(L.x, L.y, leftEndX, leftEndY);
          pdf.line(R.x, R.y, rightEndX, rightEndY);
          // Label
          drawTextWithWipe(pdf, label, cx, cy, { paddingMm: 0.8 });
        } catch (_) {}
      }
    });
  } catch (_) {}
};

const drawInfrastructureOnPdf = (pdf, layers, infrastructureData, project, toMm, mmFromPx, pngIcons, enhancedVariantPngs) => {
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
        // Prefer per-feature enhanced icon if present
        const iconSrc = (feat.properties && feat.properties.icon_image && enhancedVariantPngs?.[feat.properties.icon_image])
          ? enhancedVariantPngs[feat.properties.icon_image]
          : pngIcons?.[layerId];
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
        pdf.lines(toRelativeSegments(coords), coords[0].x, coords[0].y, [1, 1], 'S', false);
      } else if (g.type === 'MultiLineString') {
        g.coordinates.forEach(line => {
          const coords = line.map(([lng, lat]) => toMm(project(lng, lat)));
          if (coords.length < 2) return;
          const isBike = layerId === 'bikeLanes';
          const lw = isBike ? 1.2 : 0.6;
          pdf.setLineWidth(lw);
          pdf.lines(toRelativeSegments(coords), coords[0].x, coords[0].y, [1, 1], 'S', false);
        });
      } else if (g.type === 'Polygon') {
        let ring = g.coordinates[0].map(([lng, lat]) => toMm(project(lng, lat)));
        ring = normalizeRingPoints(ring);
        if (ring.length < 3) return;
        const segs = toRelativeSegments(ring);
        // Fill at full opacity
        pdf.setFillColor(color.r, color.g, color.b);
        pdf.lines(segs, ring[0].x, ring[0].y, [1, 1], 'F', true);
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
          // Fill at full opacity
          pdf.setFillColor(color.r, color.g, color.b);
          pdf.lines(segs, ring[0].x, ring[0].y, [1, 1], 'F', true);
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
    const objType = PLACEABLE_OBJECTS.find(p => p.id === obj.type);
    // Rectangle polygons: draw stroke + hatch; then return
    if (objType?.geometryType === 'rect' && obj?.geometry?.type === 'Polygon') {
      try {
        const ringLngLat = obj.geometry.coordinates?.[0] || [];
        const pts = ringLngLat.map(([lng, lat]) => toMm(project(lng, lat)));
        if (pts.length >= 4) {
          // Outline only for stability
          pdf.setDrawColor(17, 24, 39);
          pdf.setLineWidth(0.5);
          // lines expects relative segments
          const segments = (function toRelativeSegments(points){ const segs=[]; for(let i=1;i<points.length;i++){segs.push([points[i].x-points[i-1].x, points[i].y-points[i-1].y]);} return segs; })(pts);
          pdf.lines(segments, pts[0].x, pts[0].y, [1, 1], 'S', true);
          // Simple hatch: short diagonals along edges
          try {
            pdf.setDrawColor(156, 163, 175);
            for (let i = 0; i < pts.length - 1; i += 1) {
              const a = pts[i], b = pts[i + 1];
              const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
              const dx = b.x - a.x; const dy = b.y - a.y; const len = Math.hypot(dx, dy) || 1;
              const nx = -dy / len; const ny = dx / len; const s = 1.5;
              pdf.line(mx - nx * s, my - ny * s, mx + nx * s, my + ny * s);
            }
          } catch (_) {}
          // Label
          try {
            const a = pts[0], c = pts[2];
            const cx = (a.x + c.x) / 2; const cy = (a.y + c.y) / 2;
            const dims = obj?.properties?.dimensions || obj?.properties?.user_dimensions_m;
            let label = objType.name;
            if (dims) {
              if (objType.units === 'ft') {
                const wFt = Math.round((dims.width || 0) * 3.28084);
                const hFt = Math.round((dims.height || 0) * 3.28084);
                label = `${objType.name} ${wFt} ft × ${hFt} ft`;
              } else {
                label = `${objType.name} ${(dims.width || 0).toFixed(1)} m × ${(dims.height || 0).toFixed(1)} m`;
              }
            }
            const pad = 1;
            const w = pdf.getTextWidth(label) + pad * 2;
            pdf.setFillColor(255, 255, 255);
            pdf.rect(cx - w / 2, cy - 2.6, w, 5.2, 'F');
            pdf.setTextColor(17, 24, 39);
            pdf.text(label, cx, cy, { align: 'center', baseline: 'middle' });
          } catch (_) {}
        }
      } catch (_) {}
      return;
    }
    const p = toMm(project(obj.position.lng, obj.position.lat));
    const isEnhanced = !!objType?.enhancedRendering?.enabled;
    const angleStr = String((((obj?.properties?.rotationDeg ?? 0) % 360) + 360) % 360).padStart(3, '0');
    const key = isEnhanced ? `${obj.type}::${angleStr}` : `${obj.type}`;
    const imgPng = droppedObjectPngs?.[key];
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
    const kind = (shape.properties && shape.properties.type) || '';
    if (g.type === 'Point') {
      const p = toMm(project(g.coordinates[0], g.coordinates[1]));
      if (kind === 'text') {
        // Render text label directly at the point (with halo)
        const label = String(shape.properties?.label || '').trim();
        if (label) {
          const x = p.x, y = p.y;
          // White wipe box behind text for contrast
          const pad = 0.8;
          const w = pdf.getTextWidth(label) + pad * 2;
          pdf.setFillColor(255, 255, 255);
          pdf.rect(x - w / 2, y - 2.6, w, 5.2, 'F');
          pdf.setTextColor(17, 24, 39);
          pdf.text(label, x, y, { align: 'center', baseline: 'middle' });
        }
      } else {
        // Default point marker + numbered badge
        pdf.circle(p.x, p.y, 1.2, 'S');
        labelPoint = p;
      }
    } else if (g.type === 'LineString') {
      const coords = g.coordinates.map(([lng, lat]) => toMm(project(lng, lat)));
      if (coords.length < 2) return;
      if (isExportDebug()) {
        coords.forEach((p, i) => console.log('[ExportDebug][PDF] line vertex', i, p));
      }
      pdf.setLineWidth(0.5);
      pdf.lines(toRelativeSegments(coords), coords[0].x, coords[0].y, [1, 1], 'S', false);
      // Arrowhead if this is an arrow
      if (kind === 'arrow') {
        const a = coords[coords.length - 2];
        const b = coords[coords.length - 1];
        const dx = b.x - a.x; const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len; const uy = dy / len;
        const size = 3; // mm
        // Triangle points at end
        const tip = b;
        const left = { x: b.x - ux * size - uy * (size * 0.6), y: b.y - uy * size + ux * (size * 0.6) };
        const right = { x: b.x - ux * size + uy * (size * 0.6), y: b.y - uy * size - ux * (size * 0.6) };
        pdf.setFillColor(17, 24, 39);
        pdf.lines([[left.x - tip.x, left.y - tip.y], [right.x - left.x, right.y - left.y], [tip.x - right.x, tip.y - right.y]], tip.x, tip.y, [1,1], 'F', true);
      }
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

// Render dropped object notes next to their numbered markers on PDF
const drawDroppedObjectNotesOnPdf = (pdf, droppedObjects, project, toMm) => {
  if (!droppedObjects || droppedObjects.length === 0) return;
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(9);
  droppedObjects.forEach((obj, idx) => {
    const note = obj?.properties?.note;
    if (!note) return;
    try {
      const p = toMm(project(obj.position.lng, obj.position.lat));
      const badgeOffsetX = 5;
      const badgeOffsetY = -5;
      const text = `${idx + 1}. ${note}`;
      // White background box
      const w = pdf.getTextWidth(text) + 2;
      const h = 5;
      pdf.setFillColor(255, 255, 255);
      pdf.rect(p.x + badgeOffsetX, p.y + badgeOffsetY - h + 1, w, h, 'F');
      pdf.setDrawColor(220, 220, 220);
      pdf.rect(p.x + badgeOffsetX, p.y + badgeOffsetY - h + 1, w, h);
      pdf.text(text, p.x + badgeOffsetX + 1, p.y + badgeOffsetY);
    } catch (_) {}
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
export const wrapPdfLines = (pdf, text, maxWidthMm, fontSize = 10) => {
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

const drawLegendOnPdf = (pdf, rect, layers, numberedShapes, droppedObjects, focusedArea, pngIcons, droppedObjectPngs, eventInfo) => {
  const theme = BLUEPRINT_THEME;
  // Solid white background
  pdf.setFillColor(255, 255, 255);
  pdf.rect(rect.x, rect.y, rect.width, rect.height, 'F');

  const margin = theme.spacingMm.inner;
  let cursorY = rect.y + margin;
  const leftX = rect.x + margin;
  const maxW = rect.width - 2 * margin;

  // Title
  const { title: siteTitle, subtitle: siteSubtitle } = getSiteplanTitleParts(focusedArea);
  const title = `SITE PLAN: ${String(siteTitle).toUpperCase()}`;
  setPdfFont(pdf, 'heading', theme.sizesMm.h2);
  pdf.setTextColor(theme.colors.text.r, theme.colors.text.g, theme.colors.text.b);
  wrapPdfLines(pdf, title, maxW, ptFromMm(theme.sizesMm.h2)).forEach((line) => {
    pdf.text(line, leftX, cursorY);
    cursorY += theme.sizesMm.h2 * 0.9;
  });
  if (siteSubtitle) {
    setPdfFont(pdf, 'body', theme.sizesMm.body);
    pdf.setTextColor(theme.colors.muted.r, theme.colors.muted.g, theme.colors.muted.b);
    wrapPdfLines(pdf, siteSubtitle, maxW, ptFromMm(theme.sizesMm.body)).forEach((line) => {
      pdf.text(line, leftX, cursorY);
      cursorY += theme.sizesMm.body * 0.9;
    });
  }

  // Event Information
  const infoPairs = [];
  try {
    if (eventInfo && typeof eventInfo === 'object') {
      const e = eventInfo;
      if (e.name) infoPairs.push(['Event', e.name]);
      if (e.organizer) infoPairs.push(['Organizer', e.organizer]);
      if (e.contact) infoPairs.push(['Contact', e.contact]);
      if (e.date) infoPairs.push(['Date', e.date]);
      if (e.time) infoPairs.push(['Time', e.time]);
      if (e.attendance) infoPairs.push(['Attendance', String(e.attendance)]);
      if (e.permit) infoPairs.push(['Permit #', e.permit]);
      if (e.notes) infoPairs.push(['Notes', e.notes]);
    }
  } catch (_) {}
  if (infoPairs.length) {
    cursorY += theme.spacingMm.blockGap;
    setPdfFont(pdf, 'heading', theme.sizesMm.h3);
    pdf.setTextColor(theme.colors.muted.r, theme.colors.muted.g, theme.colors.muted.b);
    pdf.text('EVENT INFORMATION', leftX, cursorY);
    cursorY += theme.sizesMm.h3 + 1;
    setPdfFont(pdf, 'body', theme.sizesMm.body);
    pdf.setTextColor(theme.colors.text.r, theme.colors.text.g, theme.colors.text.b);
    infoPairs.forEach(([label, val]) => {
      const text = `${label}: ${val}`;
      wrapPdfLines(pdf, text, maxW).forEach((line) => {
        pdf.text(line, leftX, cursorY);
        cursorY += theme.sizesMm.body + 1;
      });
    });
  }

  // Annotations
  cursorY += theme.spacingMm.blockGap;
  setPdfFont(pdf, 'heading', theme.sizesMm.h3);
  pdf.setTextColor(theme.colors.muted.r, theme.colors.muted.g, theme.colors.muted.b);
  pdf.text('ANNOTATIONS', leftX, cursorY);
  cursorY += theme.sizesMm.h3 + 1;
  setPdfFont(pdf, 'body', theme.sizesMm.body);
  pdf.setTextColor(theme.colors.text.r, theme.colors.text.g, theme.colors.text.b);
  (numberedShapes || []).forEach((shape) => {
    const num = shape.properties?.__number;
    const label = shape.properties?.label || shape.geometry?.type || 'Shape';
    const text = `${num}. ${label}`;
    wrapPdfLines(pdf, text, maxW).forEach((line) => {
      pdf.text(line, leftX, cursorY);
      cursorY += theme.sizesMm.body + 1;
    });
  });
};

// Add a dedicated page with side-by-side summaries: left = layers, right = equipment
const drawLayersAndEquipmentSummaryPage = (pdf, layers, droppedObjects, pngIcons, droppedObjectPngs) => {
  const theme = BLUEPRINT_THEME;
  pdf.addPage('a4', 'landscape');
  const page = { w: 297, h: 210 };
  const margin = theme.spacingMm.pageMargin;
  const headerY = margin;

  // Page title
  setPdfFont(pdf, 'heading', theme.sizesMm.h2);
  pdf.setTextColor(theme.colors.text.r, theme.colors.text.g, theme.colors.text.b);
  pdf.text('LAYERS AND EQUIPMENT SUMMARY', margin, headerY);

  // Prepare data arrays
  const layersRows = Object.entries(layers)
    .filter(([id, cfg]) => id !== 'permitAreas' && cfg.visible)
    .map(([id, cfg]) => ({ icon: id, name: String(cfg.name || id) }));
  const equipmentCounts = (droppedObjects || []).reduce((acc, o) => { acc[o.type] = (acc[o.type] || 0) + 1; return acc; }, {});
  const equipmentRows = Object.entries(equipmentCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([type, count]) => ({ icon: type, name: String(PLACEABLE_OBJECTS.find(p => p.id === type)?.name || type), count }));

  // Table theming
  const bodyFontPt = ptFromMm(theme.sizesMm.body);
  const headFontPt = ptFromMm(theme.sizesMm.h3);
  const cellPad = theme.spacingMm.pad; // mm
  const rowIconCellW = 18; // mm
  const countCellW = 18; // mm
  const startY = headerY + theme.sizesMm.h2 + theme.spacingMm.blockGap;

  try {
    if (typeof autoTable === 'function') {
      const leftWidth = (page.w / 2) - margin * 1.5;
      const rightX = (page.w / 2) + margin * 0.5;

      autoTable(pdf, {
        startY,
        margin: { left: margin, right: page.w - (margin + leftWidth) },
        head: [['Icon', 'Layer Name']],
        body: layersRows.map(r => ['', r.name]),
        theme: 'grid',
        styles: { fontSize: bodyFontPt, fontStyle: 'normal', textColor: [31,41,55], cellPadding: cellPad, valign: 'middle', lineWidth: theme.linesMm.tertiary, lineColor: [220,220,220] },
        headStyles: { fontSize: headFontPt, fontStyle: 'bold', fillColor: [240, 244, 248], textColor: [31,41,55], halign: 'left' },
        columnStyles: {
          0: { cellWidth: rowIconCellW, halign: 'left', fontSize: bodyFontPt, fontStyle: 'normal', textColor: [31,41,55] },
          1: { cellWidth: 'auto', fontSize: bodyFontPt, fontStyle: 'normal', textColor: [31,41,55] }
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 0) {
            const id = layersRows[data.row.index]?.icon;
            const cellX = data.cell.x;
            const cellY = data.cell.y;
            const cellH = data.cell.height;
            const padding = 1;
            const maxSize = Math.max(6, cellH - padding * 2);
            const drawW = maxSize;
            const drawH = maxSize;
            const drawX = cellX + padding;
            const drawY = cellY + (cellH - drawH) / 2;
            try {
              const png = pngIcons?.[id];
              if (png) {
                pdf.addImage(png, 'PNG', drawX, drawY, drawW, drawH);
              } else {
                const c = hexToRgb(layers[id]?.color || '#333');
                pdf.setFillColor(c.r, c.g, c.b);
                pdf.rect(drawX, drawY, drawW, drawH, 'F');
              }
            } catch (_) {}
          }
        }
      });

      autoTable(pdf, {
        startY,
        margin: { left: rightX, right: margin },
        head: [['Icon', 'Equipment', 'Count']],
        body: equipmentRows.map(r => ['', r.name, String(r.count)]),
        theme: 'grid',
        styles: { fontSize: bodyFontPt, fontStyle: 'normal', textColor: [31,41,55], cellPadding: cellPad, valign: 'middle', lineWidth: theme.linesMm.tertiary, lineColor: [220,220,220] },
        headStyles: { fontSize: headFontPt, fontStyle: 'bold', fillColor: [240, 244, 248], textColor: [31,41,55], halign: 'left' },
        columnStyles: {
          0: { cellWidth: rowIconCellW, halign: 'left', fontSize: bodyFontPt, fontStyle: 'normal', textColor: [31,41,55] },
          1: { cellWidth: 'auto', fontSize: bodyFontPt, fontStyle: 'normal', textColor: [31,41,55] },
          2: { cellWidth: countCellW, halign: 'right', fontSize: bodyFontPt, fontStyle: 'normal', textColor: [31,41,55] }
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 0) {
            const type = equipmentRows[data.row.index]?.icon;
            const cellX = data.cell.x;
            const cellY = data.cell.y;
            const cellH = data.cell.height;
            const padding = 1;
            const maxSize = Math.max(6, cellH - padding * 2);
            const drawW = maxSize;
            const drawH = maxSize;
            const drawX = cellX + padding;
            const drawY = cellY + (cellH - drawH) / 2;
            try {
              const iconPng = droppedObjectPngs?.[type];
              if (iconPng) {
                pdf.addImage(iconPng, 'PNG', drawX, drawY, drawW, drawH);
              } else {
                pdf.setFillColor(100, 100, 100);
                pdf.rect(drawX, drawY, drawW, drawH, 'F');
              }
            } catch (_) {}
          }
        }
      });
    }
  } catch (_) {}
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
  // Build unique keys for base or per-angle variants
  const uniqueKeys = new Set();
  for (const obj of droppedObjects) {
    const objType = PLACEABLE_OBJECTS.find(p => p.id === obj.type);
    if (!objType) continue;
    const isEnhanced = !!objType?.enhancedRendering?.enabled;
    if (isEnhanced) {
      const base = objType.enhancedRendering.spriteBase;
      const dir = objType.enhancedRendering.publicDir || '/data/icons/isometric-bw';
      const ang = typeof obj?.properties?.rotationDeg === 'number' ? obj.properties.rotationDeg : 0;
      const angleStr = String(((ang % 360) + 360) % 360).padStart(3, '0');
      const key = `${obj.type}::${angleStr}`;
      if (!uniqueKeys.has(key)) {
        uniqueKeys.add(key);
        try {
          map[key] = await rasterizeToPngDataUrl(`${dir}/${base}_${angleStr}.png`, 192);
        } catch (_) {
          // fallback to 000 variant
          try { map[key] = await rasterizeToPngDataUrl(`${dir}/${base}_000.png`, 192); } catch {}
        }
      }
    } else if (objType?.imageUrl) {
      const key = `${obj.type}`;
      if (!uniqueKeys.has(key)) {
        uniqueKeys.add(key);
        try { map[key] = await rasterizeToPngDataUrl(objType.imageUrl, 192); } catch {}
      }
    }
  }
  return map;
};

// Collect enhanced-variant PNGs referenced by visible layers' features.
// Returns a map { imageId: dataUrl } where imageId matches feature.properties.icon_image
const collectEnhancedVariantPngs = async (layers, infrastructureData) => {
  const map = {};
  try {
    for (const [layerId, cfg] of Object.entries(layers)) {
      if (layerId === 'permitAreas' || !cfg?.visible) continue;
      if (!cfg?.enhancedRendering?.enabled) continue;
      const data = infrastructureData?.[layerId];
      if (!data?.features) continue;
      // Collect unique imageIds referenced by features
      const ids = new Set();
      data.features.forEach((f) => {
        const id = f?.properties?.icon_image;
        if (typeof id === 'string' && id) ids.add(id);
      });
      // Resolve each to a public URL then rasterize to PNG data URL
      const dir = cfg.enhancedRendering.publicDir || '/data/icons/isometric-bw';
      await Promise.all(Array.from(ids).map(async (imageId) => {
        if (map[imageId]) return; // skip cached
        // imageId is of form `${spriteBase}_NNN`
        const suffix = imageId.split('_').pop();
        const base = cfg.enhancedRendering.spriteBase;
        const src = `${dir}/${base}_${suffix}.png`;
        try {
          map[imageId] = await rasterizeToPngDataUrl(src, 96);
        } catch (_) {}
      }));
    }
  } catch (_) {}
  return map;
};







// Debug flag helper
const isExportDebug = () => {
  try {
    return localStorage.getItem('EXPORT_DEBUG') === 'true';
  } catch (_) {
    return false;
  }
};













// Draw visible infrastructure overlays onto PNG canvas (points with icons, lines with stroke; polygons skipped)
const drawOverlaysOnCanvas = async (ctx, offscreen, mapPx, originPx, layers, customShapes, droppedObjects, infrastructureData, focusedArea, pngIcons, enhancedVariantPngs) => {
  const project = (lng, lat) => offscreen.project([lng, lat]);
  if (isExportDebug()) {
    console.log('[ExportDebug] drawing overlays with originPx', originPx, 'mapPx', mapPx);
  }
  await Promise.all(Object.entries(layers)
    .filter(([id, cfg]) => id !== 'permitAreas' && cfg.visible)
    .map(async ([id, cfg]) => {
      const data = infrastructureData?.[id];
      if (!data?.features) return;
      const color = cfg.color || '#333333';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      for (const feat of data.features) {
        const g = feat.geometry;
        if (!g) return;
        if (g.type === 'Point') {
          // Treat fire lanes and disaster routes as lines, not point icons
          if (id === 'fireLanes' || id === 'specialDisasterRoutes') return;
          const p = project(g.coordinates[0], g.coordinates[1]);
          const perFeatureId = feat.properties?.icon_image;
          const iconSrc = perFeatureId && enhancedVariantPngs?.[perFeatureId] ? enhancedVariantPngs[perFeatureId] : pngIcons?.[id];
          if (iconSrc) {
            try {
              const img = await loadImage(iconSrc);
              ctx.drawImage(img, p.x + originPx.x - 6, p.y + originPx.y - 6, 12, 12);
            } catch (_) {
              ctx.beginPath();
              ctx.arc(p.x + originPx.x, p.y + originPx.y, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            ctx.beginPath();
            ctx.arc(p.x + originPx.x, p.y + originPx.y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (g.type === 'LineString') {
          const pts = g.coordinates.map(([lng, lat]) => project(lng, lat));
          ctx.beginPath();
          pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x + originPx.x, p.y + originPx.y) : ctx.lineTo(p.x + originPx.x, p.y + originPx.y));
          // Thicker for bike lanes
          if (id === 'bikeLanes') {
            ctx.lineWidth = 6;
            ctx.stroke();
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
              ctx.stroke();
            } else {
              ctx.lineWidth = 2;
              ctx.stroke();
            }
          });
        }
        // Intentionally skip Polygon/MultiPolygon to avoid misalignment and unwanted fills
      }
    }));
};

// Draw custom shapes (annotations) on the export canvas
const drawCustomShapesOnCanvas = (ctx, mapArea, map, customShapes) => {
  if (!customShapes || customShapes.length === 0) return;
  
  customShapes.forEach(shape => {
    try {
      if (shape.geometry.type === 'Point') {
        const props = shape.properties || {};
        const pixel = map.project([shape.geometry.coordinates[0], shape.geometry.coordinates[1]]);
        const mapPixelX = mapArea.x + pixel.x;
        const mapPixelY = mapArea.y + pixel.y;
        const isText = props.type === 'text';
        if (isText) {
          const label = String(props.label || '').trim();
          if (label) {
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const w = ctx.measureText(label).width + 8;
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.fillRect(mapPixelX - w / 2, mapPixelY - 10, w, 20);
            ctx.fillStyle = props.textColor || '#111827';
            ctx.fillText(label, mapPixelX, mapPixelY);
          }
        } else {
          // Default point annotation
          ctx.fillStyle = '#3b82f6';
          ctx.beginPath();
          ctx.arc(mapPixelX, mapPixelY, 8, 0, 2 * Math.PI);
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.stroke();
          if (props && props.label) {
            ctx.fillStyle = '#1f2937';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            const textWidth = ctx.measureText(props.label).width;
            const labelX = mapPixelX;
            const labelY = mapPixelY - 15;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(labelX - textWidth/2 - 4, labelY - 12, textWidth + 8, 16);
            ctx.fillStyle = '#1f2937';
            ctx.fillText(props.label, labelX, labelY);
          }
        }
        
      } else if (shape.geometry.type === 'LineString') {
        const props = shape.properties || {};
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
        if (props.type === 'arrow') {
          try {
            const coords = shape.geometry.coordinates;
            const aPx = map.project(coords[coords.length - 2]);
            const bPx = map.project(coords[coords.length - 1]);
            const ax = mapArea.x + aPx.x, ay = mapArea.y + aPx.y;
            const bx = mapArea.x + bPx.x, by = mapArea.y + bPx.y;
            const dx = bx - ax, dy = by - ay; const len = Math.hypot(dx, dy) || 1; const ux = dx / len, uy = dy / len;
            const size = 16;
            ctx.fillStyle = '#111827';
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx - ux * size - uy * (size * 0.6), by - uy * size + ux * (size * 0.6));
            ctx.lineTo(bx - ux * size + uy * (size * 0.6), by - uy * size - ux * (size * 0.6));
            ctx.closePath();
            ctx.fill();
          } catch (_) {}
        }
        
        // Draw label at midpoint if available
        if (props && props.label) {
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
          const textWidth = ctx.measureText(props.label).width;
          const labelX = mapPixelX;
          const labelY = mapPixelY;
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(labelX - textWidth/2 - 4, labelY - 8, textWidth + 8, 16);
          
          ctx.fillStyle = '#1f2937';
          ctx.fillText(props.label, labelX, labelY);
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
      // Rectangle polygons: draw textured polygon instead of icon
      if (objectType.geometryType === 'rect' && obj?.geometry?.type === 'Polygon') {
        const ring = Array.isArray(obj.geometry.coordinates?.[0]) ? obj.geometry.coordinates[0] : [];
        if (ring.length >= 4) {
          // Build path in export canvas coordinates using offscreen map projection
          ctx.save();
          ctx.beginPath();
          ring.forEach((coord, i) => {
            const px = map.project([coord[0], coord[1]]);
            const x = mapArea.x + px.x;
            const y = mapArea.y + px.y;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.closePath();
          // Texture fill if available
          try {
            if (objectType.texture?.url) {
              const img = await loadImage(objectType.texture.url);
              const pat = ctx.createPattern(img, 'repeat');
              if (pat) {
                ctx.fillStyle = pat;
                ctx.globalAlpha = 0.9;
                ctx.fill();
                ctx.globalAlpha = 1;
              }
            } else {
              ctx.fillStyle = 'rgba(0,0,0,0.08)';
              ctx.fill();
            }
          } catch (_) {
            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            ctx.fill();
          }
          // Outline
          ctx.strokeStyle = '#111827';
          ctx.lineWidth = 2;
          ctx.stroke();
          // Dimension label at center
          try {
            const a = map.project([ring[0][0], ring[0][1]]);
            const c = map.project([ring[2][0], ring[2][1]]);
            const cx = mapArea.x + (a.x + c.x) / 2;
            const cy = mapArea.y + (a.y + c.y) / 2;
            const dims = obj?.properties?.dimensions || obj?.properties?.user_dimensions_m;
            let label = objectType.name;
            if (dims) {
              if (objectType.units === 'ft') {
                const wFt = Math.round((dims.width || 0) * 3.28084);
                const hFt = Math.round((dims.height || 0) * 3.28084);
                label = `${objectType.name} ${wFt} ft × ${hFt} ft`;
              } else {
                label = `${objectType.name} ${(dims.width || 0).toFixed(1)} m × ${(dims.height || 0).toFixed(1)} m`;
              }
            }
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // white halo
            const w = ctx.measureText(label).width + 8;
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.fillRect(cx - w / 2, cy - 10, w, 20);
            ctx.fillStyle = '#111827';
            ctx.fillText(label, cx, cy);
          } catch (_) {}
          ctx.restore();
          continue;
        }
      }
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
        const isEnhanced = !!objectType?.enhancedRendering?.enabled;
        const base = objectType.enhancedRendering?.spriteBase;
        const dir = objectType.enhancedRendering?.publicDir || '/data/icons/isometric-bw';
        const angleStr = String((((obj?.properties?.rotationDeg ?? 0) % 360) + 360) % 360).padStart(3, '0');
        const src = isEnhanced && base ? `${dir}/${base}_${angleStr}.png` : objectType.imageUrl;
        const img = await loadImage(src);
        // Draw a contrasting background circle for visibility
        try {
          const c = document.createElement('canvas');
          const w = Math.max(1, Math.min(24, img.width || 24));
          const h = Math.max(1, Math.min(24, img.height || 24));
          c.width = w; c.height = h;
          const cctx = c.getContext('2d', { willReadFrequently: true });
          cctx.drawImage(img, 0, 0, w, h);
          const { data } = cctx.getImageData(0, 0, w, h);
          let lumSum = 0, aSum = 0;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3] / 255;
            if (a < 0.1) continue;
            lumSum += (0.2126 * r + 0.7152 * g + 0.0722 * b) * a;
            aSum += a;
          }
          const avgLum = aSum > 0 ? lumSum / aSum : 0;
          const isLight = avgLum >= 200;
          let bg = 'rgba(255,255,255,0.9)';
          if (isLight) {
            const rgb = hexToRgb(objectType.color || '#64748b') || { r: 31, g: 41, b: 55 };
            bg = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)`;
          }
          ctx.save();
          ctx.beginPath();
          ctx.arc(mapPixelX, mapPixelY, objSize / 2, 0, 2 * Math.PI);
          ctx.fillStyle = bg;
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.1)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        } catch (_) {}
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







