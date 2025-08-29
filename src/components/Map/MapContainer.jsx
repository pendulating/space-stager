// components/Map/MapContainer.jsx
import React, { forwardRef, useEffect, useState, useRef } from 'react';
import MapTooltip from './MapTooltip';
import ClickPopover from './ClickPopover';
import { useZoneCreator } from '../../hooks/useZoneCreator';
import OverlapSelector from './OverlapSelector';
import DroppedObjects from './DroppedObjects';
import DroppedRectangles from './DroppedRectangles';
import DroppedObjectNoteEditor from './DroppedObjectNoteEditor';
import CustomShapeLabels from './CustomShapeLabels';
import NudgeMarkers from './NudgeMarkers';
import ActiveToolIndicator from './ActiveToolIndicator';
import LoadingOverlay from './LoadingOverlay';
import PlacementPreview from './PlacementPreview';
import { useMemo } from 'react';
import TextAnnotationEditor from './TextAnnotationEditor';
import { useMapViewState } from '../../hooks/useMapViewState';
import { useRotationControls } from '../../hooks/useRotationControls';
import { useSelectionController } from '../../hooks/useSelectionController';
import { useDroppedObjects } from '../../contexts/DroppedObjectsContext';
import { rotateRectanglePolygon, rotateRectanglePolygonScreen, normalizeAngle } from '../../utils/objectGeometry';

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

  // Map view state (single source of truth for pitch/bearing/zoom/viewType)
  const view = useMapViewState(map);

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
    return () => {
      window.removeEventListener('subfocus:arm', arm);
      window.removeEventListener('subfocus:disarm', disarm);
    };
  }, []);

  // Build derived features (text points, shape labels, arrow lines, and arrowheads) from Draw features
  const derivedAnnotations = useMemo(() => {
    try {
      const features = drawTools?.draw?.current ? drawTools.draw.current.getAll().features : [];
      const texts = [];
      const shapeLabels = [];
      const arrows = [];
      const arrowheads = [];
      (features || []).forEach((f) => {
        if (!f || !f.geometry) return;
        const props = f.properties || {};
        // 1) Explicit text annotations
        if (props.type === 'text' && f.geometry.type === 'Point' && props.label) {
          texts.push({ type: 'Feature', geometry: f.geometry, properties: { sourceId: f.id, type: 'text', label: props.label, textSize: props.textSize || 14, textColor: props.textColor || '#111827', halo: props.halo !== false } });
          return;
        }
        // 2) Arrow annotations: always derive line + arrowhead (even when labeled)
        if (props.type === 'arrow' && f.geometry.type === 'LineString') {
          const coords = f.geometry.coordinates || [];
          if (coords.length >= 2) {
            const a = coords[coords.length - 2];
            const b = coords[coords.length - 1];
            arrows.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [a, b] }, properties: { sourceId: f.id } });
            // Compute map-aligned bearing (degrees clockwise from north)
            const dx = b[0] - a[0];
            const dy = b[1] - a[1];
            const degFromEastCCW = (Math.atan2(dy, dx) * 180) / Math.PI;
            const bearingMapCWFromNorth = ((450 - degFromEastCCW) % 360 + 360) % 360;
            arrowheads.push({ type: 'Feature', geometry: { type: 'Point', coordinates: b }, properties: { sourceId: f.id, bearing: bearingMapCWFromNorth, size: f.properties?.arrowSize || 1 } });
            // Optional label for arrow: midpoint text if label present
            if (typeof props.label === 'string' && props.label.trim()) {
              const mid = [ (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 ];
              // Normalize label rotation to stay upright (avoid upside-down text)
              let textRotate = bearingMapCWFromNorth;
              if (textRotate > 90 && textRotate < 270) textRotate = (textRotate + 180) % 360;
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
            shapeLabels.push({ type: 'Feature', geometry: { type: 'Point', coordinates: center }, properties: { sourceId: f.id, label: props.label, textSize: props.textSize || 14, textColor: props.textColor || '#111827', halo: props.halo !== false } });
          }
        }
      });
      return { type: 'FeatureCollection', features: [...texts, ...shapeLabels, ...arrows, ...arrowheads] };
    } catch (_) { return { type: 'FeatureCollection', features: [] }; }
  }, [drawTools?.draw, clickToPlace.objectUpdateTrigger, annotationsTrigger]);

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
        // Draw an open chevron (two line segments) pointing right (east)
        const tipX = size * 0.8;
        const tipY = size * 0.5;
        const arm = size * 0.28;
        const spread = arm * 0.7;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        // Upper limb
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - arm, tipY - spread);
        ctx.stroke();
        // Lower limb
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - arm, tipY + spread);
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
              'text-rotate': ['coalesce', ['get', 'textRotate'], 0],
              'text-rotation-alignment': 'map',
              'text-pitch-alignment': 'map',
              'text-keep-upright': true
            },
            paint: {
              'text-color': ['coalesce', ['get', 'textColor'], '#111827'],
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.0
            }
          });
        } else {
          // Ensure rotation properties are applied if the layer already exists
          try { map.setLayoutProperty('annotation-text', 'text-rotate', ['coalesce', ['get', 'textRotate'], 0]); } catch (_) {}
          try { map.setLayoutProperty('annotation-text', 'text-rotation-alignment', 'map'); } catch (_) {}
          try { map.setLayoutProperty('annotation-text', 'text-pitch-alignment', 'map'); } catch (_) {}
          try { map.setLayoutProperty('annotation-text', 'text-keep-upright', true); } catch (_) {}
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
  }, [map, derivedAnnotations]);

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
              const next = ['all', base, ['!=', ['get', 'type'], 'arrow']];
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
      if (popup) return popup;
      if (!Ctor) return null;
      try { popup = new Ctor({ closeButton: false, closeOnClick: false, offset: [0, -12] }); } catch (_) { popup = null; }
      return popup;
    };
    const openAt = (lngLat, el) => {
      const p = ensurePopup();
      if (!p || !el) return;
      p.setDOMContent(el);
      p.setLngLat(lngLat);
      p.addTo(map);
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

    const openForFeature = (feature, lngLat) => {
      try {
        try { console.debug('ANNOT: openForFeature', { id: feature?.properties?.sourceId, geomType: feature?.geometry?.type }); } catch (_) {}
        const srcId = feature?.properties?.sourceId;
        if (!srcId) return;
        const isArrow = feature && feature.geometry && feature.geometry.type !== 'Point';
        const getDraw = () => (drawTools && drawTools.draw && drawTools.draw.current) ? drawTools.draw.current : (map && map.getControl ? map.getControl('MapboxDraw') : null);
        const drawCtrl = getDraw();
        if (isArrow) {
          const el = buildPill([
            { label: 'Label…', onClick: () => {
                const val = typeof window !== 'undefined' ? window.prompt('Arrow label') : null;
                if (val != null) { try { drawCtrl && drawCtrl.setFeatureProperty && drawCtrl.setFeatureProperty(srcId, 'label', String(val)); console.debug('ANNOT: set arrow label via draw.setFeatureProperty'); } catch (_) {} setAnnotationsTrigger(v => v + 1); }
              } },
            { label: 'Remove', className: 'text-white rounded-full px-2 py-0.5 bg-red-500 hover:bg-red-600', onClick: () => { try { console.debug('ANNOT: remove clicked for arrow', { srcId, hasDraw: !!drawCtrl }); drawCtrl && drawCtrl.delete && drawCtrl.delete(srcId); } catch (_) {} setAnnotationsTrigger(v => v + 1); } }
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
        }
      } catch (_) {}
    };

    const onDrawUpdateClose = () => {
      try {
        if (popup) {
          try { console.debug('ANNOT: draw.update -> closing popup'); } catch (_) {}
          popup.remove();
        }
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

    return () => {
      try { canvas.removeEventListener('mousedown', onMouseDownCapture, true); } catch (_) {}
      try { canvas.removeEventListener('mouseup', onMouseUpCapture, true); } catch (_) {}
      try { canvas.removeEventListener('click', onClickCapture, true); } catch (_) {}
      try { canvas.removeEventListener('dblclick', onDblClickCapture, true); } catch (_) {}
      try { document.removeEventListener('pointerdown', onDocPointerDownCapture, true); } catch (_) {}
      try { map.off('draw.update', onDrawUpdateClose); } catch (_) {}
      try { if (popup) { console.debug('ANNOT: cleanup removing popup'); popup.remove(); } } catch (_) {}
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

  // Disable double-click zoom when map is loaded to prevent conflicts with permit area selection
  React.useEffect(() => {
    if (mapLoaded && map && map.doubleClickZoom) {
      map.doubleClickZoom.disable();
    }
  }, [mapLoaded, map]);

  // Open text editor on text feature creation anywhere
  useEffect(() => {
    if (!map || !drawTools?.draw?.current) return;
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
    return () => {
      try { map.off('draw.update', bump); } catch (_) {}
      try { map.off('draw.delete', bump); } catch (_) {}
      try { map.off('draw.selectionchange', bump); } catch (_) {}
    };
  }, [map, drawTools]);

  // Listen for rectangle draw completion to convert into dropped object and remove draw feature
  useEffect(() => {
    if (!map || !drawTools?.draw?.current) return;
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

        // Otherwise, if sub-focus mode is armed, treat this polygon as the sub-focus scope
        if (subFocusArmedRef.current && permitAreas?.focusedArea && permitAreas?.setSubFocusPolygon) {
          const ok = permitAreas.setSubFocusPolygon({ type: 'Feature', properties: {}, geometry: f.geometry });
          // Remove the transient draw shape and disarm
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
          // Rotate in screen space to match current POV bearing/pitch
          const newGeom = rotateRectanglePolygonScreen(map, prev.geometry, delta);
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
    clearSelection
  });

  return (
    <div className="flex-1 relative">
      {/* Compass + Projection Toggle Overlay */}
      <div
        className="absolute bottom-4 left-4 z-50 flex flex-row items-end gap-2"
        style={{ pointerEvents: 'none' }}
      >
        <button
          className="bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-full w-12 h-12 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          style={{
            transform: `rotate(${-bearing}deg)`,
            pointerEvents: 'auto',
            transition: 'transform 0.3s cubic-bezier(.4,2,.6,1)' // smooth rotation
          }}
          title="Reset North"
          onClick={handleCompassClick}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="15" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" fill="currentColor" fillOpacity="0.9" className="text-white dark:text-gray-800" />
            <polygon points="16,6 19,18 16,15 13,18" fill="#2563eb" />
            <text x="16" y="26" textAnchor="middle" fontSize="10" fill="#374151" fontWeight="bold">N</text>
          </svg>
        </button>

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
      />


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