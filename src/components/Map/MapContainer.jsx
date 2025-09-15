// components/Map/MapContainer.jsx
import React, { forwardRef, useEffect, useState, useRef } from 'react';
import MapTooltip from './MapTooltip';
import ClickPopover from './ClickPopover';
import { useZoneCreator } from '../../hooks/useZoneCreator';
import OverlapSelector from './OverlapSelector';
import DroppedObjects from './DroppedObjects';
import { computeDominantBearingFromPolygon, computeDominantViewportBearing } from '../../utils/enhancedRenderingUtils';
import { computeAreaOrientation, snapBearingRelativeToArea, quantizeAbsolute45, getSnappedBearing } from '../../utils/bearingUtils';
import DroppedRectangles from './DroppedRectangles';
import DroppedObjectNoteEditor from './DroppedObjectNoteEditor';
import CustomShapeLabels from './CustomShapeLabels';
import NudgeMarkers from './NudgeMarkers';
import ActiveToolIndicator from './ActiveToolIndicator';
import LoadingOverlay from './LoadingOverlay';
import PlacementPreview from './PlacementPreview';
import { useMemo } from 'react';
import TextAnnotationEditor, { AnnotationActionPill } from './TextAnnotationEditor';
import { useMapViewState } from '../../hooks/useMapViewState';
import { useRotationControls } from '../../hooks/useRotationControls';
import { useSelectionController } from '../../hooks/useSelectionController';
import { useDroppedObjects } from '../../contexts/DroppedObjectsContext';
import { rotateRectanglePolygonMercator, normalizeAngle } from '../../utils/objectGeometry';

const DEBUG = false; // Set to true to enable MapContainer debug logs

