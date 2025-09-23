import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { Popup as MapLibrePopup } from 'maplibre-gl';
import { quantizeAngleTo45, quantizeToSlices, addEnhancedSpritesToMap, buildSpriteImageId, getMapViewType, buildFlatSpriteUrl } from '../../utils/enhancedRenderingUtils';
import { getCenterOffsetForPitch, quantizeBearingForView, normalizeAngle } from '../../utils/bearingUtils';
import { ensureViewportAlignedSymbols } from '../../utils/mapLayerUtils';
import { useMapViewState } from '../../hooks/useMapViewState';
import { useStableImageSrc } from '../../hooks/useStableImageSrc';
import { getCandidateSrcs, prefetchView } from '../../utils/spriteResolver';
import { useMapEvents } from '../../hooks/useMapEvents';
import { X } from 'lucide-react';
import { useDroppedObjects } from '../../contexts/DroppedObjectsContext';

const DEBUG = false; // Set to true to enable DroppedObjects debug logs
// Dev-only, namespaced logger with dynamic switches (env/localStorage/window flag)
const DEV = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE !== 'production')
  || (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production');
const shouldDebug = () => {
  if (!DEV) return false;
  try {
    // Allow multiple switches:
    // 1) Hardcoded DEBUG constant
    if (DEBUG) return true;
    // 2) Vite env var VITE_DEBUG_DROPPED_OBJECTS
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const v = import.meta.env.VITE_DEBUG_DROPPED_OBJECTS;
      if (v === '1' || v === 'true') return true;
    }
    // 3) Window flag (flip at runtime without reload)
    if (typeof window !== 'undefined') {
      if (window.__DEBUG_DROPPED_OBJECTS__ === true) return true;
      if (window.DEBUG_DROPPED_OBJECTS === true) return true; // alias
    }
    // 4) localStorage flags
    if (typeof window !== 'undefined' && window.localStorage) {
      const ls = window.localStorage;
      if (ls.getItem('debug:dropped-objects') === '1') return true;
      const debugNamespaces = (ls.getItem('debug') || '').split(',').map(s => s.trim());
      if (debugNamespaces.includes('dropped-objects')) return true;
    }
  } catch (_) {}
  return false;
};
const debug = {
  log(...args) {
    if (shouldDebug()) console.debug('[DroppedObjects]', ...args);
  },
  group(label, fn) {
    if (!shouldDebug()) return;
    console.groupCollapsed(`[DroppedObjects] ${label}`);
    try { if (typeof fn === 'function') fn(); } finally { console.groupEnd(); }
  },
  error(...args) {
    if (shouldDebug()) console.error('[DroppedObjects]', ...args);
  }
};

// Default per-view zero-angle calibration (degrees). Adjust if assets differ.
// Use 0° for top-down so enriched icon angles align exactly with snapped camera.
const DEFAULT_ZERO_OFFSET_BY_VIEW = { 'isometric': -90, 'top-down': 0 };
const USE_DOM_OVERLAY = false;
const DROPPED_SOURCE_ID = 'dropped-objects';
const DROPPED_SYMBOL_LAYER_ID = 'dropped-objects-symbol';
const DROPPED_CIRCLE_LAYER_ID = 'dropped-objects-circle';
const DROPPED_SELECTED_LAYER_ID = 'dropped-objects-selected';
const DROPPED_HOVERED_LAYER_ID = 'dropped-objects-hovered';

