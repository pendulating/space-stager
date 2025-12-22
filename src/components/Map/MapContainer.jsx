// components/Map/MapContainer.jsx
import React, { forwardRef, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import MapTooltip from './MapTooltip';
import ClickPopover from './ClickPopover';
import { useZoneCreator } from '../../hooks/useZoneCreator';
import OverlapSelector from './OverlapSelector';
import DroppedObjects from './DroppedObjects';
import { computeDominantBearingFromPolygon, computeDominantViewportBearing, quantizeToSlices } from '../../utils/enhancedRenderingUtils';
import { computeAreaOrientation, snapBearingRelativeToArea, getCenterOffsetForPitch } from '../../utils/bearingUtils';
import DroppedRectanglesMapLibre from './DroppedRectanglesMapLibre';
import DroppedObjectNoteEditor from './DroppedObjectNoteEditor';
import RectangleDimensionsEditor from './RectangleDimensionsEditor';
import CustomShapeLabels from './CustomShapeLabels';
import NudgeMarkers from './NudgeMarkers';
import ActiveToolIndicator from './ActiveToolIndicator';
import LoadingOverlay from './LoadingOverlay';
import PlacementPreview from './PlacementPreview';
import EdgeMarkers from './EdgeMarkers';
import { useMapViewState } from '../../hooks/useMapViewState';
import { useRotationControls } from '../../hooks/useRotationControls';
import { useCameraRotation } from '../../hooks/useCameraRotation';
import { useSelectionController } from '../../hooks/useSelectionController';
import { useDroppedObjects } from '../../contexts/DroppedObjectsContext';
import { rotateRectanglePolygonMercator, normalizeAngle } from '../../utils/objectGeometry';
import ViewportInset from './ViewportInset';
import { useGlobalKeymap } from '../../hooks/useGlobalKeymap';

const DEBUG = false;

const MapContainer = forwardRef(({ 
  map,
  mapLoaded, 
  styleLoaded,
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
  isLoading,
  responsive,
  isSitePlanMode = false,
  isRightSidebarOpen = false,
  exportOptions
}, ref) => {
  const safeResponsive = responsive || { sidebarMode: 'expanded' };
  const { 
    handleMapMouseMove, 
    handleMapClick, 
    droppedObjects, 
    placementMode, 
    cursorPosition 
  } = clickToPlace;
  const mapContainerRef = useRef(null);
  const [noteEditingObject, setNoteEditingObject] = useState(null);
  const [dimensionsEditingObject, setDimensionsEditingObject] = useState(null);
  const [annotationsTrigger, setAnnotationsTrigger] = useState(0);
  const [rectMovingId, setRectMovingId] = useState(null);
  const subFocusArmedRef = useRef(false);
  const derivedSourceId = 'annotations-derived';
  const arrowIconId = 'annotation-arrowhead';
  const previewSourceId = 'draw-preview';
  const { selectedObjectId, selectedKind, select, clearSelection } = useDroppedObjects();
  const arrowOverlayRef = useRef(null);

  const updateSubFocusCursor = useCallback((isSubFocus) => {
    try {
      if (!map) return;
      const canvas = map.getCanvas();
      const container = map.getContainer();
      if (!canvas && !container) return;
      
      if (isSubFocus) {
        if (container) {
          container.classList.add('mouse-add');
          container.style.cursor = 'crosshair';
          const canvasContainer = container.querySelector('.mapboxgl-canvas-container');
          if (canvasContainer) {
            canvasContainer.style.cursor = 'crosshair';
          }
        }
        if (canvas) {
          canvas.style.cursor = 'crosshair';
        }
      } else {
        if (!placementMode) {
          if (container) {
            container.classList.remove('mouse-add');
            container.style.cursor = '';
            const canvasContainer = container.querySelector('.mapboxgl-canvas-container');
            if (canvasContainer) {
              canvasContainer.style.cursor = '';
            }
          }
          if (canvas) {
            canvas.style.cursor = '';
          }
        }
      }
    } catch (_) {}
  }, [map, placementMode]);

  const view = useMapViewState(map);
  const areaBearingDeg = useMemo(() => {
    try {
      const g = (permitAreas?.hasSubFocus ? permitAreas?.subFocusArea?.geometry : permitAreas?.focusedArea?.geometry);
      if (!g) return 0;
      return computeAreaOrientation({ map, geometry: g, pitch: view?.pitch || 0 });
    } catch (_) { return 0; }
  }, [permitAreas?.focusedArea?.geometry, permitAreas?.subFocusArea?.geometry, permitAreas?.hasSubFocus, view?.pitch, map]);

  const [bearing, setBearing] = useState(0);
  const [pitch, setPitch] = useState(0);

  useZoneCreator(map, 'intersections');

  useEffect(() => {
    try {
      setBearing(view?.bearing || 0);
      setPitch(view?.pitch || 0);
    } catch (_) {}
  }, [view?.bearing, view?.pitch]);

  useEffect(() => {
    const bump = () => setAnnotationsTrigger(v => v + 1);
    window.addEventListener('annotations:changed', bump);
    return () => window.removeEventListener('annotations:changed', bump);
  }, []);

  useEffect(() => {
    const onRectMoveTick = (e) => {
      try {
        const id = e && e.detail && e.detail.id;
        if (id) setRectMovingId(id);
      } catch (_) {}
    };
    const onRectMoveEnd = () => { try { setRectMovingId(null); } catch (_) {} };
    try { window.addEventListener('rect:ui:centroid', onRectMoveTick); } catch (_) {}
    try { window.addEventListener('rect:ui:centroid-end', onRectMoveEnd); } catch (_) {}
    return () => {
      try { window.removeEventListener('rect:ui:centroid', onRectMoveTick); } catch (_) {}
      try { window.removeEventListener('rect:ui:centroid-end', onRectMoveEnd); } catch (_) {}
    };
  }, []);

  useEffect(() => {
    const arm = () => { 
      subFocusArmedRef.current = true;
      updateSubFocusCursor(true);
    };
    const disarm = () => { 
      subFocusArmedRef.current = false;
      updateSubFocusCursor(false);
    };
    window.addEventListener('subfocus:arm', arm);
    window.addEventListener('subfocus:disarm', disarm);
    const apply = (e) => {
      try {
        const geom = e?.detail?.geometry;
        if (!geom || !permitAreas?.focusedArea || !permitAreas?.setSubFocusPolygon) return;
        const ok = permitAreas.setSubFocusPolygon({ type: 'Feature', properties: {}, geometry: geom });
        subFocusArmedRef.current = false;
        updateSubFocusCursor(false);
      } catch (_) {}
    };
    window.addEventListener('subfocus:apply', apply);
    return () => {
      window.removeEventListener('subfocus:arm', arm);
      window.removeEventListener('subfocus:disarm', disarm);
      window.removeEventListener('subfocus:apply', apply);
    };
  }, [updateSubFocusCursor, permitAreas]);

  useEffect(() => {
    if (!map) return;
    const isSubFocusMode = drawTools?.activeTool === 'subfocus' || subFocusArmedRef.current;
    updateSubFocusCursor(isSubFocusMode);
    const onMouseMove = () => {
      const currentIsSubFocus = drawTools?.activeTool === 'subfocus' || subFocusArmedRef.current;
      updateSubFocusCursor(currentIsSubFocus);
    };
    try {
      const container = map.getContainer();
      if (container) {
        container.addEventListener('mousemove', onMouseMove);
      }
    } catch (_) {}
    return () => {
      try {
        const container = map.getContainer();
        if (container) {
          container.removeEventListener('mousemove', onMouseMove);
        }
      } catch (_) {}
      try {
        const canvas = map.getCanvas();
        if (canvas && !placementMode) {
          canvas.style.cursor = '';
        }
      } catch (_) {}
    };
  }, [map, drawTools?.activeTool, placementMode, updateSubFocusCursor]);

  const derivedAnnotations = useMemo(() => {
    try {
      const fc = drawTools?.draw?.current && drawTools.draw.current.getAll ? drawTools.draw.current.getAll() : null;
      const features = fc && Array.isArray(fc.features) ? fc.features : [];
      const shapeLabels = [];
      const arrowheads = [];
      const mapBearing = (() => {
        try { return ((Number(view?.bearing || 0) % 360) + 360) % 360; } catch (_) { return 0; }
      })();
      (features || []).forEach((f) => {
        if (!f || !f.geometry) return;
        const props = f.properties || {};
        if (f.geometry.type === 'LineString') {
          const coords = f.geometry.coordinates || [];
          if (coords.length >= 2) {
            if (props.arrowEnd || props.type === 'arrow') {
              const a = coords[coords.length - 2];
              const b = coords[coords.length - 1];
              const theta = Math.atan2(b[0] - a[0], b[1] - a[1]);
              let bearingDeg = (theta * 180) / Math.PI;
              if (bearingDeg < 0) bearingDeg += 360;
              arrowheads.push({ type: 'Feature', geometry: { type: 'Point', coordinates: b }, properties: { sourceId: f.id, bearing: bearingDeg, size: props.arrowSize || 1 } });
            }
            if (props.arrowStart) {
              const a = coords[1];
              const b = coords[0];
              const theta = Math.atan2(b[0] - a[0], b[1] - a[1]);
              let bearingDeg = (theta * 180) / Math.PI;
              if (bearingDeg < 0) bearingDeg += 360;
              arrowheads.push({ type: 'Feature', geometry: { type: 'Point', coordinates: b }, properties: { sourceId: f.id, bearing: bearingDeg, size: props.arrowSize || 1 } });
            }
            if (typeof props.label === 'string' && props.label.trim()) {
              let mid;
              if (coords.length === 2) {
                mid = [ (coords[0][0] + coords[1][0]) / 2, (coords[0][1] + coords[1][1]) / 2 ];
              } else {
                let sumLng = 0, sumLat = 0;
                coords.forEach(c => { sumLng += c[0]; sumLat += c[1]; });
                mid = [sumLng / coords.length, sumLat / coords.length];
              }
              let textRotate = 0;
              if (props.arrowEnd || props.type === 'arrow') {
                const a = coords[coords.length - 2];
                const b = coords[coords.length - 1];
                const theta = Math.atan2(b[0] - a[0], b[1] - a[1]);
                textRotate = (theta * 180) / Math.PI;
                if (textRotate < 0) textRotate += 360;
                const viewportAngle = ((mapBearing + textRotate) % 360 + 360) % 360;
                if (viewportAngle > 90 && viewportAngle < 270) textRotate = (textRotate + 180) % 360;
              } else {
                textRotate = (mapBearing > 90 && mapBearing < 270) ? 180 : 0;
              }
              shapeLabels.push({ type: 'Feature', geometry: { type: 'Point', coordinates: mid }, properties: { sourceId: f.id, label: props.label, textSize: props.textSize || 14, textColor: props.textColor || '#111827', halo: props.halo !== false, textRotate } });
            }
          }
          return;
        }
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
      return { type: 'FeatureCollection', features: [...shapeLabels, ...arrowheads] };
    } catch (_) { return { type: 'FeatureCollection', features: [] }; }
  }, [drawTools?.draw?.current, clickToPlace.objectUpdateTrigger, annotationsTrigger, view?.renderTick]);

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
        const tipX = size * 0.5;
        const tipY = size * 0.2;
        const arm = size * 0.28;
        const spread = arm * 0.7;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(tipX - spread, tipY + arm); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(tipX + spread, tipY + arm); ctx.stroke();
        const data = ctx.getImageData(0,0,size,size);
        if (map.addImage) map.addImage(arrowIconId, data, { pixelRatio: 2 });
      } catch (e) {
        console.warn('Failed to register arrow icon', e);
      }
    };
    try {
      const ready = (typeof map.isStyleLoaded === 'function') ? map.isStyleLoaded() : true;
      if (ready) register(); else map.once('style.load', register);
    } catch (_) { register(); }
    const onStyleLoad = () => register();
    map.on('style.load', onStyleLoad);
    const onMissing = (e) => { try { if (e && e.id === arrowIconId) register(); } catch (_) {} };
    map.on('styleimagemissing', onMissing);
    return () => {
      try { map.off('style.load', onStyleLoad); } catch (_) {}
      try { map.off('styleimagemissing', onMissing); } catch (_) {}
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    try {
      if (selectedKind === 'point') {
        try {
          const hs = map.getSource && map.getSource('dropped-rectangles-handles');
          if (hs && hs.setData) hs.setData({ type: 'FeatureCollection', features: [] });
        } catch (_) {}
        try {
          const rs = map.getSource && map.getSource('dropped-rectangles');
          const fc = rs && rs._data;
          if (rs && fc && Array.isArray(fc.features)) {
            const next = { type: 'FeatureCollection', features: fc.features.map(f => ({ ...f, properties: { ...(f.properties || {}), selected: false } })) };
            rs.setData(next);
          }
        } catch (_) {}
      } else if (selectedKind === 'rect') {
        try {
          if (map.getLayer && map.getLayer('dropped-objects-selected')) {
            map.setFilter('dropped-objects-selected', ['==', ['get', 'id'], '__none__']);
          }
        } catch (_) {}
      }
    } catch (_) {}
  }, [map, selectedKind]);

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
        let insertBeforeId;
        try {
          const style = map.getStyle ? map.getStyle() : null;
          const firstDrawLayer = style && Array.isArray(style.layers)
            ? style.layers.find(l => typeof l.id === 'string' && (l.id.startsWith('mapbox-gl-draw') || l.id.startsWith('gl-draw')))
            : null;
          insertBeforeId = firstDrawLayer ? firstDrawLayer.id : undefined;
        } catch (_) {}
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
              'text-offset': ['literal', [0, -1.0]],
              'text-anchor': 'bottom',
              'text-rotate': 0,
              'text-rotation-alignment': 'viewport',
              'text-pitch-alignment': 'viewport',
              'text-keep-upright': true,
              'text-allow-overlap': true,
              'text-ignore-placement': true
            },
            paint: {
              'text-color': ['coalesce', ['get', 'textColor'], '#111827'],
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.0,
              'text-opacity': 0
            }
          }, insertBeforeId);
        } else {
          try { map.setLayoutProperty('annotation-text', 'text-rotate', 0); } catch (_) {}
          try { map.setLayoutProperty('annotation-text', 'text-rotation-alignment', 'viewport'); } catch (_) {}
          try { map.setLayoutProperty('annotation-text', 'text-pitch-alignment', 'viewport'); } catch (_) {}
          try { map.setLayoutProperty('annotation-text', 'text-keep-upright', true); } catch (_) {}
          try { map.setLayoutProperty('annotation-text', 'text-allow-overlap', true); } catch (_) {}
          try { map.setLayoutProperty('annotation-text', 'text-ignore-placement', true); } catch (_) {}
          try { map.setPaintProperty('annotation-text', 'text-opacity', 0); } catch (_) {}
        }
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
    try { setTimeout(() => { try { ensure(); } catch (_) {} }, 100); } catch (_) {}
  }, [map, derivedAnnotations]);

  const domAnnotationLabels = useMemo(() => {
    try {
      if (!map || !derivedAnnotations || !Array.isArray(derivedAnnotations.features)) return [];
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

  useEffect(() => {
    if (!map) return;
    const bringToTop = (id) => {
      try { if (map.getLayer(id)) map.moveLayer(id); } catch (_) {}
    };
    const styleDrawLayers = () => {
      try {
        const style = map.getStyle && map.getStyle();
        const layers = (style && style.layers) ? style.layers : [];
        layers.forEach((l) => {
          if (!l || !l.id || !l.source) return;
          const isDrawSource = l.source === 'mapbox-gl-draw-cold' || l.source === 'mapbox-gl-draw-hot';
          if (!isDrawSource) return;
          if (l.type === 'circle' || (typeof l.id === 'string' && (l.id.includes('point') || l.id.includes('point-stroke')))) {
            try { 
              map.setPaintProperty(l.id, 'circle-opacity', 1);
              map.setPaintProperty(l.id, 'circle-stroke-opacity', 1);
            } catch (_) {}
          } 
        });
      } catch (_) {}
    };
    const t = setTimeout(() => {
      bringToTop('annotation-text');
      bringToTop('annotation-arrowheads');
      styleDrawLayers();
    }, 50);
    return () => clearTimeout(t);
  }, [map, drawTools?.draw, derivedAnnotations]);

  useEffect(() => {
    if (!map) return;
    const rerun = () => {
      try {
        const style = map.getStyle && map.getStyle();
        if (!style) return;
        setTimeout(() => {
          try {
            const layers = style.layers || [];
            layers.forEach((l) => {
              if (!l || !l.id || !l.source) return;
              const isDrawSource = l.source === 'mapbox-gl-draw-cold' || l.source === 'mapbox-gl-draw-hot';
              if (!isDrawSource) return;
              if (l.type === 'circle' || (typeof l.id === 'string' && (l.id.includes('point') || l.id.includes('point-stroke')))) {
                try { 
                  map.setPaintProperty(l.id, 'circle-opacity', 1);
                  map.setPaintProperty(l.id, 'circle-stroke-opacity', 1);
                } catch (_) {}
              } 
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

  useEffect(() => {
    try {
      window.__app = Object.assign({}, window.__app || {}, {
        drawMode: drawTools?.draw?.current?.getMode ? drawTools.draw.current.getMode() : null,
        activeRectId: drawTools?.activeRectObjectTypeId || null,
        map,
        mapEl: map && map.getContainer ? map.getContainer() : null,
        mapContainer: mapContainerRef?.current || null,
        infrastructureData: infrastructure?.infrastructureData || null,
        edgeMarkersCategories: Array.isArray(infrastructure?.edgeMarkerCategories)
          ? infrastructure.edgeMarkerCategories
          : null
      });
    } catch (_) {}
  }, [drawTools, infrastructure]);

  const handleCompassClick = () => {
    if (map && map.rotateTo) {
      map.rotateTo(0, { duration: 500 });
    }
  };

  const handleToggleProjection = () => {
    if (!map) return;
    const currentCenter = map.getCenter ? map.getCenter() : null;
    const currentZoom = map.getZoom ? map.getZoom() : undefined;
    const isIso = (map.getPitch ? map.getPitch() : 0) > 15;
    const currentBearing = (map.getBearing ? map.getBearing() : 0) || 0;
    if (isIso) {
      try { map.easeTo({ pitch: 0, bearing: currentBearing, center: currentCenter || undefined, zoom: currentZoom, duration: 600 }); } catch (_) {}
    } else {
      try { map.easeTo({ pitch: 60, bearing: currentBearing, center: currentCenter || undefined, zoom: currentZoom, duration: 600 }); } catch (_) {}
    }
  };

  useCameraRotation({
    map,
    getAreaGeometry: () => (permitAreas?.hasSubFocus ? permitAreas?.subFocusArea?.geometry : permitAreas?.focusedArea?.geometry) || null,
    isEnabled: true
  });

  useGlobalKeymap([
    {
      key: ['Delete', 'Backspace'],
      preventDefault: true,
      stop: true,
      priority: 80,
      enabled: () => {
        try {
          if (placementMode) return false;
          const ae = typeof document !== 'undefined' ? document.activeElement : null;
          if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return false;
        } catch (_) {}
        return true;
      },
      onEvent: () => {
        try {
          const id = selectedObjectId;
          if (id) {
            if (selectedKind === 'rect') {
              try { clickToPlace.removeDroppedObject(id); } catch (_) {}
              try { clearSelection(); } catch (_) {}
              return;
            }
            if (selectedKind === 'point') {
              try { clickToPlace.removeDroppedObject(id); } catch (_) {}
              try { clearSelection(); } catch (_) {}
              return;
            }
          }
          try {
            const selId = drawTools && drawTools.selectedShape;
            if (selId && drawTools && typeof drawTools.deleteSelectedShape === 'function') {
              drawTools.deleteSelectedShape();
            }
          } catch (_) {}
        } catch (_) {}
      }
    }
  ]);

  React.useEffect(() => {
    if (mapLoaded && map && map.doubleClickZoom) {
      map.doubleClickZoom.disable();
    }
  }, [mapLoaded, map]);

  useEffect(() => {
    if (!map) return;
    const onCreateAny = (e) => { setAnnotationsTrigger(v => v + 1); };
    map.on('draw.create', onCreateAny);
    return () => { try { map.off('draw.create', onCreateAny); } catch (_) {} };
  }, [map, drawTools]);

  useEffect(() => {
    if (!map || !drawTools?.draw?.current) return;
    const bump = () => setAnnotationsTrigger(v => v + 1);
    map.on('draw.update', bump);
    map.on('draw.delete', bump);
    map.on('draw.selectionchange', bump);
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

  useEffect(() => {
    if (!map) return;
    const onCreate = (e) => {
      try {
        const f = e?.features?.[0];
        if (!f || f.geometry?.type !== 'Polygon') return;
        const typeId = f.properties?.user_rectObjectType;
        if (typeId) {
          const objectType = placeableObjects?.find(p => p.id === typeId);
          if (!objectType) return;
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
        if (subFocusArmedRef.current && !typeId && permitAreas?.focusedArea && permitAreas?.setSubFocusPolygon) {
          const ok = permitAreas.setSubFocusPolygon({ type: 'Feature', properties: {}, geometry: f.geometry });
          try { drawTools.draw.current.delete(f.id); } catch (_) {}
          subFocusArmedRef.current = false;
          if (ok) return;
        }
        setAnnotationsTrigger(v => v + 1);
      } catch (err) {
        console.warn('Failed to convert rect feature to dropped object', err);
      }
    };
    map.on('draw.create', onCreate);
    return () => { try { map.off('draw.create', onCreate); } catch (_) {} };
  }, [map, drawTools, placeableObjects, clickToPlace, permitAreas]);

  const { handleClick: handleSelectionClick } = useSelectionController({
    map,
    placeableObjects,
    droppedObjects: clickToPlace.droppedObjects || [],
    isPlacementActive: !!clickToPlace.placementMode,
    setSelectedRectId: (id) => select(id, 'rect'),
    setSelectedPointId: (id) => select(id, 'point')
  });

  useEffect(() => {
    if (!map) return;
    const onBackgroundClick = (e) => {
      try {
        if (placementMode) return;
        try { if (e && (e.defaultPrevented || (e.originalEvent && e.originalEvent.defaultPrevented))) return; } catch (_) {}
        const layerIds = [];
        try { if (map.getLayer && map.getLayer('dropped-objects-symbol')) layerIds.push('dropped-objects-symbol'); } catch (_) {}
        try { if (map.getLayer && map.getLayer('dropped-objects-circle')) layerIds.push('dropped-objects-circle'); } catch (_) {}
        try { if (map.getLayer && map.getLayer('dropped-objects-selected')) layerIds.push('dropped-objects-selected'); } catch (_) {}
        try { if (map.getLayer && map.getLayer('dropped-rectangles-fill')) layerIds.push('dropped-rectangles-fill'); } catch (_) {}
        try { if (map.getLayer && map.getLayer('dropped-rectangles-pattern')) layerIds.push('dropped-rectangles-pattern'); } catch (_) {}
        try { if (map.getLayer && map.getLayer('dropped-rectangles-line')) layerIds.push('dropped-rectangles-line'); } catch (_) {}
        try { if (map.getLayer && map.getLayer('dropped-rectangles-handles')) layerIds.push('dropped-rectangles-handles'); } catch (_) {}
        const hits = (map.queryRenderedFeatures && typeof e?.point !== 'undefined') ? map.queryRenderedFeatures(e.point, { layers: layerIds }) : [];
        if (!hits || hits.length === 0) { clearSelection(); }
      } catch (_) {}
    };
    try { map.on('click', onBackgroundClick); } catch (_) {}
    return () => { try { map.off('click', onBackgroundClick); } catch (_) {} };
  }, [map, placementMode, clearSelection]);

  useRotationControls({
    map,
    isPlacementActive: !!placementMode,
    rotatePlacementStep: clickToPlace.rotatePlacementModeBy,
    hasSelectedRect: selectedKind === 'rect' && !!selectedObjectId,
    rotateSelectedRectBy: (delta) => {
      try {
        const id = selectedObjectId;
        clickToPlace.updateDroppedObject(id, (prev) => {
          if (!prev || prev?.geometry?.type !== 'Polygon') return prev;
          const newGeom = rotateRectanglePolygonMercator(prev.geometry, delta);
          const curRot = Number(prev?.properties?.rotationDeg || 0);
          let nextRot = normalizeAngle(curRot + delta);
          return { ...prev, geometry: newGeom, properties: Object.assign({}, prev.properties || {}, { rotationDeg: nextRot }) };
        });
      } catch (_) {}
    },
    hasSelectedPoint: selectedKind === 'point' && !!selectedObjectId,
    rotateSelectedPointBy: (deltaDeg) => {
      try {
        const id = selectedObjectId;
        clickToPlace.updateDroppedObject(id, (prev) => {
          if (!prev) return prev;
          const cur = Number(prev?.properties?.rotationDeg || 0);
          let next = normalizeAngle(cur + deltaDeg);
          const nextProps = Object.assign({}, prev.properties || {}, { rotationDeg: next });
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
        const R = 6378137;
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
        const coordsAll = (g.type === 'LineString') ? g.coordinates : (g.type === 'Polygon') ? (g.coordinates[0] || []) : null;
        if (!Array.isArray(coordsAll) || coordsAll.length < 2) return;
        const mercPts = coordsAll.map(toMerc);
        let cx = 0, cy = 0;
        mercPts.forEach(([x, y]) => { cx += x; cy += y; });
        cx /= mercPts.length; cy /= mercPts.length;
        const rad = deltaDeg * Math.PI / 180;
        const cos = Math.cos(rad); const sin = Math.sin(rad);
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
    <div className="flex-1 relative transition-all duration-300 ease-in-out">
      <div className="absolute bottom-4 left-4 z-50 flex flex-row items-end gap-2" style={{ pointerEvents: 'none' }}>
        <button className="bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-full w-12 h-12 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform" style={{ pointerEvents: 'auto' }} title="Reset to North (0°)" onClick={handleCompassClick}>
          <div style={{ transform: `rotate(${-bearing}deg)`, transition: 'transform 0.3s cubic-bezier(.4,2,.6,1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="15" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" fill="currentColor" fillOpacity="0.9" className="text-white dark:text-gray-800" />
              <polygon points="16,6 19,18 16,15 13,18" fill="#2563eb" />
              <text x="16" y="26" textAnchor="middle" fontSize="10" fill="#374151" fontWeight="bold">N</text>
            </svg>
          </div>
        </button>
        <button className="bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-full w-12 h-12 flex items-center justify-center hover:scale-105 active:scale-95" style={{ pointerEvents: 'auto' }} title="Toggle projection (Top-down / Isometric)" onClick={handleToggleProjection}>
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{(pitch > 15) ? 'ISO' : '2D'}</span>
        </button>
      </div>
      
      <ActiveToolIndicator activeTool={activeTool} />
      {isLoading && <LoadingOverlay />}
      <ViewportInset map={map} focusedArea={focusedArea} isRightSidebarOpen={isRightSidebarOpen} />
      <div ref={ref} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
      <div className={`absolute inset-0 ${placementMode ? 'cursor-crosshair' : ''}`} style={{ width: '100%', height: '100%', pointerEvents: placementMode ? 'auto' : 'none' }} onMouseMove={handleMapMouseMove} onClick={(e) => {
          try { if (e && (e.defaultPrevented || (e.nativeEvent && e.nativeEvent.defaultPrevented))) return; if (e && e.cancelBubble) return; } catch (_) {}
          try { handleMapClick(e); } catch (_) {}
          try { if (e && (e.defaultPrevented || (e.nativeEvent && e.nativeEvent.defaultPrevented))) return; if (e && e.cancelBubble) return; } catch (_) {}
          if (!placementMode) { handleSelectionClick(e); }
        }}
      />
      
      <DroppedObjects objects={droppedObjects} placeableObjects={placeableObjects} map={map} onRemoveObject={clickToPlace.removeDroppedObject} objectUpdateTrigger={clickToPlace.objectUpdateTrigger} onEditNote={(obj) => setNoteEditingObject(obj)} isNoteEditing={!!noteEditingObject} selectedId={selectedKind === 'point' ? selectedObjectId : null} onSelectObject={(obj) => {
          try {
            const t = placeableObjects.find(p => p.id === obj.type);
            if (t?.geometryType === 'rect') { select(obj.id, 'rect'); } else { select(obj.id, 'point'); }
          } catch (_) {}
        }} onMoveObject={(id, lng, lat) => {
          try { clickToPlace.updateDroppedObject(id, (prev) => { if (!prev) return prev; return { ...prev, position: { lng, lat } }; }); } catch (_) {}
        }} areaBearingDeg={areaBearingDeg}
      />

      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 60 }}>
        {domAnnotationLabels.map((l) => (
          <div key={l.id} style={{ position: 'absolute', left: l.x, top: l.y, transform: 'translate(-50%, -100%)', fontSize: `${l.size}px`, color: l.color, textShadow: l.halo ? '0 0 2px #fff, 0 0 2px #fff' : undefined, fontWeight: 700, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            {l.label}
          </div>
        ))}
      </div>

      {noteEditingObject && (
        <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
          <div className="absolute inset-0" style={{ pointerEvents: 'auto' }} onWheel={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} />
          <DroppedObjectNoteEditor map={map} object={noteEditingObject} objectUpdateTrigger={clickToPlace.objectUpdateTrigger} onSave={(text) => { clickToPlace.setDroppedObjectNote(noteEditingObject.id, text); setNoteEditingObject(null); }} onCancel={() => setNoteEditingObject(null)} />
        </div>
      )}

      {dimensionsEditingObject && (
        <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
          <div className="absolute inset-0" style={{ pointerEvents: 'auto' }} onWheel={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} />
          <RectangleDimensionsEditor map={map} object={dimensionsEditingObject} placeableObjects={placeableObjects} objectUpdateTrigger={clickToPlace.objectUpdateTrigger} onSave={(widthMeters, heightMeters) => {
              try {
                clickToPlace.updateDroppedObject(dimensionsEditingObject.id, (prev) => {
                  if (!prev || prev?.geometry?.type !== 'Polygon') return prev;
                  const ring = prev?.geometry?.coordinates?.[0] || [];
                  if (ring.length < 4) return prev;
                  const centroid = prev.position || { lng: (ring[0][0] + ring[2][0]) / 2, lat: (ring[0][1] + ring[2][1]) / 2 };
                  const rotationDeg = Number(prev?.properties?.rotationDeg || 0);
                  const R = 6378137;
                  const toMerc = (lng, lat) => { const x = R * (lng * Math.PI / 180); const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)); return { x, y }; };
                  const toLngLat = (x, y) => { const lng = (x / R) * 180 / Math.PI; const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI; return [lng, lat]; };
                  const center = toMerc(centroid.lng, centroid.lat);
                  const halfW = widthMeters / 2; const halfH = heightMeters / 2;
                  const rad = (rotationDeg * Math.PI) / 180;
                  const cos = Math.cos(rad); const sin = Math.sin(rad);
                  const corners = [[-halfW, -halfH], [halfW, -halfH], [halfW, halfH], [-halfW, halfH]].map(([dx, dy]) => {
                    const rx = dx * cos - dy * sin; const ry = dx * sin + dy * cos;
                    return toLngLat(center.x + rx, center.y + ry);
                  });
                  const newGeom = { type: 'Polygon', coordinates: [[...corners, corners[0]]] };
                  return { ...prev, geometry: newGeom, properties: { ...prev.properties, dimensions: { width: widthMeters, height: heightMeters } } };
                });
              } catch (err) { console.error('Failed to update rectangle dimensions:', err); }
              setDimensionsEditingObject(null);
            }} onCancel={() => setDimensionsEditingObject(null)} />
        </div>
      )}
      
      <PlacementPreview placementMode={placementMode} cursorPosition={cursorPosition} placeableObjects={placeableObjects} map={map} />
      <NudgeMarkers nudges={nudges} map={map} objectUpdateTrigger={clickToPlace.objectUpdateTrigger} onDismiss={onDismissNudge} highlightedIds={highlightedIds} />
      <EdgeMarkers map={map} infrastructureData={infrastructure?.infrastructureData} categories={infrastructure?.edgeMarkerCategories} />
      {!mapLoaded && <LoadingOverlay />}
      {drawTools?.activeTool && <ActiveToolIndicator tool={drawTools.activeTool} />}
      {!drawTools?.activeTool && !permitAreas.clickedTooltip?.visible && ( <MapTooltip tooltip={permitAreas.tooltip} /> )}
      {permitAreas.clickedTooltip?.visible && ( <ClickPopover tooltip={permitAreas.clickedTooltip} stats={permitAreas.clickedTooltip.stats} distributions={permitAreas.clickedTooltip.distributions} geometry={permitAreas.clickedTooltip.geometry} dimensionUnits={exportOptions?.dimensionUnits || 'ft'} onClose={permitAreas.dismissClickedTooltip} onFocus={permitAreas.focusClickedTooltipArea} /> )}
      {permitAreas.showOverlapSelector && ( <OverlapSelector overlappingAreas={permitAreas.overlappingAreas} selectedIndex={permitAreas.selectedOverlapIndex} clickPosition={permitAreas.clickPosition} onSelect={permitAreas.selectOverlappingArea} onClose={permitAreas.clearOverlapSelector} /> )}
      
      {selectedKind === 'rect' && selectedObjectId && map && rectMovingId !== selectedObjectId && (() => {
        const rect = droppedObjects.find(o => o.id === selectedObjectId);
        if (!rect || !rect.geometry?.coordinates?.[0] || rect.geometry.coordinates[0].length < 4) return null;
        const ring = rect.geometry.coordinates[0];
        const centroid = [(ring[0][0] + ring[2][0]) / 2, (ring[0][1] + ring[2][1]) / 2];
        try {
          const screenPos = map.project(centroid);
          return (
            <div className="absolute flex gap-1 z-50 pointer-events-auto" style={{ left: screenPos.x, top: screenPos.y - 40, transform: 'translateX(-50%)' }}>
              <button type="button" className="bg-white/90 dark:bg-gray-900/80 border border-gray-300 dark:border-gray-700 rounded-full px-2 py-1 text-[10px] shadow hover:bg-white" title="Edit dimensions (D)" onClick={(e) => { e.stopPropagation(); setDimensionsEditingObject(rect); }}>Edit</button>
              <button type="button" className="bg-red-500 text-white rounded-full px-2 py-1 shadow text-[10px] hover:bg-red-600" title="Delete (Delete key)" onClick={(e) => { e.stopPropagation(); clickToPlace.removeDroppedObject(rect.id); clearSelection(); }}>✕</button>
            </div>
          );
        } catch (_) { return null; }
      })()}
      
      {map && (
        <DroppedRectanglesMapLibre objects={droppedObjects} placeableObjects={placeableObjects} map={map} objectUpdateTrigger={clickToPlace.objectUpdateTrigger} selectedId={selectedKind === 'rect' ? selectedObjectId : null} isPlacementActive={!!placementMode} onSelectRect={(id) => select(id, 'rect')} onResizeRect={(id, newGeom) => {
          try {
            clickToPlace.updateDroppedObject(id, (prev) => {
              if (!prev) return prev;
              let dims = prev?.properties?.dimensions || prev?.properties?.user_dimensions_m || {};
              try {
                const ring = Array.isArray(newGeom?.coordinates?.[0]) ? newGeom.coordinates[0] : [];
                if (ring.length >= 4) {
                  const dist = (p, q) => { const R = 6378137; const toRad = (d) => d * Math.PI / 180; const dLat = toRad(q[1] - p[1]); const dLon = toRad(q[0] - p[0]); const lat1 = toRad(p[1]); const lat2 = toRad(q[1]); const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(s))); };
                  dims = { width: dist(ring[0], ring[1]), height: dist(ring[1], ring[2]) };
                }
              } catch (_) {}
              return { ...prev, geometry: newGeom, properties: { ...prev.properties, dimensions: dims } };
            }, true);
          } catch (_) {}
          }} onMoveRect={(id, newGeom) => {
          try {
            clickToPlace.updateDroppedObject(id, (prev) => {
              if (!prev) return prev;
              const ring = Array.isArray(newGeom?.coordinates?.[0]) ? newGeom.coordinates[0] : [];
              const centroid = ring.length >= 4 ? { lng: (ring[0][0] + ring[2][0]) / 2, lat: (ring[0][1] + ring[2][1]) / 2 } : prev.position;
              return { ...prev, geometry: newGeom, position: centroid };
            }, true);
          } catch (_) {}
          }}
        />
      )}
      <ViewportInset map={map} mapLoaded={mapLoaded} permitAreas={permitAreas} responsive={safeResponsive} isSitePlanMode={isSitePlanMode} isRightSidebarOpen={isRightSidebarOpen} />
    </div>
  );
});

MapContainer.displayName = 'MapContainer';

export default MapContainer;