const MapContainer = forwardRef(({ 
  map,
  mapLoaded, 
  focusedArea, 
  drawTools, 
  clickToPlace, 
  permitAreas,
  placeableObjects,
  infrastructure,
  nudges,
  highlightedIds,
  onDismissNudge,
  onMapClick,
  onObjectDrop,
  onObjectUpdate,
  onObjectRemove,
  onOverlapSelect,
  onOverlapDeselect,
  overlapSelector,
  activeTool,
  isLoading
}, ref) => {
  const { 
    handleMapMouseMove, 
    handleMapClick, 
    droppedObjects, 
    placementMode, 
    cursorPosition 
  } = clickToPlace;
  const mapContainerRef = useRef(null);
  const [noteEditingObject, setNoteEditingObject] = useState(null);
  const [textEditorFeatureId, setTextEditorFeatureId] = useState(null);
  const [annotationsTrigger, setAnnotationsTrigger] = useState(0);
  const subFocusArmedRef = useRef(false);
  const derivedSourceId = 'annotations-derived';
  const arrowIconId = 'annotation-arrowhead';
  const { selectedObjectId, selectedKind, select, clearSelection } = useDroppedObjects();
  // Track current arrow overlay so we can reliably close it on key/delete or draw events
  const arrowOverlayRef = useRef(null);
  // Track current annotations popup (MapLibre Popup) so global handlers can close it
  const annotationPopupRef = useRef(null);

  // Map view state (single source of truth for pitch/bearing/zoom/viewType)
  const view = useMapViewState(map);
  const suppressRotateSnapRef = useRef(false);
  const lastDiscreteBearingRef = useRef(null);
  // Track last area orientation and whether we were in isometric view
  const lastThetaRef = useRef(null);
  const lastIsoRef = useRef(null);
  // Compute a stable area-bearing from the focused area for alignment
  const areaBearingDeg = useMemo(() => {
    try {
      const g = (permitAreas?.hasSubFocus ? permitAreas?.subFocusArea?.geometry : permitAreas?.focusedArea?.geometry);
      if (!g) return 0;
      return computeAreaOrientation({ map, geometry: g, pitch: view?.pitch || 0 });
    } catch (_) { return 0; }
  }, [permitAreas?.focusedArea?.geometry, permitAreas?.subFocusArea?.geometry, permitAreas?.hasSubFocus, view?.pitch, map]);

  // Compass / camera state
  const [bearing, setBearing] = useState(0);
  const [pitch, setPitch] = useState(0);

  // Zone Creator: mandatory in intersections mode, always wire interactions there
  useZoneCreator(map, 'intersections');

  // Derive camera for compass/projection toggle from view hook
  useEffect(() => {
    try {
      setBearing(view?.bearing || 0);
      setPitch(view?.pitch || 0);
    } catch (_) {}
  }, [view?.bearing, view?.pitch]);

  // no-op

  // Force immediate label refresh on external annotation change events
  useEffect(() => {
    const bump = () => setAnnotationsTrigger(v => v + 1);
    window.addEventListener('annotations:changed', bump);
    // Open text editor when requested by draw tools
    const onOpenText = (e) => {
      try {
        const id = e?.detail?.featureId;
        if (id) setTextEditorFeatureId(id);
      } catch (_) {}
    };
    window.addEventListener('ui:open-text-editor', onOpenText);
    return () => window.removeEventListener('annotations:changed', bump);
  }, []);

  // Listen for sub-focus arming/disarming events
  useEffect(() => {
    const arm = () => { subFocusArmedRef.current = true; };
    const disarm = () => { subFocusArmedRef.current = false; };
    window.addEventListener('subfocus:arm', arm);
    window.addEventListener('subfocus:disarm', disarm);
    // Apply event: geometry comes from draw tools; compute and set subfocus without persisting draw feature
    const apply = (e) => {
      try {
        const geom = e?.detail?.geometry;
        if (!geom || !permitAreas?.focusedArea || !permitAreas?.setSubFocusPolygon) return;
        const ok = permitAreas.setSubFocusPolygon({ type: 'Feature', properties: {}, geometry: geom });
        subFocusArmedRef.current = false;
      } catch (_) {}
    };
    window.addEventListener('subfocus:apply', apply);
    return () => {
      window.removeEventListener('subfocus:arm', arm);
      window.removeEventListener('subfocus:disarm', disarm);
      window.removeEventListener('subfocus:apply', apply);
    };
  }, []);

  // Build derived features (text points, shape labels, arrow lines, and arrowheads) from Draw features
  const derivedAnnotations = useMemo(() => {
    try {
      // Defensive: if Draw is not yet initialized, return empty to avoid stale render
      const fc = drawTools?.draw?.current && drawTools.draw.current.getAll ? drawTools.draw.current.getAll() : null;
      const features = fc && Array.isArray(fc.features) ? fc.features : [];
      const texts = [];
      const shapeLabels = [];
      const arrows = [];
      const arrowheads = [];
      const mapBearing = (() => {
        try { return ((Number(view?.bearing || 0) % 360) + 360) % 360; } catch (_) { return 0; }
      })();
      (features || []).forEach((f) => {
        if (!f || !f.geometry) return;
        const props = f.properties || {};
        // 1) Explicit text annotations
        if (props.type === 'text' && f.geometry.type === 'Point' && props.label) {
          // Flip by 180° when map bearing would make the text upside-down in viewport
          const flip = (mapBearing > 90 && mapBearing < 270) ? 180 : 0;
          texts.push({ type: 'Feature', geometry: f.geometry, properties: { sourceId: f.id, type: 'text', label: props.label, textSize: props.textSize || 14, textColor: props.textColor || '#111827', halo: props.halo !== false, textRotate: flip } });
          return;
        }
        // 2) Arrow annotations: always derive line + arrowhead (even when labeled)
        if (props.type === 'arrow' && f.geometry.type === 'LineString') {
          const coords = f.geometry.coordinates || [];
          if (coords.length >= 2) {
            const a = coords[coords.length - 2];
            const b = coords[coords.length - 1];
            arrows.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [a, b] }, properties: { sourceId: f.id } });
            // Compute compass bearing (0°=north, clockwise) consistent with Maplibre icon-rotate
            const theta = Math.atan2(b[0] - a[0], b[1] - a[1]);
            let bearingDeg = (theta * 180) / Math.PI;
            if (bearingDeg < 0) bearingDeg += 360;
            arrowheads.push({ type: 'Feature', geometry: { type: 'Point', coordinates: b }, properties: { sourceId: f.id, bearing: bearingDeg, size: f.properties?.arrowSize || 1 } });
            // Optional label for arrow: midpoint text if label present
            if (typeof props.label === 'string' && props.label.trim()) {
              const mid = [ (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 ];
              // Base rotation follows the arrow direction in map space; flip by 180° if the resultant viewport angle would be upside-down
              let textRotate = bearingDeg;
              const viewportAngle = ((mapBearing + textRotate) % 360 + 360) % 360;
              if (viewportAngle > 90 && viewportAngle < 270) textRotate = (textRotate + 180) % 360;
              shapeLabels.push({ type: 'Feature', geometry: { type: 'Point', coordinates: mid }, properties: { sourceId: f.id, label: props.label, textSize: props.textSize || 14, textColor: props.textColor || '#111827', halo: props.halo !== false, textRotate } });
            }
          }
          return;
        }
        // 3) Generic non-text shapes with a label: derive a label point (centroid/midpoint)
        if (typeof props.label === 'string' && props.label.trim()) {
          const g = f.geometry;
          let center = null;
          if (g.type === 'Point') {
            center = g.coordinates;
          } else if (g.type === 'LineString') {
            const coords = Array.isArray(g.coordinates) ? g.coordinates : [];
            if (coords.length > 0) {
              let sumLng = 0, sumLat = 0;
              coords.forEach(c => { sumLng += c[0]; sumLat += c[1]; });
              center = [sumLng / coords.length, sumLat / coords.length];
            }
          } else if (g.type === 'Polygon') {
            const ring = Array.isArray(g.coordinates) && Array.isArray(g.coordinates[0]) ? g.coordinates[0] : [];
            if (ring.length > 0) {
              let sumLng = 0, sumLat = 0;
              ring.forEach(c => { sumLng += c[0]; sumLat += c[1]; });
              center = [sumLng / ring.length, sumLat / ring.length];
            }
          } else if (g.type === 'MultiPolygon') {
            const outer = Array.isArray(g.coordinates) && Array.isArray(g.coordinates[0]) && Array.isArray(g.coordinates[0][0]) ? g.coordinates[0][0] : [];
            if (outer.length > 0) {
              let sumLng = 0, sumLat = 0;
              outer.forEach(c => { sumLng += c[0]; sumLat += c[1]; });
              center = [sumLng / outer.length, sumLat / outer.length];
            }
          }
          if (center) {
            const flip = (mapBearing > 90 && mapBearing < 270) ? 180 : 0;
            shapeLabels.push({ type: 'Feature', geometry: { type: 'Point', coordinates: center }, properties: { sourceId: f.id, label: props.label, textSize: props.textSize || 14, textColor: props.textColor || '#111827', halo: props.halo !== false, textRotate: flip } });
          }
        }
      });
      return { type: 'FeatureCollection', features: [...texts, ...shapeLabels, ...arrows, ...arrowheads] };
    } catch (_) { return { type: 'FeatureCollection', features: [] }; }
  }, [drawTools?.draw?.current, clickToPlace.objectUpdateTrigger, annotationsTrigger, view?.bearing]);

  // Register arrowhead icon; re-register on style load and handle missing images
  useEffect(() => {
    if (!map) return;
    const register = () => {
      try {
        if (map.hasImage && map.hasImage(arrowIconId)) return;
      } catch (_) {}
      try {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,size,size);
        // Draw an open chevron (two line segments) pointing up (north)
        const tipX = size * 0.5;
        const tipY = size * 0.2;
        const arm = size * 0.28; // vertical extent down from tip
        const spread = arm * 0.7; // horizontal spread
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        // Left limb (down-left from tip)
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - spread, tipY + arm);
        ctx.stroke();
        // Right limb (down-right from tip)
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX + spread, tipY + arm);
        ctx.stroke();
        const data = ctx.getImageData(0,0,size,size);
        if (map.addImage) map.addImage(arrowIconId, data, { pixelRatio: 2 });
      } catch (e) {
        console.warn('Failed to register arrow icon', e);
      }
    };
    // Initial attempt
    register();
    // On style load
    const onStyleLoad = () => register();
    map.on('style.load', onStyleLoad);
    // Handle on-demand missing image
    const onMissing = (e) => { try { if (e && e.id === arrowIconId) register(); } catch (_) {} };
    map.on('styleimagemissing', onMissing);
    return () => {
      try { map.off('style.load', onStyleLoad); } catch (_) {}
      try { map.off('styleimagemissing', onMissing); } catch (_) {}
    };
  }, [map]);

  // Sync derived annotations source & layers
  useEffect(() => {
    if (!map) return;
    const ensure = () => {
      try {
        if (!map.getSource(derivedSourceId)) {
          map.addSource(derivedSourceId, { type: 'geojson', data: derivedAnnotations });
        } else {
          const src = map.getSource(derivedSourceId);
          src.setData(derivedAnnotations);
        }
        // Determine insertion point: below draw layers if present
        let insertBeforeId;
        try {
          const style = map.getStyle ? map.getStyle() : null;
          const firstDrawLayer = style && Array.isArray(style.layers)
            ? style.layers.find(l => typeof l.id === 'string' && (l.id.startsWith('mapbox-gl-draw') || l.id.startsWith('gl-draw')))
            : null;
          insertBeforeId = firstDrawLayer ? firstDrawLayer.id : undefined;
        } catch (_) {}
        // Text layer (both explicit text annotations and shape labels)
        if (!map.getLayer('annotation-text')) {
          map.addLayer({
            id: 'annotation-text',
            type: 'symbol',
            source: derivedSourceId,
            filter: ['has', 'label'],
            layout: {
              'text-field': ['get', 'label'],
              'text-size': ['coalesce', ['get', 'textSize'], 14],
              'text-font': ['literal', ['Open Sans Bold','Arial Unicode MS Bold']],
              // Center text for standalone text annotations; keep shape labels above
              'text-offset': ['case', ['==', ['get', 'type'], 'text'], ['literal', [0, 0]], ['literal', [0, -1.0]]],
              'text-anchor': ['case', ['==', ['get', 'type'], 'text'], 'center', 'bottom'],
              // Keep labels perfectly horizontal in the viewport regardless of map rotation/pitch
              'text-rotate': 0,
              'text-rotation-alignment': 'viewport',
              'text-pitch-alignment': 'viewport',
              'text-keep-upright': true,
              // Favor always-visible labels for user annotations
              'text-allow-overlap': true,
              'text-ignore-placement': true
            },
            paint: {
              'text-color': ['coalesce', ['get', 'textColor'], '#111827'],
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.0,
              // Hide map-canvas text; we'll draw DOM overlay labels above all layers to fix z-order
              'text-opacity': 0
            }
          });
        } else {
          // Ensure rotation properties are applied if the layer already exists
          try { map.setLayoutProperty('annotation-text', 'text-rotate', 0); } catch (_) {}
          try { map.setLayoutProperty('annotation-text', 'text-rotation-alignment', 'viewport'); } catch (_) {}
          try { map.setLayoutProperty('annotation-text', 'text-pitch-alignment', 'viewport'); } catch (_) {}
          try { map.setLayoutProperty('annotation-text', 'text-keep-upright', true); } catch (_) {}
          try { map.setLayoutProperty('annotation-text', 'text-allow-overlap', true); } catch (_) {}
          try { map.setLayoutProperty('annotation-text', 'text-ignore-placement', true); } catch (_) {}
          try { map.setPaintProperty('annotation-text', 'text-opacity', 0); } catch (_) {}
        }
        // Arrow lines layer (black)
        if (!map.getLayer('annotation-arrows')) {
          map.addLayer({
            id: 'annotation-arrows',
            type: 'line',
            source: derivedSourceId,
            filter: ['==', ['geometry-type'], 'LineString'],
            layout: {
              'line-cap': 'round',
              'line-join': 'round'
            },
            paint: {
              'line-color': '#000000',
              'line-width': 3
            }
          }, insertBeforeId);
        }
        // Arrowhead layer
        if (!map.getLayer('annotation-arrowheads')) {
          map.addLayer({
            id: 'annotation-arrowheads',
            type: 'symbol',
            source: derivedSourceId,
            filter: ['all', ['!', ['has', 'label']], ['has', 'bearing']],
            layout: {
              'icon-image': arrowIconId,
              'icon-rotate': ['get', 'bearing'],
              'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 18, 0.9],
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'icon-rotation-alignment': 'map',
              'icon-pitch-alignment': 'map'
            }
          }, insertBeforeId);
        } else {
          try { map.setLayoutProperty('annotation-arrowheads', 'icon-rotate', ['get', 'bearing']); } catch (_) {}
          try { map.setLayoutProperty('annotation-arrowheads', 'icon-rotation-alignment', 'map'); } catch (_) {}
          try { map.setLayoutProperty('annotation-arrowheads', 'icon-pitch-alignment', 'map'); } catch (_) {}
        }
      } catch (e) {
        // noop
      }
    };
    const ready = typeof map.isStyleLoaded === 'function' ? map.isStyleLoaded() : true;
    if (ready) ensure(); else map.once('style.load', ensure);
    // Also schedule a second pass shortly after to catch late Draw binding after import
    try { setTimeout(() => { try { ensure(); } catch (_) {} }, 100); } catch (_) {}
  }, [map, derivedAnnotations]);

  // Build DOM overlay labels from derived annotations so they can render above all map layers and SVG overlays
  const domAnnotationLabels = useMemo(() => {
    try {
      if (!map || !derivedAnnotations || !Array.isArray(derivedAnnotations.features)) return [];
      // Only points with a label
      const feats = derivedAnnotations.features.filter(f => f && f.geometry && f.geometry.type === 'Point' && f.properties && typeof f.properties.label === 'string' && f.properties.label.trim());
      return feats.map((f, idx) => {
        const [lng, lat] = f.geometry.coordinates || [];
        const pt = map.project([lng, lat]);
        const size = Number(f.properties?.textSize || 14);
        const color = f.properties?.textColor || '#111827';
        const halo = f.properties?.halo !== false;
        return { id: `${f.properties?.sourceId || 'lbl'}-${idx}`, x: pt.x, y: pt.y, label: f.properties.label, size, color, halo };
      });
    } catch (_) { return []; }
  }, [map, derivedAnnotations, view?.renderTick]);

  // Keep annotation layers above MapboxDraw layers (which may be added later)
  useEffect(() => {
    if (!map) return;
    const bringToTop = (id) => {
      try { if (map.getLayer(id)) map.moveLayer(id); } catch (_) {}
    };
    // Hide Draw's default point styling for text annotations and line styling for arrows
    const hideDrawTextPoints = () => {
      try {
        const style = map.getStyle && map.getStyle();
        const layers = (style && style.layers) ? style.layers : [];
        layers.forEach((l) => {
          try {
            if (!l || !l.id || !l.source) return;
            const isDrawSource = l.source === 'mapbox-gl-draw-cold' || l.source === 'mapbox-gl-draw-hot';
            if (!isDrawSource) return;
            const existing = map.getFilter && map.getFilter(l.id);
            if (l.type === 'circle' || (typeof l.id === 'string' && (l.id.includes('point') || l.id.includes('point-stroke')))) {
              const base = existing || ['==', ['geometry-type'], 'Point'];
              const next = ['all', base, ['!=', ['get', 'type'], 'text']];
              map.setFilter(l.id, next);
              if (l.type === 'circle') {
                try { map.setPaintProperty(l.id, 'circle-opacity', ['case', ['==', ['get', 'type'], 'text'], 0, 1]); } catch (_) {}
                try { map.setPaintProperty(l.id, 'circle-stroke-opacity', ['case', ['==', ['get', 'type'], 'text'], 0, 1]); } catch (_) {}
              }
            } else if (l.type === 'line') {
              const base = existing || ['==', ['geometry-type'], 'LineString'];
              // Keep active/hot features visible to ensure selection/deletion works repeatedly
              const next = ['all', base, ['any', ['!=', ['get', 'type'], 'arrow'], ['==', ['get', 'active'], 'true']]];
              map.setFilter(l.id, next);
            }
          } catch (_) {}
        });
      } catch (_) {}
    };
    const t = setTimeout(() => {
      bringToTop('annotation-text');
      bringToTop('annotation-arrows');
      bringToTop('annotation-arrowheads');
      hideDrawTextPoints();
    }, 50);
    return () => clearTimeout(t);
  }, [map, drawTools?.draw, derivedAnnotations]);

  // Add click-to-edit popup for annotation layers
  useEffect(() => {
    if (!map) return;
    let popup = null;
    let suppressSequence = false;
    const Ctor = (typeof window !== 'undefined' && (window.maplibregl || window.mapboxgl) && (window.maplibregl.Popup || window.mapboxgl.Popup)) || null;
    const ensurePopup = () => {
      if (popup) { annotationPopupRef.current = popup; return popup; }
      if (!Ctor) return null;
      try { popup = new Ctor({ closeButton: false, closeOnClick: false, offset: [0, -12] }); } catch (_) { popup = null; }
      annotationPopupRef.current = popup;
      return popup;
    };
    const openAt = (lngLat, el) => {
      const p = ensurePopup();
      if (!p || !el) return;
      p.setDOMContent(el);
      p.setLngLat(lngLat);
      p.addTo(map);
      annotationPopupRef.current = p;
      try { console.debug('ANNOT: popup opened', { lngLat }); } catch (_) {}
      try {
        const root = p.getElement && p.getElement();
        if (root) {
          root.style.background = 'transparent';
          root.style.border = 'none';
          root.style.boxShadow = 'none';
          const contentEl = root.querySelector('.maplibregl-popup-content, .mapboxgl-popup-content');
          if (contentEl) {
            contentEl.style.background = 'transparent';
            contentEl.style.border = 'none';
            contentEl.style.boxShadow = 'none';
            contentEl.style.padding = '0';
          }
          const tipEl = root.querySelector('.maplibregl-popup-tip, .mapboxgl-popup-tip');
          if (tipEl) tipEl.style.display = 'none';
        }
      } catch (_) {}
    };
    const buildPill = (buttons = []) => {
      const wrap = document.createElement('div');
      const box = document.createElement('div');
      box.className = 'rounded-full px-2 py-1 text-[11px] shadow-sm flex gap-1 bg-white/90 dark:bg-gray-900/80 border border-gray-200/60 dark:border-gray-700/60';
      box.style.transform = 'translateY(4px) scale(0.97)';
      box.style.opacity = '0';
      box.style.transition = 'opacity 140ms ease, transform 160ms cubic-bezier(.2,.7,.3,1)';
      buttons.forEach(({ label, onClick, className }) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.className = className || 'px-2 py-0.5 rounded-full border border-gray-300/70 dark:border-gray-700 text-gray-700 dark:text-gray-200 bg-white/70 dark:bg-gray-800/50 hover:bg-white/90';
        b.onclick = (e) => { e.stopPropagation(); onClick && onClick(e); try { popup && popup.remove(); } catch (_) {} };
        box.appendChild(b);
      });
      wrap.appendChild(box);
      requestAnimationFrame(() => { box.style.transform = 'translateY(0) scale(1)'; box.style.opacity = '1'; });
      return wrap;
    };

    const closeArrowOverlay = () => {
      try {
        const ref = arrowOverlayRef.current;
        if (ref && ref.root && ref.mount) {
          try { ref.root.unmount(); } catch (_) {}
          try { if (ref.mount.parentNode) ref.mount.parentNode.removeChild(ref.mount); } catch (_) {}
        }
      } catch (_) {}
      arrowOverlayRef.current = null;
    };

    const openForFeature = (feature, lngLat) => {
      try {
        try { console.debug('ANNOT: openForFeature', { id: feature?.properties?.sourceId, geomType: feature?.geometry?.type }); } catch (_) {}
        const srcId = feature?.properties?.sourceId;
        if (!srcId) return;
        // Treat both line and arrowhead point as arrow features if they carry a sourceId
        const isArrow = !!srcId && ((feature && feature.geometry && feature.geometry.type !== 'Point') || (feature && feature.properties && typeof feature.properties.bearing !== 'undefined'));
        const getDraw = () => (drawTools && drawTools.draw && drawTools.draw.current) ? drawTools.draw.current : (map && map.getControl ? map.getControl('MapboxDraw') : null);
        const drawCtrl = getDraw();
        if (isArrow) {
          // Use MapLibre popup just like DroppedObjects for reliability
          try { if (popup) popup.remove(); } catch (_) {}
          const el = buildPill([
            { label: 'Label…', onClick: () => {
              try {
                const val = typeof window !== 'undefined' ? window.prompt('Arrow label') : null;
                if (val != null && drawCtrl) {
                  if (drawCtrl.setFeatureProperty) drawCtrl.setFeatureProperty(srcId, 'label', String(val));
                  else {
                    try { const f = drawCtrl.get(srcId); if (f) { f.properties = Object.assign({}, f.properties || {}, { label: String(val) }); drawCtrl.add(f); } } catch (_) {}
                  }
                  try { window.dispatchEvent(new Event('annotations:changed')); } catch (_) {}
                  setAnnotationsTrigger(v => v + 1);
                }
              } catch (_) {}
            } },
            { label: 'Remove', className: 'text-white rounded-full px-2 py-0.5 bg-red-500 hover:bg-red-600', onClick: () => {
              try { drawCtrl && drawCtrl.delete && drawCtrl.delete(srcId); } catch (_) {}
              setAnnotationsTrigger(v => v + 1);
            } }
          ]);
          openAt(lngLat, el);
        } else {
          const el = buildPill([
            { label: 'Edit', onClick: () => setTextEditorFeatureId(srcId) },
            { label: 'Remove', className: 'text-white rounded-full px-2 py-0.5 bg-red-500 hover:bg-red-600', onClick: () => { try { console.debug('ANNOT: remove clicked for text', { srcId, hasDraw: !!drawCtrl }); drawCtrl && drawCtrl.delete && drawCtrl.delete(srcId); } catch (_) {} setAnnotationsTrigger(v => v + 1); } }
          ]);
          openAt(lngLat, el);
        }
      } catch (_) {}
    };

    // Direct layer-bound handlers mirroring DroppedObjects approach (more reliable than canvas capture)
    const onArrowClick = (e) => {
      try {
        if (!e || !e.features || !e.features[0]) return;
        const f = e.features[0];
        if (e && e.preventDefault) e.preventDefault();
        const oe = e && (e.originalEvent || e.point && e.point.originalEvent);
        if (oe && typeof oe.stopPropagation === 'function') oe.stopPropagation();
        openForFeature(f, e.lngLat);
      } catch (_) {}
    };
    const cursorPointerOn = () => { try { map && map.getCanvas && (map.getCanvas().style.cursor = 'pointer'); } catch (_) {} };
    const cursorPointerOff = () => { try { map && map.getCanvas && (map.getCanvas().style.cursor = ''); } catch (_) {} };
    const bindAnnotationLayerHandlers = () => {
      try {
        if (map.getLayer && map.getLayer('annotation-arrows')) {
          map.on('click', 'annotation-arrows', onArrowClick);
          map.on('mouseenter', 'annotation-arrows', cursorPointerOn);
          map.on('mouseleave', 'annotation-arrows', cursorPointerOff);
        }
      } catch (_) {}
      try {
        if (map.getLayer && map.getLayer('annotation-arrowheads')) {
          map.on('click', 'annotation-arrowheads', onArrowClick);
          map.on('mouseenter', 'annotation-arrowheads', cursorPointerOn);
          map.on('mouseleave', 'annotation-arrowheads', cursorPointerOff);
        }
      } catch (_) {}
    };
    bindAnnotationLayerHandlers();
    const onStyleLoadRebindAnnots = () => bindAnnotationLayerHandlers();
    try { map.on('style.load', onStyleLoadRebindAnnots); } catch (_) {}

    const canvas = map && map.getCanvas ? map.getCanvas() : null;
    if (!canvas) return;
    const layers = ['annotation-text', 'annotation-arrows', 'annotation-arrowheads'];

    const onMouseDownCapture = (ev) => {
      try {
        const rect = canvas.getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;
        const feats = map.queryRenderedFeatures && map.queryRenderedFeatures([x, y], { layers });
        if (feats && feats.length > 0) {
          try { console.debug('ANNOT: mousedown hit', { x, y, hits: feats.length }); } catch (_) {}
          // Prevent Draw/map handlers and open pill
          ev.preventDefault();
          if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
          if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
          ev.cancelBubble = true;
          suppressSequence = true;
          try { console.debug('ANNOT: preventing downstream handlers (mousedown)'); } catch (_) {}
          const lngLat = map.unproject([x, y]);
          openForFeature(feats[0], lngLat);
        } else if (popup) {
          try { console.debug('ANNOT: outside click on canvas; closing popup'); } catch (_) {}
          try { popup.remove(); } catch (_) {}
          // Allow event to propagate normally
        }
      } catch (_) {}
    };

    const onMouseUpCapture = (ev) => {
      try {
        if (suppressSequence) {
          try { console.debug('ANNOT: mouseup capture suppressed (open sequence)'); } catch (_) {}
          ev.preventDefault();
          if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
          if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
          ev.cancelBubble = true;
        }
      } catch (_) {}
    };

    const onClickCapture = (ev) => {
      try {
        if (suppressSequence) {
          try { console.debug('ANNOT: click capture suppressed (open sequence)'); } catch (_) {}
          ev.preventDefault();
          if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
          if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
          ev.cancelBubble = true;
          suppressSequence = false;
        }
      } catch (_) {}
    };

    const onDblClickCapture = (ev) => {
      try {
        if (suppressSequence) {
          try { console.debug('ANNOT: dblclick capture suppressed (open sequence)'); } catch (_) {}
          ev.preventDefault();
          if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
          if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
          ev.cancelBubble = true;
          suppressSequence = false;
        }
      } catch (_) {}
    };

    const onDocPointerDownCapture = (ev) => {
      try {
        if (!popup) return;
        const root = popup.getElement && popup.getElement();
        if (!root) return;
        if (!root.contains(ev.target)) {
          try { console.debug('ANNOT: document outside pointerdown; closing popup'); } catch (_) {}
          try { popup.remove(); } catch (_) {}
          annotationPopupRef.current = null;
        }
      } catch (_) {}
    };

    const onDrawUpdateClose = () => {
      try {
        if (popup) {
          try { console.debug('ANNOT: draw.update -> closing popup'); } catch (_) {}
          popup.remove();
        }
        try { if (arrowOverlayRef.current) { console.debug('ANNOT: draw.update -> closing arrow overlay'); } } catch (_) {}
        try {
          const ref = arrowOverlayRef.current;
          if (ref && ref.root && ref.mount) {
            try { ref.root.unmount(); } catch (_) {}
            try { if (ref.mount.parentNode) ref.mount.parentNode.removeChild(ref.mount); } catch (_) {}
          }
        } catch (_) {}
        arrowOverlayRef.current = null;
        annotationPopupRef.current = null;
      } catch (_) {}
    };

    // Capture-phase listeners on the canvas
    try { canvas.addEventListener('mousedown', onMouseDownCapture, true); } catch (_) {}
    try { canvas.addEventListener('mouseup', onMouseUpCapture, true); } catch (_) {}
    try { canvas.addEventListener('click', onClickCapture, true); } catch (_) {}
    try { canvas.addEventListener('dblclick', onDblClickCapture, true); } catch (_) {}
    // Global outside-click handler (capture)
    try { document.addEventListener('pointerdown', onDocPointerDownCapture, true); } catch (_) {}
    // Close on Draw updates (moving annotations)
    try { map.on('draw.update', onDrawUpdateClose); } catch (_) {}
    // Also close on feature deletion and selection changes
    try { map.on('draw.delete', onDrawUpdateClose); } catch (_) {}
    try { map.on('draw.selectionchange', onDrawUpdateClose); } catch (_) {}
    try { map.on('draw.modechange', onDrawUpdateClose); } catch (_) {}

    return () => {
      try { canvas.removeEventListener('mousedown', onMouseDownCapture, true); } catch (_) {}
      try { canvas.removeEventListener('mouseup', onMouseUpCapture, true); } catch (_) {}
      try { canvas.removeEventListener('click', onClickCapture, true); } catch (_) {}
      try { canvas.removeEventListener('dblclick', onDblClickCapture, true); } catch (_) {}
      try { document.removeEventListener('pointerdown', onDocPointerDownCapture, true); } catch (_) {}
      try { map.off('draw.update', onDrawUpdateClose); } catch (_) {}
      try { map.off('draw.delete', onDrawUpdateClose); } catch (_) {}
      try { map.off('draw.selectionchange', onDrawUpdateClose); } catch (_) {}
      try { map.off('draw.modechange', onDrawUpdateClose); } catch (_) {}
      try { if (popup) { console.debug('ANNOT: cleanup removing popup'); popup.remove(); } } catch (_) {}
      try {
        const ref = arrowOverlayRef.current;
        if (ref && ref.root && ref.mount) {
          try { ref.root.unmount(); } catch (_) {}
          try { if (ref.mount.parentNode) ref.mount.parentNode.removeChild(ref.mount); } catch (_) {}
        }
      } catch (_) {}
      arrowOverlayRef.current = null;
      annotationPopupRef.current = null;
    };
  }, [map]);

  // Re-apply hiding of Draw points for text on style changes and mode changes
  useEffect(() => {
    if (!map) return;
    const rerun = () => {
      try {
        const style = map.getStyle && map.getStyle();
        if (!style) return;
        // Reuse logic by triggering a small timeout for ordering
        setTimeout(() => {
          try {
            const layers = style.layers || [];
            layers.forEach((l) => {
              try {
                if (!l || !l.id || !l.source) return;
                const isDrawSource = l.source === 'mapbox-gl-draw-cold' || l.source === 'mapbox-gl-draw-hot';
                const looksLikePointLayer = typeof l.id === 'string' && (l.id.includes('point') || l.id.includes('point-stroke'));
                if (isDrawSource && looksLikePointLayer) {
                  const existing = map.getFilter && map.getFilter(l.id);
                  const base = existing || ['==', ['geometry-type'], 'Point'];
                  const next = ['all', base, ['!=', ['get', 'type'], 'text']];
                  map.setFilter(l.id, next);
                }
              } catch (_) {}
            });
          } catch (_) {}
        }, 0);
      } catch (_) {}
    };
    map.on('style.load', rerun);
    map.on('draw.modechange', rerun);
    map.on('draw.render', rerun);
    return () => {
      try { map.off('style.load', rerun); } catch (_) {}
      try { map.off('draw.modechange', rerun); } catch (_) {}
      try { map.off('draw.render', rerun); } catch (_) {}
    };
  }, [map]);

  // Expose current rect mode + id for sidebar active highlight
  useEffect(() => {
    try {
      window.__app = Object.assign({}, window.__app || {}, {
        drawMode: drawTools?.draw?.current?.getMode ? drawTools.draw.current.getMode() : null,
        activeRectId: drawTools?.activeRectObjectTypeId || null,
        map,
        mapEl: map && map.getContainer ? map.getContainer() : null,
        mapContainer: mapContainerRef?.current || null
      });
    } catch (_) {}
  }, [drawTools]);

  // Compass click handler
  const handleCompassClick = () => {
    if (map && map.rotateTo) {
      map.rotateTo(0, { duration: 500 });
    }
  };

  // Projection toggle
  const snapToNearest45 = (deg) => {
    const d = ((deg % 360) + 360) % 360;
    const step = 45;
    return Math.round(d / step) * step;
  };
  const handleToggleProjection = () => {
    if (!map) return;
    const currentCenter = map.getCenter ? map.getCenter() : null;
    const currentZoom = map.getZoom ? map.getZoom() : undefined;
    const isIso = (map.getPitch ? map.getPitch() : 0) > 15;
    if (isIso) {
      // Return to top-down
      try {
        map.easeTo({ pitch: 0, bearing: 0, center: currentCenter || undefined, zoom: currentZoom, duration: 600 });
      } catch (_) {}
    } else {
      // Go to isometric: high pitch, snap bearing to nearest 45°
      const brg = snapToNearest45(map.getBearing ? map.getBearing() : 0) || 45;
      try {
        map.easeTo({ pitch: 60, bearing: brg, center: currentCenter || undefined, zoom: currentZoom, duration: 600 });
      } catch (_) {}
    }
  };

  // Keyboard map rotation (Q/E) with snapping relative to area orientation
  useEffect(() => {
    if (!map) return;
    const onKeyDown = (e) => {
      try {
        const t = e.target;
        const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
        if (typing) return;
        // Ignore key repeats to enforce exactly one 45° step per press
        if (e.repeat) return;
        // Only rotate map when not in placement mode and no selected object rotation keys pressed
        const key = (e.key || '').toLowerCase();
        if (key !== 'q' && key !== 'e') return;
        e.preventDefault();
        const dir = key === 'e' ? 1 : -1; // CW for E, CCW for Q
        const current = (typeof map.getBearing === 'function') ? map.getBearing() : 0;
        const p = (map.getPitch ? map.getPitch() : 0);
        const isIso = p > 15;
        const areaGeom = (permitAreas?.hasSubFocus ? permitAreas?.subFocusArea?.geometry : permitAreas?.focusedArea?.geometry) || null;
        const theta = areaGeom ? computeAreaOrientation({ map, geometry: areaGeom, pitch: p }) : 0;
        const snapToGrid = (bear) => ((theta + quantizeAbsolute45(bear - theta)) % 360 + 360) % 360;
        let base = lastDiscreteBearingRef.current;
        // Re-anchor to current grid if:
        // - no baseline yet
        // - user rotated away from last discrete bearing
        // - view type changed (e.g., toggled into/out of isometric)
        // - dominant area orientation changed materially (>= 1°)
        const diffFromLast = (base == null) ? Infinity : Math.abs((((current - base) % 360) + 540) % 360 - 180);
        const prevIso = lastIsoRef.current;
        const prevTheta = lastThetaRef.current;
        const thetaDrift = (prevTheta == null) ? 0 : Math.abs((((theta - prevTheta) % 360) + 540) % 360 - 180);
        const needsReanchor = (base == null) || (diffFromLast > 2) || (prevIso != null && prevIso !== isIso) || (prevTheta != null && thetaDrift > 1);
        if (needsReanchor) {
          base = snapToGrid(current);
        }
        // Update refs for next key press
        lastIsoRef.current = isIso;
        lastThetaRef.current = theta;
        const target = ((base + dir * 45) % 360 + 360) % 360;
        try { if (typeof map.stop === 'function') map.stop(); } catch (_) {}
        try {
          suppressRotateSnapRef.current = true;
          lastDiscreteBearingRef.current = target;
          map.easeTo({ bearing: target, duration: 180, essential: true });
        } catch (_) {
          suppressRotateSnapRef.current = false;
        }
      } catch (_) {}
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => { window.removeEventListener('keydown', onKeyDown); };
  }, [map, permitAreas?.hasSubFocus, permitAreas?.subFocusArea?.geometry, permitAreas?.focusedArea?.geometry]);

  // Snap free-rotate interactions on rotateend to nearest 45° relative to area orientation
  useEffect(() => {
    if (!map) return;
    const onRotateEnd = () => {
      try {
        if (suppressRotateSnapRef.current) { suppressRotateSnapRef.current = false; return; }
        const current = (typeof map.getBearing === 'function') ? map.getBearing() : 0;
        const areaGeom = (permitAreas?.hasSubFocus ? permitAreas?.subFocusArea?.geometry : permitAreas?.focusedArea?.geometry) || null;
        // Use unified snap that enforces absolute 45° alignment relative to area
        const absQ = getSnappedBearing(map, areaGeom, (map.getPitch ? map.getPitch() : 0), current);
        const delta = Math.abs((((absQ - current) % 360) + 540) % 360 - 180);
        if (delta > 0.5) {
          try { lastDiscreteBearingRef.current = absQ; map.rotateTo(absQ, { duration: 120 }); } catch (_) {}
        }
      } catch (_) {}
    };
    try { map.on('rotateend', onRotateEnd); } catch (_) {}
    return () => { try { map.off('rotateend', onRotateEnd); } catch (_) {} };
  }, [map, permitAreas?.hasSubFocus, permitAreas?.subFocusArea?.geometry, permitAreas?.focusedArea?.geometry]);

  // Delete selected dropped object or selected annotation with Delete/Backspace (select mode only)
  useEffect(() => {
    const onKeyDown = (e) => {
      try {
        // Ignore when typing in inputs/editors
        const t = e.target;
        const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
        if (typing) return;
        // Only act when not in placement mode
        if (placementMode) return;
        const isDel = e.key === 'Delete' || e.key === 'Backspace';
        if (!isDel) return;
        // Prevent page navigation/backspace default
        e.preventDefault();
        // Delete whichever kind is selected
        const id = selectedObjectId;
        if (id) {
          if (selectedKind === 'rect') {
            // Remove rectangle by deleting the corresponding dropped object
            try { clickToPlace.removeDroppedObject(id); } catch (_) {}
            try { clearSelection(); } catch (_) {}
            // Close any annotations popup immediately
            try { if (annotationPopupRef.current) { annotationPopupRef.current.remove(); annotationPopupRef.current = null; } } catch (_) {}
            return;
          }
          if (selectedKind === 'point') {
            try { clickToPlace.removeDroppedObject(id); } catch (_) {}
            try { clearSelection(); } catch (_) {}
            try { if (annotationPopupRef.current) { annotationPopupRef.current.remove(); annotationPopupRef.current = null; } } catch (_) {}
            return;
          }
        }
        // If no dropped object is selected, remove selected Draw annotation if any
        try {
          const selId = drawTools && drawTools.selectedShape;
          if (selId && drawTools && typeof drawTools.deleteSelectedShape === 'function') {
            drawTools.deleteSelectedShape();
          }
        } catch (_) {}
        // Regardless, close any active annotation popup immediately (MapLibre) and arrow overlay (React)
        try { if (annotationPopupRef.current) { annotationPopupRef.current.remove(); annotationPopupRef.current = null; } } catch (_) {}
        try { if (arrowOverlayRef.current) { const ref = arrowOverlayRef.current; ref.root.unmount(); if (ref.mount.parentNode) ref.mount.parentNode.removeChild(ref.mount); arrowOverlayRef.current = null; } } catch (_) {}
      } catch (_) {}
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [placementMode, selectedObjectId, selectedKind, clickToPlace, clearSelection, drawTools]);

  // Disable double-click zoom when map is loaded to prevent conflicts with permit area selection
  React.useEffect(() => {
    if (mapLoaded && map && map.doubleClickZoom) {
      map.doubleClickZoom.disable();
    }
  }, [mapLoaded, map]);

  // Open text editor on text feature creation anywhere
  useEffect(() => {
    if (!map) return;
    const onCreateAny = (e) => {
      try {
        const f = e?.features?.[0];
        if (f && f.geometry?.type === 'Point' && f.properties?.type === 'text') {
          setTextEditorFeatureId(f.id);
        }
        setAnnotationsTrigger(v => v + 1);
      } catch (_) {}
    };
    map.on('draw.create', onCreateAny);
    return () => { try { map.off('draw.create', onCreateAny); } catch (_) {} };
  }, [map, drawTools]);

  // Refresh derived annotations on updates/deletes as well
  useEffect(() => {
    if (!map || !drawTools?.draw?.current) return;
    const bump = () => setAnnotationsTrigger(v => v + 1);
    map.on('draw.update', bump);
    map.on('draw.delete', bump);
    map.on('draw.selectionchange', bump);
    // Ensure we also respond after Style reload or initial Draw render (post-import timing)
    map.on('draw.render', bump);
    map.on('style.load', bump);
    return () => {
      try { map.off('draw.update', bump); } catch (_) {}
      try { map.off('draw.delete', bump); } catch (_) {}
      try { map.off('draw.selectionchange', bump); } catch (_) {}
      try { map.off('draw.render', bump); } catch (_) {}
      try { map.off('style.load', bump); } catch (_) {}
    };
  }, [map, drawTools]);

  // Listen for rectangle draw completion to convert into dropped object and remove draw feature
  useEffect(() => {
    if (!map) return;
    const onCreate = (e) => {
      try {
        const f = e?.features?.[0];
        if (!f || f.geometry?.type !== 'Polygon') return;
        const typeId = f.properties?.user_rectObjectType;
        // If a rectangle-object type was set, this is an equipment rectangle → convert to dropped object
        if (typeId) {
          const objectType = placeableObjects?.find(p => p.id === typeId);
          if (!objectType) return;
          // Build dropped object
          const coords = f.geometry.coordinates?.[0] || [];
          if (coords.length < 4) return;
          const centroid = { lng: (coords[0][0] + coords[2][0]) / 2, lat: (coords[0][1] + coords[2][1]) / 2 };
          const obj = {
            id: `${typeId}-${Date.now()}`,
            type: typeId,
            name: objectType.name,
            position: centroid,
            geometry: f.geometry,
            properties: {
              label: objectType.name,
              rotationDeg: Number(f.properties?.user_rotationDeg || 0),
              dimensions: f.properties?.user_dimensions_m || null,
              timestamp: new Date().toISOString()
            }
          };
          clickToPlace.setDroppedObjects(prev => [...prev, obj]);
          try { drawTools.draw.current.delete(f.id); } catch (_) {}
          return;
        }

        // If sub-focus mode is armed and this is a regular polygon (not an equipment rectangle),
        // treat it as the sub-focus scope and do NOT persist the draw feature as an annotation
        if (subFocusArmedRef.current && !typeId && permitAreas?.focusedArea && permitAreas?.setSubFocusPolygon) {
          const ok = permitAreas.setSubFocusPolygon({ type: 'Feature', properties: {}, geometry: f.geometry });
          try { drawTools.draw.current.delete(f.id); } catch (_) {}
          subFocusArmedRef.current = false;
          if (ok) return;
        }
        // If a text annotation was created, open inline editor (also handle when created via point tool then tagged)
        setAnnotationsTrigger(v => v + 1);
      } catch (err) {
        console.warn('Failed to convert rect feature to dropped object', err);
      }
    };
    map.on('draw.create', onCreate);
    return () => { try { map.off('draw.create', onCreate); } catch (_) {} };
  }, [map, drawTools, placeableObjects, clickToPlace, permitAreas]);

  if (DEBUG) console.log('MapContainer: Rendering with map instance', {
    hasMap: !!map,
    hasProject: map && typeof map.project === 'function',
    mapLoaded,
    droppedObjectsCount: droppedObjects?.length || 0
  });

  // Utility: point-in-polygon for selection (lon/lat ring)
  const pointInPolygon = (point, ring) => {
    try {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        const intersect = ((yi > point[1]) !== (yj > point[1])) &&
          (point[0] < (xj - xi) * (point[1] - yi) / ((yj - yi) || 1e-12) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    } catch (_) { return false; }
  };

  // Selection controller
  const { handleClick: handleSelectionClick } = useSelectionController({
    map,
    placeableObjects,
    droppedObjects: clickToPlace.droppedObjects || [],
    isPlacementActive: !!clickToPlace.placementMode,
    setSelectedRectId: (id) => select(id, 'rect'),
    setSelectedPointId: (id) => select(id, 'point')
  });

  // Rotation controller (handles placement mode and selected objects)
  useRotationControls({
    isPlacementActive: !!placementMode,
    rotatePlacementStep: clickToPlace.rotatePlacementModeBy,
    hasSelectedRect: selectedKind === 'rect' && !!selectedObjectId,
    rotateSelectedRectBy: (delta) => {
      try {
        const id = selectedObjectId;
        clickToPlace.updateDroppedObject(id, (prev) => {
          if (!prev || prev?.geometry?.type !== 'Polygon') return prev;
          // Rotate in Web Mercator (map plane) for stability regardless of pitch
          const newGeom = rotateRectanglePolygonMercator(prev.geometry, delta);
          const curRot = Number(prev?.properties?.rotationDeg || 0);
          let nextRot = normalizeAngle(curRot + delta);
          return { ...prev, geometry: newGeom, properties: Object.assign({}, prev.properties || {}, { rotationDeg: nextRot }) };
        });
      } catch (_) {}
    },
    hasSelectedPoint: selectedKind === 'point' && !!selectedObjectId,
    rotateSelectedPointStep: (delta45) => {
      try {
        const id = selectedObjectId;
        clickToPlace.updateDroppedObject(id, (prev) => {
          if (!prev) return prev;
          const cur = Number(prev?.properties?.rotationDeg || 0);
          let next = normalizeAngle(cur + delta45);
          const snapped = Math.round(next / 45) * 45 % 360;
          const nextProps = Object.assign({}, prev.properties || {}, { rotationDeg: snapped });
          // Preserve geometry so rectangles keep rotation; for points, ensure geometryType detection stays intact
          return { ...prev, properties: nextProps };
        });
      } catch (_) {}
    },
    clearSelection,
    hasSelectedAnnotation: !!drawTools.selectedShape,
    rotateSelectedAnnotationBy: (deltaDeg) => {
      try {
        const id = drawTools.selectedShape;
        const d = drawTools.draw && drawTools.draw.current; if (!d || !id) return;
        const f = d.get(id); if (!f || !f.geometry) return;
        const g = f.geometry;
        // Rotate in WebMercator (map plane) for stability regardless of pitch
        const R = 6378137; // meters
        const toMerc = ([lng, lat]) => {
          const x = R * (lng * Math.PI / 180);
          const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
          return [x, y];
        };
        const toLngLat = ([x, y]) => {
          const lng = (x / R) * 180 / Math.PI;
          const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI;
          return [lng, lat];
        };
        const coordsAll = (g.type === 'LineString') ? g.coordinates
          : (g.type === 'Polygon') ? (g.coordinates[0] || []) : null;
        if (!Array.isArray(coordsAll) || coordsAll.length < 2) return;
        const mercPts = coordsAll.map(toMerc);
        // Centroid in mercator
        let cx = 0, cy = 0;
        mercPts.forEach(([x, y]) => { cx += x; cy += y; });
        cx /= mercPts.length; cy /= mercPts.length;
        const rad = deltaDeg * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rotateMerc = ([x, y]) => {
          const dx = x - cx, dy = y - cy;
          const rx = cx + dx * cos - dy * sin;
          const ry = cy + dx * sin + dy * cos;
          return [rx, ry];
        };
        let newGeom = null;
        if (g.type === 'LineString') {
          const rotatedLngLat = mercPts.map(rotateMerc).map(toLngLat);
          newGeom = { type: 'LineString', coordinates: rotatedLngLat };
        } else if (g.type === 'Polygon') {
          const closed = mercPts.length >= 2 && (Math.abs(mercPts[0][0] - mercPts[mercPts.length - 1][0]) < 1e-6) && (Math.abs(mercPts[0][1] - mercPts[mercPts.length - 1][1]) < 1e-6);
          let rotated = mercPts.map(rotateMerc).map(toLngLat);
          if (closed) rotated[rotated.length - 1] = rotated[0];
          newGeom = { type: 'Polygon', coordinates: [rotated] };
        }
        if (newGeom) {
          try { d.setFeatureProperty(id, '__rot', (d.getFeatureProperty ? d.getFeatureProperty(id, '__rot') : 0) + deltaDeg); } catch (_) {}
          d.add({ ...f, geometry: newGeom });
          setAnnotationsTrigger(v => v + 1);
        }
      } catch (_) {}
    }
  });

  return (
    <div className="flex-1 relative">
      {/* Compass + Projection Toggle Overlay */}
      <div
        className="absolute bottom-4 left-4 z-50 flex flex-row items-end gap-2"
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-full w-12 h-12 flex items-center justify-center"
          style={{
            transform: `rotate(${-bearing}deg)`,
            pointerEvents: 'none',
            transition: 'transform 0.3s cubic-bezier(.4,2,.6,1)'
          }}
          aria-hidden="true"
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="15" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" fill="currentColor" fillOpacity="0.9" className="text-white dark:text-gray-800" />
            <polygon points="16,6 19,18 16,15 13,18" fill="#2563eb" />
            <text x="16" y="26" textAnchor="middle" fontSize="10" fill="#374151" fontWeight="bold">N</text>
          </svg>
        </div>

        <button
          className="bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-full w-12 h-12 flex items-center justify-center hover:scale-105 active:scale-95"
          style={{ pointerEvents: 'auto' }}
          title="Toggle projection (Top-down / Isometric)"
          onClick={handleToggleProjection}
        >
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
            {(pitch > 15) ? '2D' : 'ISO'}
          </span>
        </button>
      </div>
      
      <div 
        ref={ref} 
        className={`absolute inset-0 ${placementMode ? 'cursor-crosshair' : ''}`}
        style={{ width: '100%', height: '100%' }}
        onMouseMove={handleMapMouseMove}
        onClick={(e) => {
          try {
            // If an upstream handler already handled this event (e.g., annotation mousedown/click), skip
            if (e && (e.defaultPrevented || (e.nativeEvent && e.nativeEvent.defaultPrevented))) return;
            if (e && e.cancelBubble) return;
          } catch (_) {}
          try { handleMapClick(e); } catch (_) {}
          try {
            if (e && (e.defaultPrevented || (e.nativeEvent && e.nativeEvent.defaultPrevented))) return;
            if (e && e.cancelBubble) return;
          } catch (_) {}
          // Only run selection logic when not in placement mode
          if (!placementMode) {
            handleSelectionClick(e);
          }
        }}
      />
      
      <DroppedObjects
        objects={droppedObjects}
        placeableObjects={placeableObjects}
        map={map}
        onRemoveObject={clickToPlace.removeDroppedObject}
        objectUpdateTrigger={clickToPlace.objectUpdateTrigger}
        onEditNote={(obj) => setNoteEditingObject(obj)}
        isNoteEditing={!!noteEditingObject}
        selectedId={selectedKind === 'point' ? selectedObjectId : null}
        onSelectObject={(obj) => {
          try {
            const t = placeableObjects.find(p => p.id === obj.type);
            if (t?.geometryType === 'rect') {
              select(obj.id, 'rect');
            } else {
              // Select any non-rect point object for rotation
              select(obj.id, 'point');
            }
          } catch (_) {}
        }}
        onMoveObject={(id, lng, lat) => {
          try {
            clickToPlace.updateDroppedObject(id, (prev) => {
              if (!prev) return prev;
              return { ...prev, position: { lng, lat } };
            });
          } catch (_) {}
        }}
        areaBearingDeg={areaBearingDeg}
      />

      {/* DOM overlay text labels to ensure highest z-order over map and SVG overlays */}
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 60 }}>
        {domAnnotationLabels.map((l) => (
          <div
            key={l.id}
            style={{
              position: 'absolute',
              left: l.x,
              top: l.y,
              transform: 'translate(-50%, -100%)',
              fontSize: `${l.size}px`,
              color: l.color,
              textShadow: l.halo ? '0 0 2px #fff, 0 0 2px #fff' : undefined,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              pointerEvents: 'none'
            }}
          >
            {l.label}
          </div>
        ))}
      </div>


      {noteEditingObject && (
        <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
          {/* Capture wheel/drag to disable map interactions while editing */}
          <div className="absolute inset-0" style={{ pointerEvents: 'auto' }} onWheel={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} />
          <DroppedObjectNoteEditor
            map={map}
            object={noteEditingObject}
            objectUpdateTrigger={clickToPlace.objectUpdateTrigger}
            onSave={(text) => {
              clickToPlace.setDroppedObjectNote(noteEditingObject.id, text);
              setNoteEditingObject(null);
            }}
            onCancel={() => setNoteEditingObject(null)}
          />
        </div>
      )}
      
      {/* Labels now rendered via map symbol layer from derivedAnnotations; disable HTML overlay */}

      {textEditorFeatureId && (
        <TextAnnotationEditor
          map={map}
          featureId={textEditorFeatureId}
          drawRef={drawTools.draw}
          onSave={() => { setTextEditorFeatureId(null); setAnnotationsTrigger(v => v + 1); }}
          onCancel={() => setTextEditorFeatureId(null)}
        />
      )}
      
      {/* Placement Preview */}
      <PlacementPreview
        placementMode={placementMode}
        cursorPosition={cursorPosition}
        placeableObjects={placeableObjects}
        map={map}
      />

      {/* Floating per-instance nudge markers */}
      <NudgeMarkers
        nudges={nudges}
        map={map}
        objectUpdateTrigger={clickToPlace.objectUpdateTrigger}
        onDismiss={onDismissNudge}
        highlightedIds={highlightedIds}
      />
      
      {!mapLoaded && <LoadingOverlay />}
      
      {drawTools?.activeTool && <ActiveToolIndicator tool={drawTools.activeTool} />}
      
      {/* Only show hover tooltip when not drawing and no clicked popover is visible */}
      {!drawTools?.activeTool && !permitAreas.clickedTooltip?.visible && (
        <MapTooltip tooltip={permitAreas.tooltip} />
      )}

      {/* Clicked popover (parks mode), persists and follows camera */}
      {permitAreas.clickedTooltip?.visible && (
        <ClickPopover 
          tooltip={permitAreas.clickedTooltip}
          stats={permitAreas.clickedTooltip.stats}
          distributions={permitAreas.clickedTooltip.distributions}
          onClose={permitAreas.dismissClickedTooltip}
          onFocus={permitAreas.focusClickedTooltipArea}
        />
      )}
      
      {permitAreas.showOverlapSelector && (
        <OverlapSelector 
          overlappingAreas={permitAreas.overlappingAreas}
          selectedIndex={permitAreas.selectedOverlapIndex}
          clickPosition={permitAreas.clickPosition}
          onSelect={permitAreas.selectOverlappingArea}
          onClose={permitAreas.clearOverlapSelector}
        />
      )}
      {/* Ensure rectangles overlay renders on top of other overlays */}
      <DroppedRectangles
        objects={droppedObjects}
        placeableObjects={placeableObjects}
        map={map}
        objectUpdateTrigger={clickToPlace.objectUpdateTrigger}
        selectedId={selectedKind === 'rect' ? selectedObjectId : null}
        onSelectRect={(id) => select(id, 'rect')}
        onResizeRect={(id, newGeom) => {
          try {
            clickToPlace.updateDroppedObject(id, (prev) => {
              if (!prev) return prev;
              // Update dimensions label from new geometry using great-circle distances on sides
              let dims = prev?.properties?.dimensions || prev?.properties?.user_dimensions_m || {};
              try {
                const ring = Array.isArray(newGeom?.coordinates?.[0]) ? newGeom.coordinates[0] : [];
                if (ring.length >= 4 && map && typeof map.project === 'function') {
                  const a = ring[0], b = ring[1], c = ring[2];
                  const dist = (p, q) => {
                    const R = 6371000; // meters
                    const toRad = (d) => d * Math.PI / 180;
                    const dLat = toRad(q[1] - p[1]);
                    const dLon = toRad(q[0] - p[0]);
                    const lat1 = toRad(p[1]);
                    const lat2 = toRad(q[1]);
                    const s = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
                    const d = 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
                    return d;
                  };
                  const wMeters = dist(ring[0], ring[1]);
                  const hMeters = dist(ring[1], ring[2]);
                  dims = { width: wMeters, height: hMeters };
                }
              } catch (_) {}
              const nextProps = Object.assign({}, prev.properties || {}, { dimensions: dims });
              return { ...prev, geometry: newGeom, properties: nextProps };
            });
          } catch (_) {}
        }}
      />
    </div>
  );
});

MapContainer.displayName = 'MapContainer';

export default MapContainer;