const DroppedObjects = ({ 
  objects = [],
  placeableObjects = [],
  map, 
  objectUpdateTrigger, 
  onRemoveObject,
  onEditNote,
  isNoteEditing,
  selectedId,
  onSelectObject,
  onMoveObject,
  areaBearingDeg
}) => {
  if (shouldDebug()) {
    // Light-weight render marker; disable by default
    // debug.log('render', { count: objects.length, hasMap: !!map });
  }

  const view = useMapViewState(map);
  const { hoveredObjectId } = useDroppedObjects();

  // Single popup instance for click-to-open action menu
  const popupRef = React.useRef(null);
  const dragArmedIdRef = React.useRef(null);
  // Maintain the last FeatureCollection we set on the source for fast in-place coordinate updates during drag
  const dataRef = React.useRef({ fc: null, idToIndex: new Map() });
  // RAF-driven drag updater to avoid spamming setData beyond screen refresh rate
  const rafIdRef = React.useRef(null);
  const pendingDragRef = React.useRef(null); // { id, lng, lat }
  const ensurePopup = () => {
    if (popupRef.current) return popupRef.current;
    try {
      const Ctor = MapLibrePopup || (typeof window !== 'undefined' && (window.maplibregl || window.mapboxgl)?.Popup);
      if (!Ctor) return null;
      popupRef.current = new Ctor({ closeButton: false, closeOnClick: true, offset: [0, -20] });
    } catch (_) { popupRef.current = null; }
    return popupRef.current;
  };
  const buildActionPopupContent = (obj) => {
    try {
      const wrap = document.createElement('div');
      wrap.className = 'pointer-events-auto';
      const container = document.createElement('div');
      container.className = 'rounded-full px-2 py-1 text-[11px] shadow-sm flex gap-1 bg-white/90 dark:bg-gray-900/80 border border-gray-200/60 dark:border-gray-700/60';
      // Enter transition
      container.style.transform = 'translateY(4px) scale(0.97)';
      container.style.opacity = '0';
      container.style.transition = 'opacity 140ms ease, transform 160ms cubic-bezier(.2,.7,.3,1)';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.title = 'Edit note';
      editBtn.textContent = 'Edit';
      editBtn.className = 'px-2 py-0.5 rounded-full border border-gray-300/70 dark:border-gray-700 text-gray-700 dark:text-gray-200 bg-white/70 dark:bg-gray-800/50 hover:bg-white/90';
      editBtn.onclick = (e) => {
        e.stopPropagation();
        if (typeof onEditNote === 'function') onEditNote(obj);
        try {
          // Exit transition before remove
          container.style.transform = 'translateY(4px) scale(0.97)';
          container.style.opacity = '0';
          setTimeout(() => { try { popupRef.current && popupRef.current.remove(); } catch (_) {} }, 160);
        } catch (_) {}
      };

      const rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.title = 'Remove';
      rmBtn.textContent = '✕';
      rmBtn.className = 'text-white rounded-full px-2 py-0.5 bg-red-500 hover:bg-red-600';
      rmBtn.onclick = (e) => {
        e.stopPropagation();
        if (typeof onRemoveObject === 'function') onRemoveObject(obj.id);
        try {
          container.style.transform = 'translateY(4px) scale(0.97)';
          container.style.opacity = '0';
          setTimeout(() => { try { popupRef.current && popupRef.current.remove(); } catch (_) {} }, 160);
        } catch (_) {}
      };

      container.appendChild(editBtn);
      container.appendChild(rmBtn);
      wrap.appendChild(container);

      // Trigger appear on next frame
      requestAnimationFrame(() => {
        container.style.transform = 'translateY(0) scale(1)';
        container.style.opacity = '1';
      });

      return wrap;
    } catch (_) { return null; }
  };

  const defaultColorFor = useCallback((objectType) => objectType?.color || '#64748b', []);

  // Prefetch present enhanced sprites for current view to avoid broken initial srcs
  useEffect(() => {
    if (shouldDebug()) {
      debug.log('mounted');
      return () => debug.log('unmounted');
    }
  }, []);

  useEffect(() => {
    try {
      if (!objects?.length || !placeableObjects?.length) return;
      debug.group('prefetch sprites', () => {
        debug.log('deps', { objectsCount: objects?.length || 0, placeableCount: placeableObjects?.length || 0, viewType: view?.viewType });
      });
      const baseToAngles = new Map();
      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        const t = placeableObjects.find(p => p.id === obj.type);
        if (!t?.enhancedRendering?.enabled || !t.enhancedRendering?.spriteBase) continue;
        const base = t.enhancedRendering.spriteBase;
        const angle = quantizeAngleTo45(typeof obj?.properties?.rotationDeg === 'number' ? obj.properties.rotationDeg : 0);
        if (!baseToAngles.has(base)) baseToAngles.set(base, new Set());
        baseToAngles.get(base).add(angle);
      }
      baseToAngles.forEach((angles, base) => {
        prefetchView(base, Array.from(angles), view?.viewType);
      });
    } catch (_) {}
  }, [objects, placeableObjects, view?.viewType]);

  

  const [spritesReadyNonce, setSpritesReadyNonce] = useState(0);
  // Preload only the exact angles needed for current view and objects, then rebuild
  useEffect(() => {
    if (!map || !objects?.length || !placeableObjects?.length) return;
    (async () => {
      try {
        const vt = view?.viewType || getMapViewType(map);
        const bearingRaw = (typeof view?.bearing === 'number') ? view.bearing : (typeof map?.getBearing === 'function' ? map.getBearing() : 0);
        const baseToAngles = new Map();
        for (let i = 0; i < objects.length; i++) {
          const obj = objects[i];
          const t = placeableObjects.find(p => p.id === obj.type);
          if (!t?.enhancedRendering?.enabled || !t.enhancedRendering?.spriteBase) continue;
          const base = t.enhancedRendering.spriteBase;
          const zeroOffset = (t?.enhancedRendering?.zeroOffsetDegByView?.[vt])
            ?? (t?.enhancedRendering?.zeroOffsetDeg)
            ?? DEFAULT_ZERO_OFFSET_BY_VIEW[vt] ?? 0;
          const baseAngle = typeof obj?.properties?.rotationDeg === 'number' ? obj.properties.rotationDeg : 0;
          // Snap camera bearing relative to area with view-dependent center offset (matches infra)
          const p = (map?.getPitch ? map.getPitch() : 0);
          const camQ = quantizeBearingForView(bearingRaw, p);
          const eff = (((baseAngle + zeroOffset - camQ) % 360) + 360) % 360;
          const q = quantizeAngleTo45(eff);
          if (!baseToAngles.has(base)) baseToAngles.set(base, new Set());
          baseToAngles.get(base).add(q);
        }
        const promises = [];
        baseToAngles.forEach((anglesSet, base) => {
          const angles = Array.from(anglesSet);
          promises.push(addEnhancedSpritesToMap(map, {
            baseName: base,
            publicDir: `/static/${base}`,
            angles,
            viewType: vt,
            urlBuilder: buildFlatSpriteUrl,
            replaceExisting: true
          }));
        });
        if (promises.length) {
          await Promise.all(promises);
          try { setSpritesReadyNonce(n => n + 1); } catch (_) {}
        }
      } catch (_) {}
    })();
  }, [map, objects, placeableObjects, view?.viewType, view?.bearing, areaBearingDeg]);

  // Build and set GeoJSON data for dropped objects (define before effects that use it)
  const rebuildDroppedData = useCallback(() => {
    if (!map) return;
    const src = (map && typeof map.getSource === 'function') ? map.getSource(DROPPED_SOURCE_ID) : null;
    if (!src || typeof src.setData !== 'function') return;
    try {
      const vt = view?.viewType || getMapViewType(map);
      const bearingRaw = (typeof view?.bearing === 'number') ? view.bearing : (typeof map?.getBearing === 'function' ? map.getBearing() : 0);
      // Capture previous icon assignments so we can persist the old icon until the new angle is ready
      const prevIconById = new Map();
      try {
        const prev = dataRef.current && dataRef.current.fc;
        if (prev && Array.isArray(prev.features)) {
          for (let i = 0; i < prev.features.length; i++) {
            const f = prev.features[i];
            const pid = f && f.properties && f.properties.id;
            const picon = f && f.properties && f.properties.icon_image;
            if (pid && picon) prevIconById.set(pid, picon);
          }
        }
      } catch (_) {}
      const feats = [];
      const byId = new Map();
      const idToIndex = new Map();
      for (let i = 0; i < (objects || []).length; i++) {
        const obj = objects[i];
        if (!obj) continue;
        const t = placeableObjects.find(p => p.id === obj.type);
        if (!t) continue;
        if (t.geometryType === 'rect') continue;
        byId.set(obj.id, obj);
        const baseSize = Math.max(t.size?.width || 24, t.size?.height || 24, 24);
        const props = { id: obj.id, type: t.id, color: t.color || '#64748b', baseSize };
        if (t?.enhancedRendering?.enabled && t.enhancedRendering?.spriteBase) {
          const zeroOffset = (t?.enhancedRendering?.zeroOffsetDegByView?.[vt])
            ?? (t?.enhancedRendering?.zeroOffsetDeg)
            ?? DEFAULT_ZERO_OFFSET_BY_VIEW[vt] ?? 0;
          const baseAngle = typeof obj?.properties?.rotationDeg === 'number' ? obj.properties.rotationDeg : 0;
          const p = (map?.getPitch ? map.getPitch() : 0);
          const isTopDown = (vt === 'top-down');
          if (isTopDown) {
            // Continuous rotation in 2D: use 0° sprite and rotate via icon-rotate
            const imgId = buildSpriteImageId(t.enhancedRendering.spriteBase, 0);
            let ready = false;
            try { ready = map && typeof map.hasImage === 'function' ? map.hasImage(imgId) : false; } catch (_) { ready = false; }
            props.icon_ready = ready ? 1 : 0;
            if (ready) {
              props.icon_image = imgId;
            } else {
              const prevIcon = prevIconById.get(obj.id);
              if (prevIcon) props.icon_image = prevIcon;
            }
            // Align with 22.5°-centered camera grid in 2D as well
            props.icon_rotate = normalizeAngle(baseAngle - bearingRaw + 22.5);
          } else {
            // Isometric: stepped 45° sprites relative to snapped camera
            const camQ = quantizeBearingForView(bearingRaw, p);
            const eff = (((baseAngle + zeroOffset - camQ) % 360 + 360) % 360);
            const q = quantizeAngleTo45(eff);
            const imgId = buildSpriteImageId(t.enhancedRendering.spriteBase, q);
            let ready = false;
            try { ready = map && typeof map.hasImage === 'function' ? map.hasImage(imgId) : false; } catch (_) { ready = false; }
            props.icon_ready = ready ? 1 : 0;
            if (ready) {
              props.icon_image = imgId;
            } else {
              const prevIcon = prevIconById.get(obj.id);
              if (prevIcon) props.icon_image = prevIcon;
            }
            props.icon_rotate = 0;
          }
        } else if (t?.imageUrl) {
          // Simple (non-enhanced) static icon path: use type id as image id
          const imgId = String(t.id);
          let ready = false;
          try { ready = map && typeof map.hasImage === 'function' ? map.hasImage(imgId) : false; } catch (_) { ready = false; }
          props.icon_ready = ready ? 1 : 0;
          if (ready) {
            props.icon_image = imgId;
          } else {
            const prevIcon = prevIconById.get(obj.id);
            if (prevIcon) props.icon_image = prevIcon;
          }
        }
        const feature = { type: 'Feature', id: obj.id, geometry: { type: 'Point', coordinates: [obj.position.lng, obj.position.lat] }, properties: props };
        idToIndex.set(obj.id, feats.length);
        feats.push(feature);
      }
      const fc = { type: 'FeatureCollection', features: feats };
      src.setData(fc);
      (map.__droppedObjectsIndex = map.__droppedObjectsIndex || new Map());
      map.__droppedObjectsIndex.clear();
      byId.forEach((v, k) => map.__droppedObjectsIndex.set(k, v));
      // Cache the FC and indices for fast drag updates without triggering React state
      dataRef.current = { fc, idToIndex };
    } catch (_) {}
  }, [map, objects, placeableObjects, view?.viewType, view?.bearing, areaBearingDeg]);

  // After import rehydration finishes, rebuild once to ensure icons match snapped camera
  useEffect(() => {
    const handler = () => { try { rebuildDroppedData(); } catch (_) {} };
    try { if (typeof window !== 'undefined') window.addEventListener('rehydrating-import:end', handler); } catch (_) {}
    return () => { try { if (typeof window !== 'undefined') window.removeEventListener('rehydrating-import:end', handler); } catch (_) {} };
  }, [rebuildDroppedData]);

  // Ensure GeoJSON source and layers exist
  useEffect(() => {
    if (!map) return;
    const ensure = () => {
      try {
        if (!map.getSource(DROPPED_SOURCE_ID)) {
          map.addSource(DROPPED_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        }
        // Ensure a default placeholder icon exists to avoid flicker while images load
        try {
          const phId = 'default-placeholder';
          let has = false;
          try { has = map.hasImage && map.hasImage(phId); } catch (_) { has = false; }
          if (!has) {
            const size = 32;
            const c = document.createElement('canvas');
            c.width = size; c.height = size;
            const ctx = c.getContext('2d');
            ctx.clearRect(0,0,size,size);
            const r = Math.floor(size * 0.35);
            ctx.beginPath();
            ctx.arc(size/2, size/2, r, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.fill();
            ctx.lineWidth = Math.max(1, Math.floor(size * 0.06));
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.stroke();
            map.addImage(phId, c, { pixelRatio: 2 });
          }
        } catch (_) {}
        if (!map.getLayer(DROPPED_SYMBOL_LAYER_ID)) {
          map.addLayer({
            id: DROPPED_SYMBOL_LAYER_ID,
            type: 'symbol',
            source: DROPPED_SOURCE_ID,
            filter: ['has', 'icon_image'],
            layout: {
              // Use placeholder while real image registers
              'icon-image': ['coalesce', ['get', 'icon_image'], 'default-placeholder'],
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'icon-anchor': 'center',
              // Ensure symbols do not rotate with map; we swap sprites ourselves on bearing changes
              'icon-rotation-alignment': 'viewport',
              'icon-pitch-alignment': 'viewport',
              // Scale sprite bitmap to desired pixel diameter based on baseSize and zoom.
              // Assumes sprite bitmaps are ~512px. Diameter targets: baseSize*0.6 @ z12 → baseSize*1.6 @ z18, with 0.9 inset.
              'icon-size': [
                'interpolate', ['linear'], ['zoom'],
                12, ['/', ['*', ['coalesce', ['get','baseSize'], 24], 0.54], 512],
                18, ['/', ['*', ['coalesce', ['get','baseSize'], 24], 1.44], 512]
              ]
            },
            paint: {
              // Only show icon when property present; otherwise 0 so circle fallback shows
              'icon-opacity': ['case', ['has', 'icon_image'], 1, 0]
            }
          });
        }
        if (!map.getLayer(DROPPED_CIRCLE_LAYER_ID)) {
          map.addLayer({
            id: DROPPED_CIRCLE_LAYER_ID,
            type: 'circle',
            source: DROPPED_SOURCE_ID,
            // Only show when no icon_image property is set
            filter: ['!', ['has', 'icon_image']],
            paint: {
              'circle-color': 'rgba(0,0,0,0)',
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, ['*', ['coalesce', ['get','baseSize'], 24], 0.3], 18, ['*', ['coalesce', ['get','baseSize'], 24], 0.8]],
              'circle-stroke-color': 'rgba(0,0,0,0.15)',
              'circle-stroke-width': 1,
              // Hide circle when icon is present
              'circle-opacity': 1
            }
          });
        }
        if (!map.getLayer(DROPPED_SELECTED_LAYER_ID)) {
          map.addLayer({
            id: DROPPED_SELECTED_LAYER_ID,
            type: 'circle',
            source: DROPPED_SOURCE_ID,
            filter: ['==', ['get', 'id'], ''],
            paint: {
              'circle-color': 'rgba(0,0,0,0)',
              // Fixed, highly visible ring across zooms
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 18, 18, 28],
              'circle-stroke-color': '#2563eb',
              'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12, 2, 18, 3],
              'circle-stroke-opacity': 1
            }
          });
        }
        if (!map.getLayer(DROPPED_HOVERED_LAYER_ID)) {
          map.addLayer({
            id: DROPPED_HOVERED_LAYER_ID,
            type: 'circle',
            source: DROPPED_SOURCE_ID,
            // Show only features whose feature-state hovered === true
            filter: ['==', ['feature-state', 'hovered'], true],
            paint: {
              'circle-color': 'rgba(0,0,0,0)',
              'circle-stroke-color': '#f59e0b',
              'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12, 2, 18, 3],
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                12, ['+', 16, ['*', 4, ['coalesce', ['feature-state', 'hoverProgress'], 0]]],
                18, ['+', 24, ['*', 6, ['coalesce', ['feature-state', 'hoverProgress'], 0]]]
              ],
              'circle-stroke-opacity': 1
            }
          });
        }
        // Enforce filters even if layers already existed
        try { map.setFilter(DROPPED_SYMBOL_LAYER_ID, ['has', 'icon_image']); } catch (_) {}
        try { map.setFilter(DROPPED_CIRCLE_LAYER_ID, ['!', ['has', 'icon_image']]); } catch (_) {}
        // Enforce viewport alignment so icons do not rotate with map bearing/pitch; bind rotate
        try { ensureViewportAlignedSymbols(map, [DROPPED_SYMBOL_LAYER_ID]); } catch (_) {}
        try { map.setLayoutProperty(DROPPED_SYMBOL_LAYER_ID, 'icon-rotate', ['coalesce', ['get', 'icon_rotate'], 0]); } catch (_) {}
        // Revert to existing anchor/offset defaults
        try { map.setLayoutProperty(DROPPED_SYMBOL_LAYER_ID, 'icon-anchor', 'center'); } catch (_) {}
        try { map.setLayoutProperty(DROPPED_SYMBOL_LAYER_ID, 'icon-offset', [0, 0]); } catch (_) {}
        if (!map.getLayer(DROPPED_SELECTED_LAYER_ID)) {
          map.addLayer({
            id: DROPPED_SELECTED_LAYER_ID,
            type: 'circle',
            source: DROPPED_SOURCE_ID,
            filter: ['==', ['get', 'id'], ''],
            paint: {
              'circle-color': 'rgba(37,99,235,0.20)',
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 18, 18, 28],
              'circle-stroke-color': '#2563eb',
              'circle-stroke-width': 2
            }
          });
        }
        // Enforce z-order: circle below symbol, selected above all
        try { if (map.getLayer(DROPPED_SYMBOL_LAYER_ID)) map.moveLayer(DROPPED_CIRCLE_LAYER_ID, DROPPED_SYMBOL_LAYER_ID); } catch (_) {}
        try { map.moveLayer(DROPPED_SELECTED_LAYER_ID); } catch (_) {}
        try { map.moveLayer(DROPPED_HOVERED_LAYER_ID); } catch (_) {}
        // Repeat shortly after to win races with late-added layers (draw/infrastructure)
        setTimeout(() => {
          try { if (map.getLayer(DROPPED_SYMBOL_LAYER_ID)) map.moveLayer(DROPPED_CIRCLE_LAYER_ID, DROPPED_SYMBOL_LAYER_ID); } catch (_) {}
          try { map.moveLayer(DROPPED_SELECTED_LAYER_ID); } catch (_) {}
          try { map.moveLayer(DROPPED_HOVERED_LAYER_ID); } catch (_) {}
        }, 50);
        // After ensuring layers, push current data (defer to rebuild)
        try { setTimeout(() => { try { rebuildDroppedData(); } catch (_) {} }, 0); } catch (_) {}
      } catch (_) {}
    };
    const ready = typeof map.isStyleLoaded === 'function' ? map.isStyleLoaded() : true;
    if (ready) ensure(); else map.once('style.load', ensure);
  }, [map, rebuildDroppedData]);

  // Update source data based on objects/view
  useEffect(() => { rebuildDroppedData(); }, [rebuildDroppedData]);
  // Rebuild once sprites are registered for current view
  useEffect(() => { if (spritesReadyNonce) rebuildDroppedData(); }, [spritesReadyNonce, rebuildDroppedData]);
  useEffect(() => {
    // Rebuild when view changes (type/bearing) or area orientation changes
    rebuildDroppedData();
  }, [view?.viewType, view?.bearing, areaBearingDeg]);

  // Register on-demand missing image handler to load sprites if requested by style before preloading finishes
  useEffect(() => {
    if (!map) return;
    const onMissing = async (e) => {
      try {
        const id = e && e.id;
        if (!id || typeof id !== 'string') return;
        const parts = id.split('_');
        const vt = view?.viewType || getMapViewType(map);
        if (parts.length >= 2) {
          // Enhanced family: register only the requested angle to minimize churn
          const base = parts[0];
          let angle = 0;
          try { angle = parseInt(parts[1], 10); if (!isFinite(angle)) angle = 0; } catch (_) { angle = 0; }
          await addEnhancedSpritesToMap(map, {
            baseName: base,
            publicDir: `/static/${base}`,
            angles: [angle],
            viewType: vt,
            urlBuilder: buildFlatSpriteUrl,
            replaceExisting: true
          });
        } else {
          // Non-enhanced: id is type id; add its imageUrl
          try {
            const t = (placeableObjects || []).find(p => String(p.id) === id);
            const url = t?.imageUrl;
            if (url) {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              await new Promise((resolve) => {
                img.onload = () => { try { map.addImage(id, img); } catch (_) {} resolve(true); };
                img.onerror = () => resolve(false);
                img.src = url;
              });
            }
          } catch (_) {}
        }
        // Rebuild source to update icon_ready flags
        setTimeout(() => { try { rebuildDroppedData(); } catch (_) {} }, 0);
      } catch (_) {}
    };
    try { map.on('styleimagemissing', onMissing); } catch (_) {}
    return () => { try { map.off('styleimagemissing', onMissing); } catch (_) {} };
  }, [map, view?.viewType, rebuildDroppedData]);

  // Update selection highlight filter
  useEffect(() => {
    if (!map) return;
    try {
      const filter = selectedId ? ['==', ['get', 'id'], selectedId] : ['==', ['get', 'id'], '__none__'];
      if (map.getLayer(DROPPED_SELECTED_LAYER_ID)) map.setFilter(DROPPED_SELECTED_LAYER_ID, filter);
    } catch (_) {}
  }, [map, selectedId]);

  // Hover feature-state driver with tweened hoverProgress
  useEffect(() => {
    if (!map) return;
    let raf = null;
    let start = null;
    let prevId = null;
    const sourceId = DROPPED_SOURCE_ID;
    const durationMs = 150;
    const setStateSafe = (id, kv) => {
      try { if (!id) return; map.setFeatureState({ source: sourceId, id }, kv); } catch (_) {}
    };
    const animate = (from, to) => {
      start = null;
      const step = (t) => {
        try {
          if (start == null) start = t;
          const elapsed = Math.min(durationMs, Math.max(0, t - start));
          const p = durationMs === 0 ? to : (from + (to - from) * (elapsed / durationMs));
          if (hoveredObjectId) setStateSafe(hoveredObjectId, { hoverProgress: p });
          if (elapsed < durationMs) { raf = requestAnimationFrame(step); } else { raf = null; }
        } catch (_) { raf = null; }
      };
      raf = requestAnimationFrame(step);
    };

    // Clear previous hovered id state
    if (typeof hoveredObjectId !== 'string' && typeof hoveredObjectId !== 'number') {
      // Animate any previously hovered id back to 0 then clear the flag on all features opportunistically
      try {
        // Best-effort: we don't track prevId across renders; do nothing
      } catch (_) {}
    }

    // Strategy: toggle hovered flag and tween progress
    const apply = () => {
      // First, clear hovered flag for all by setting false on selectedId if different and previous id (best-effort)
      if (prevId && prevId !== hoveredObjectId) {
        setStateSafe(prevId, { hovered: false, hoverProgress: 0 });
      }
      if (!hoveredObjectId) { prevId = null; return; }
      setStateSafe(hoveredObjectId, { hovered: true });
      animate(0, 1);
      prevId = hoveredObjectId;
    };

    apply();

    const onStyleLoad = () => apply();
    try { map.on('style.load', onStyleLoad); } catch (_) {}
    return () => {
      try { if (raf) cancelAnimationFrame(raf); } catch (_) {}
      try { if (prevId) setStateSafe(prevId, { hovered: false, hoverProgress: 0 }); } catch (_) {}
      try { map.off('style.load', onStyleLoad); } catch (_) {}
    };
  }, [map, hoveredObjectId]);

  // Close action popup when selection cleared or selected object removed
  useEffect(() => {
    try {
      const p = popupRef.current;
      if (!p) return;
      if (!selectedId) { try { p.remove(); } catch (_) {} return; }
      const exists = Array.isArray(objects) && objects.some((o) => o && o.id === selectedId);
      if (!exists) { try { p.remove(); } catch (_) {} }
    } catch (_) {}
  }, [selectedId, objects]);

  // Interactions: click to select, drag to move (centralized via useMapEvents)
  const onSelectRef = React.useRef(onSelectObject);
  const onMoveRef = React.useRef(onMoveObject);
  useEffect(() => { onSelectRef.current = onSelectObject; }, [onSelectObject]);
  useEffect(() => { onMoveRef.current = onMoveObject; }, [onMoveObject]);
  const handleLayerClick = React.useCallback((e) => {
    try {
      // Prevent other click handlers from clearing selection
      try {
        if (e && e.preventDefault) e.preventDefault();
        const oe = e && (e.originalEvent || e.srcEvent || e.point && e.point.originalEvent);
        if (oe) { if (typeof oe.stopPropagation === 'function') oe.stopPropagation(); oe.cancelBubble = true; }
      } catch (_) {}
      const f = e?.features?.[0];
      const id = f?.properties?.id;
      if (!id) return;
      const obj = map && map.__droppedObjectsIndex ? map.__droppedObjectsIndex.get(id) : null;
      if (!obj) return;
      // Select via callback
      if (typeof onSelectRef.current === 'function') onSelectRef.current(obj);
      // Ensure keyboard handlers receive events (for rotation , and .)
      try {
        const canvas = map && map.getCanvas ? map.getCanvas() : null;
        if (canvas && typeof canvas.setAttribute === 'function') canvas.setAttribute('tabindex', '0');
        if (canvas && typeof canvas.focus === 'function') canvas.focus();
      } catch (_) {}
      // Arm dragging for this id for a short time window
      dragArmedIdRef.current = id;
      try { setTimeout(() => { if (dragArmedIdRef.current === id) dragArmedIdRef.current = null; }, 1500); } catch (_) {}
      // Open action popup at object
      try {
        const p = ensurePopup();
        if (p) {
          const content = buildActionPopupContent(obj);
          if (content) {
            p.setDOMContent(content);
            p.setLngLat([obj.position.lng, obj.position.lat]);
            p.addTo(map);
            // Strip default popup chrome/background
            try {
              const el = p.getElement && p.getElement();
              if (el) {
                el.style.background = 'transparent';
                el.style.border = 'none';
                el.style.boxShadow = 'none';
                const contentEl = el.querySelector('.maplibregl-popup-content, .mapboxgl-popup-content');
                if (contentEl) {
                  contentEl.style.background = 'transparent';
                  contentEl.style.border = 'none';
                  contentEl.style.boxShadow = 'none';
                  contentEl.style.padding = '0';
                }
                const tipEl = el.querySelector('.maplibregl-popup-tip, .mapboxgl-popup-tip');
                if (tipEl) tipEl.style.display = 'none';
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    } catch (_) {}
  }, [map]);
  const startDragLayer = React.useCallback((e) => {
    try {
      const f = e?.features?.[0];
      const id = f?.properties?.id;
      if (!id || !onMoveRef.current) return;
      // Only allow dragging when the object is selected, or was just armed by a click
      const canDrag = (selectedId && id === selectedId) || dragArmedIdRef.current === id;
      if (!canDrag) return;
      // Clear arming now that dragging begins
      dragArmedIdRef.current = null;
      // Close any open action popup on drag start
      try { if (popupRef.current) popupRef.current.remove(); } catch (_) {}
      e.preventDefault && e.preventDefault();
      try { map && map.dragPan && map.dragPan.disable && map.dragPan.disable(); } catch (_) {}
      let moving = true;
      const container = map && map.getContainer ? map.getContainer() : null;
      const rect = container && container.getBoundingClientRect ? container.getBoundingClientRect() : { left: 0, top: 0 };

      // Per-frame updater to apply latest pending coords to the source only once per RAF tick
      const tick = () => {
        try {
          const pending = pendingDragRef.current;
          if (!moving || !pending || !pending.id || pending.id !== id) { rafIdRef.current = null; return; }
          const src = map && map.getSource ? map.getSource(DROPPED_SOURCE_ID) : null;
          const cache = dataRef.current;
          if (src && cache && cache.fc && cache.idToIndex && cache.idToIndex.has(id)) {
            const idx = cache.idToIndex.get(id);
            const feat = cache.fc.features[idx];
            if (feat && feat.geometry && Array.isArray(feat.geometry.coordinates)) {
              feat.geometry.coordinates = [pending.lng, pending.lat];
              try { src.setData(cache.fc); } catch (_) {}
            }
          }
          rafIdRef.current = requestAnimationFrame(tick);
        } catch (_) { rafIdRef.current = null; }
      };
      const ensureTick = () => {
        if (!rafIdRef.current) rafIdRef.current = requestAnimationFrame(tick);
      };

      const onMoveWin = (ev) => {
        if (!moving) return;
        try {
          const x = ev.clientX - rect.left;
          const y = ev.clientY - rect.top;
          if (map && typeof map.unproject === 'function') {
            const ll = map.unproject([x, y]);
            pendingDragRef.current = { id, lng: ll.lng, lat: ll.lat };
            ensureTick();
          }
        } catch (_) {}
      };
      const onUpWin = (ev) => {
        ev && ev.preventDefault && ev.preventDefault();
        moving = false;
        window.removeEventListener('mousemove', onMoveWin);
        window.removeEventListener('mouseup', onUpWin);
        try { if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; } } catch (_) {}
        // Commit final position to React state once
        try {
          const last = pendingDragRef.current;
          pendingDragRef.current = null;
          if (last && last.id === id && onMoveRef.current) {
            onMoveRef.current(id, last.lng, last.lat);
          }
        } catch (_) {}
        try { map && map.dragPan && map.dragPan.enable && map.dragPan.enable(); } catch (_) {}
      };
      window.addEventListener('mousemove', onMoveWin);
      window.addEventListener('mouseup', onUpWin, { once: true });
    } catch (_) {}
  }, [map, selectedId]);
  const cursorPointerOn = React.useCallback(() => {
    try { map && map.getCanvas && (map.getCanvas().style.cursor = 'pointer'); } catch (_) {}
  }, [map]);
  const cursorPointerOff = React.useCallback(() => {
    try { map && map.getCanvas && (map.getCanvas().style.cursor = ''); } catch (_) {}
  }, [map]);
  useMapEvents(map, [
    { event: 'click', layerId: DROPPED_SYMBOL_LAYER_ID, handler: handleLayerClick },
    { event: 'click', layerId: DROPPED_CIRCLE_LAYER_ID, handler: handleLayerClick },
    { event: 'mousedown', layerId: DROPPED_SYMBOL_LAYER_ID, handler: startDragLayer },
    { event: 'mousedown', layerId: DROPPED_CIRCLE_LAYER_ID, handler: startDragLayer },
    { event: 'mouseenter', layerId: DROPPED_SYMBOL_LAYER_ID, handler: cursorPointerOn },
    { event: 'mouseenter', layerId: DROPPED_CIRCLE_LAYER_ID, handler: cursorPointerOn },
    { event: 'mouseleave', layerId: DROPPED_SYMBOL_LAYER_ID, handler: cursorPointerOff },
    { event: 'mouseleave', layerId: DROPPED_CIRCLE_LAYER_ID, handler: cursorPointerOff }
  ], { reattachOnStyleLoad: true });

  // Hover popup removed; click handler opens popup.

  // Log view state changes for diagnosing geometry issues when switching modes
  useEffect(() => {
    if (!shouldDebug()) return;
    debug.group('view state', () => {
      debug.log('view', {
        viewType: view?.viewType,
        bearing: view?.bearing,
        zoom: view?.zoom,
        renderTick: view?.renderTick
      });
    });
  }, [view?.viewType, view?.bearing, view?.zoom, view?.renderTick]);

  // Test effect to see if we can manually trigger updates
  useEffect(() => {
    if (!map || !objects.length) return;
    debug.group('effect(map, objects, objectUpdateTrigger)', () => {
      debug.log('deps', [!!map, objects.length, objectUpdateTrigger]);
      debug.log('triggered', { objectUpdateTrigger });
    });
    
    // Test the map project function
    if (objects.length > 0) {
      const testObj = objects[0];
      try {
        const pixel = map.project([testObj.position.lng, testObj.position.lat]);
        debug.log('projection ok', { pixel });
      } catch (error) {
        debug.error('projection failed', error);
      }
    }
  }, [map, objects, objectUpdateTrigger]);

  // Detect and log newly placed objects by ID
  const seenIdsRef = React.useRef(new Set());
  useEffect(() => {
    if (!shouldDebug()) return;
    try {
      const seen = seenIdsRef.current;
      const newOnes = Array.isArray(objects) ? objects.filter(o => o && !seen.has(o.id)) : [];
      if (newOnes.length) {
        debug.group(`objects placed (+${newOnes.length})`, () => {
          newOnes.forEach(o => {
            debug.log('placed', {
              id: o.id,
              type: o.type,
              position: o.position,
              properties: o.properties
            });
          });
        });
        newOnes.forEach(o => seen.add(o.id));
      }
    } catch (e) {
      debug.error('error while diffing placed objects', e);
    }
  }, [objects]);

  // Sample a few objects and log their computed geometry when view type changes
  useEffect(() => {
    if (!shouldDebug()) return;
    if (!objects?.length || !map) return;
    try {
      const sample = objects.slice(0, Math.min(3, objects.length));
      debug.group(`geometry sample (${view?.viewType})`, () => {
        sample.forEach((obj) => {
          const objectType = placeableObjects.find(p => p.id === obj.type);
          if (!objectType) return;
          let pixel = null;
          try {
            pixel = map.project([obj.position.lng, obj.position.lat]);
          } catch (_) {}
          const baseAngle = typeof obj?.properties?.rotationDeg === 'number' ? obj.properties.rotationDeg : 0;
          const bearing = typeof view?.bearing === 'number' ? view.bearing : 0;
          const angleForSprite = (view?.viewType === 'isometric')
            ? (((baseAngle - bearing) % 360 + 360) % 360)
            : (((baseAngle) % 360 + 360) % 360);
          const qAngle = quantizeAngleTo45(angleForSprite);
          const style = getObjectStyle(obj);
          debug.log('geom', {
            id: obj.id,
            type: objectType.id,
            lngLat: obj.position,
            pixel,
            viewType: view?.viewType,
            bearing,
            baseAngle,
            angleForSprite,
            qAngle,
            style
          });
        });
      });
    } catch (e) {
      debug.error('geometry sample error', e);
    }
  }, [view?.viewType, objects, placeableObjects, map]);

  // Always call ALL hooks at the top level - never conditionally
  const getObjectStyle = useCallback((object) => {
    const objectType = placeableObjects.find(p => p.id === object.type);
    if (!objectType || !map) {
      return { display: 'none' };
    }
    
    try {
      // Avoid noisy render-path logs; only log errors below
      
      // Compute zoom-based scale so icons shrink when zoomed out and grow when zoomed in
      const zoom = view?.zoom ?? (typeof map.getZoom === 'function' ? map.getZoom() : 16);
      const zoomScale = Math.min(1.6, Math.max(0.6, 0.6 + (zoom - 12) * 0.1));

      // Use the object's defined size or default to 24px, scaled by zoom
      const baseSize = Math.max(objectType.size.width, objectType.size.height, 24);
      const iconSize = baseSize * zoomScale;
      const halfSize = iconSize / 2;
      return {
        position: 'absolute',
        left: 0,
        top: 0,
        width: iconSize,
        height: iconSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        zIndex: 1000,
        pointerEvents: 'auto',
        transform: 'translateZ(0)',
        willChange: 'transform',
        // Minimal styling - just the icon with a subtle background for visibility
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '50%',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        border: '1px solid rgba(0,0,0,0.1)'
      };
    } catch (error) {
      debug.error('getObjectStyle error', error);
      return { display: 'none' };
    }
  }, [placeableObjects, map, objectUpdateTrigger, view?.zoom, view?.viewType]);

  // Render memo driven by view.renderTick for smooth camera-following without remounting
  const debugRef = React.useRef(new Map());
  const elementRefs = React.useRef(new Map());
  const baseSizeByType = useMemo(() => {
    const m = new Map();
    try {
      (placeableObjects || []).forEach((t) => {
        if (!t) return;
        const base = Math.max(t?.size?.width || 24, t?.size?.height || 24, 24);
        m.set(t.id, base);
      });
    } catch (_) {}
    return m;
  }, [placeableObjects]);
  const registerRef = useCallback((id, el) => {
    try {
      const mapRef = elementRefs.current;
      if (el) mapRef.set(id, el); else mapRef.delete(id);
    } catch (_) {}
  }, []);
  const renderedObjects = useMemo(() => {
    const DOM_OVERLAY_ENABLED = USE_DOM_OVERLAY || !map || typeof map.getSource !== 'function';
    if (!DOM_OVERLAY_ENABLED) return [];
    debug.log('recalc rendered objects', { viewType: view?.viewType, renderTick: view?.renderTick, zoom: view?.zoom, trigger: objectUpdateTrigger });
    
    // Now we can do conditional logic inside the memoized value
    if (!objects || !Array.isArray(objects) || objects.length === 0) {
      return [];
    }

    if (!map || typeof map.project !== 'function') {
      return [];
    }
    
    return objects.map((obj) => {
      const objectType = placeableObjects.find(p => p.id === obj.type);
      if (!objectType) return null;
      // Skip rectangle-type objects; rendered by DroppedRectangles overlay
      if (objectType.geometryType === 'rect') return null;
      
      const style = { ...getObjectStyle(obj) };
      if (style.display === 'none') return null;
      
      // Calculate icon size for font sizing
      const baseSize = baseSizeByType.get(objectType.id) || Math.max(objectType.size.width, objectType.size.height, 24);
      const zoom = view?.zoom ?? (typeof map.getZoom === 'function' ? map.getZoom() : 16);
      const zoomScale = Math.min(1.6, Math.max(0.6, 0.6 + (zoom - 12) * 0.1));
      const iconSize = baseSize; // scale applied in render loop via CSS transform
      const fontSize = Math.max((baseSize * zoomScale) * 0.6, 14);
      const baseAngle = typeof obj?.properties?.rotationDeg === 'number' ? obj.properties.rotationDeg : 0;
      const rawBearing = typeof view?.bearing === 'number' ? view.bearing : 0;
      const qBearing = quantizeAngleTo45(rawBearing);
      // Compensate for map bearing so the object doesn't appear to rotate when the map rotates
      const bearing = typeof view?.bearing === 'number' ? view.bearing : 0;
      const zeroOffset = (objectType?.enhancedRendering?.zeroOffsetDegByView?.[view?.viewType])
        ?? (objectType?.enhancedRendering?.zeroOffsetDeg)
        ?? DEFAULT_ZERO_OFFSET_BY_VIEW[view?.viewType] ?? 0;
      const angleForSprite = (((baseAngle - bearing + zeroOffset) % 360 + 360) % 360);
      const qAngle = quantizeAngleTo45(angleForSprite);
      const candidates = getCandidateSrcs(objectType, angleForSprite, view?.viewType);
      if (shouldDebug()) {
        const payload = {
          id: obj.id,
          type: objectType.id,
          viewType: view?.viewType,
          rotationDeg: baseAngle,
          bearing,
          angleForSprite,
          qAngle,
          primary: candidates?.[0],
          zeroOffset
        };
        const sig = `${payload.viewType}|${payload.qAngle}|${payload.primary}`;
        const now = performance.now();
        const entry = debugRef.current.get(obj.id) || {};
        if (entry.sig !== sig || (now - (entry.t || 0)) > 500) {
          debugRef.current.set(obj.id, { sig, t: now });
          debug.log('sprite', payload);
        }
      }
      
      const isSelected = selectedId && obj.id === selectedId;
      const isHovered = hoveredObjectId && obj.id === hoveredObjectId;
      if (isSelected) {
        style.border = '2px solid #2563eb';
        style.boxShadow = '0 0 0 2px rgba(37,99,235,0.35)';
      }
      if (isHovered) {
        style.outline = '2px solid #f59e0b';
        style.outlineOffset = '2px';
      }

      return (
        <PlacedPoint
          key={obj.id}
          style={style}
          fontSize={fontSize}
          iconSize={iconSize}
          flipped={!!obj?.properties?.flipped}
          object={obj}
          objectType={objectType}
          candidates={candidates}
          changeKey={`${view?.viewType || ''}:${qAngle}`}
          onEditNote={onEditNote}
          onRemoveObject={onRemoveObject}
          isNoteEditing={isNoteEditing}
          onSelectObject={onSelectObject}
          onMoveObject={onMoveObject}
          map={map}
          defaultColor={defaultColorFor(objectType)}
          registerRef={registerRef}
        />
      );
    }).filter(Boolean);
  }, [objects, placeableObjects, baseSizeByType, getObjectStyle, onRemoveObject, map, selectedId, hoveredObjectId, onSelectObject, view?.viewType, view?.renderTick, view?.zoom]);

  // Map move-synced DOM positioning with transform-only updates (DOM overlay disabled by default)
  useEffect(() => {
    const DOM_OVERLAY_ENABLED = USE_DOM_OVERLAY || !map || typeof map.getSource !== 'function';
    if (!DOM_OVERLAY_ENABLED) return;
    if (!map || !objects || !objects.length) return;
    const update = () => {
      try {
        const zoom = typeof map.getZoom === 'function' ? map.getZoom() : 16;
        const zoomScale = Math.min(1.6, Math.max(0.6, 0.6 + (zoom - 12) * 0.1));
        const anchorBottom = view?.viewType === 'isometric';
        for (let i = 0; i < objects.length; i++) {
          const obj = objects[i];
          const el = elementRefs.current.get(obj.id);
          if (!el) continue;
          const pixel = map.project([obj.position.lng, obj.position.lat]);
          const translate = `translate(${pixel.x}px, ${pixel.y}px) ${anchorBottom ? 'translate(-50%, -100%)' : 'translate(-50%, -50%)'}`;
          const transform = `${translate} scale(${zoomScale}) translateZ(0)`;
          if (el.__lastTransform !== transform) {
            el.style.transform = transform;
            el.__lastTransform = transform;
          }
        }
      } catch (_) {}
    };
    try { map.on('move', update); } catch (_) {}
    try { map.on('zoom', update); } catch (_) {}
    try { map.on('rotate', update); } catch (_) {}
    try { map.on('pitch', update); } catch (_) {}
    try { map.on('resize', update); } catch (_) {}
    // Initial apply
    update();
    return () => {
      try { map.off('move', update); } catch (_) {}
      try { map.off('zoom', update); } catch (_) {}
      try { map.off('rotate', update); } catch (_) {}
      try { map.off('pitch', update); } catch (_) {}
      try { map.off('resize', update); } catch (_) {}
    };
  }, [map, objects, view?.viewType]);

  // Render DOM overlay if enabled or if map source APIs are unavailable (test env)
  if (USE_DOM_OVERLAY || !map || typeof map.getSource !== 'function') {
    return (
      <div className="pointer-events-none">
        {renderedObjects}
      </div>
    );
  }
  return null;
};

export default DroppedObjects;

const PlacedPoint = ({ style, fontSize, iconSize, flipped, object, objectType, candidates, changeKey, onEditNote, onRemoveObject, isNoteEditing, onSelectObject, onMoveObject, map, defaultColor, registerRef }) => {
  const src = useStableImageSrc(candidates, changeKey);
  const [bg, setBg] = useState(null);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const c = await bgColorFor(src, defaultColor, 0.9);
        if (active) setBg(c);
      } catch (_) {}
    })();
    return () => { active = false; };
  }, [src, defaultColor]);

  const s = { ...style };
  if (bg) s.backgroundColor = bg;

  return (
    <div
      ref={(el) => registerRef && registerRef(object.id, el)}
      style={s}
      title={object.name}
          className="group relative placed-object"
      onClick={(e) => { e.stopPropagation(); if (typeof onSelectObject === 'function') onSelectObject(object); }}
      onMouseDown={(e) => {
        e.stopPropagation();
        if (!onMoveObject) return;
        let moving = true;
        const canvasEl = map && map.getCanvas ? map.getCanvas() : (typeof document !== 'undefined' ? document.querySelector('.mapboxgl-canvas') : null);
        const rect = canvasEl && canvasEl.getBoundingClientRect ? canvasEl.getBoundingClientRect() : { left: 0, top: 0 };
        const onMove = (ev) => {
          if (!moving) return;
          try {
            const x = ev.clientX - rect.left;
            const y = ev.clientY - rect.top;
            if (map && typeof map.unproject === 'function') {
              const ll = map.unproject([x, y]);
              onMoveObject(object.id, ll.lng, ll.lat);
                  }
                } catch (_) {}
        };
        const onUp = (ev) => { ev.preventDefault(); moving = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp, { once: true });
      }}
    >
      {src ? (
        <img
          src={src}
          alt={objectType.name}
          style={{ width: iconSize, height: iconSize, objectFit: 'contain', transform: flipped ? 'scaleX(-1)' : undefined }}
              draggable={false}
            />
          ) : (
            <div 
              style={{ 
                color: objectType.color,
                fontSize: `${fontSize}px`,
                lineHeight: '1',
            transform: flipped ? 'scaleX(-1)' : undefined
              }}
            >
              {objectType.icon}
            </div>
          )}
          
          {!isNoteEditing && (
            <div className="absolute -top-2 right-0 left-0 mx-auto w-max flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                className="bg-white/90 dark:bg-gray-900/80 border border-gray-300 dark:border-gray-700 rounded-full px-2 py-1 text-[10px] shadow"
                title="Edit note"
            onClick={(e) => { e.stopPropagation(); onEditNote && onEditNote(object); }}
              >
                Edit
              </button>
              <button
                type="button"
                className="bg-red-500 text-white rounded-full p-1 shadow"
                title="Remove"
            onClick={(e) => { e.stopPropagation(); onRemoveObject && onRemoveObject(object.id); }}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      );
};
