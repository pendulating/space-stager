// utils/importUtils.js
import { switchBasemap } from './mapUtils';
import { INITIAL_LAYERS } from '../constants/layers';
import { computeDominantBearingFromPolygon, computeDominantViewportBearing, quantizeBearingForSprites, quantizeAngleTo45 } from './enhancedRenderingUtils';
import { snapCameraBearingToArea } from './bearingUtils';

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
      let appliedSubFocus = false;
      let appliedView = false;

      // Optional destructive confirmation (helpers can override; otherwise prompt)
      try {
        try { helpers.setImportProgress && helpers.setImportProgress('confirm', 'Confirming import…'); } catch (_) {}
        const ok = (typeof helpers.confirmDestructive === 'function')
          ? await helpers.confirmDestructive()
          : (typeof window !== 'undefined' ? window.confirm('Import will discard current work. Continue?') : true);
        if (!ok) return;
      } catch (_) {}

      // Begin rehydration guard and wipe slate clean (optional helper impls)
      try { helpers.setImportProgress && helpers.setImportProgress('confirm', 'Preparing import…'); } catch (_) {}
      try { helpers.setRehydratingImport && helpers.setRehydratingImport(true); } catch (_) {}
      try { helpers.wipeSlate && helpers.wipeSlate(); } catch (_) {}

      // Block interactions during import
      try { if (map && map.scrollZoom && map.scrollZoom.disable) map.scrollZoom.disable(); } catch (_) {}
      try { if (map && map.boxZoom && map.boxZoom.disable) map.boxZoom.disable(); } catch (_) {}
      try { if (map && map.dragPan && map.dragPan.disable) map.dragPan.disable(); } catch (_) {}
      try { if (map && map.dragRotate && map.dragRotate.disable) map.dragRotate.disable(); } catch (_) {}
      try { if (map && map.keyboard && map.keyboard.disable) map.keyboard.disable(); } catch (_) {}
      try { if (map && map.doubleClickZoom && map.doubleClickZoom.disable) map.doubleClickZoom.disable(); } catch (_) {}

      // Restore basemap (best-effort)
      try {
        try { helpers.setImportProgress && helpers.setImportProgress('basemap', 'Switching basemap…'); } catch (_) {}
        const key = isV1 ? (data.basemap?.key || 'arcgis') : 'arcgis';
        await switchBasemap(map, key);
        // Wait for style to fully load before proceeding so subsequent layer logic attaches to the right style
        try {
          await new Promise((resolve) => {
            try {
              if (typeof map.isStyleLoaded === 'function' && map.isStyleLoaded()) resolve();
              else if (map && typeof map.once === 'function') map.once('style.load', resolve);
              else setTimeout(resolve, 0);
            } catch (_) { resolve(); }
          });
        } catch (_) {}
      } catch (_) {}

      // Restore geography and focus (awaited for determinism)
      let parentFocused = false;
      try {
        try { helpers.setImportProgress && helpers.setImportProgress('geography', 'Loading geography…'); } catch (_) {}
        if (isV1 && data.geography?.type && typeof helpers.selectGeography === 'function') {
          helpers.selectGeography(data.geography.type);
        }
      } catch (_) {}
      try {
        try { helpers.setImportProgress && helpers.setImportProgress('focus', 'Focusing permit area…'); } catch (_) {}
        // Ensure permit areas dataset is loaded before identity lookup
        try { if (typeof helpers.waitForPermitAreasLoaded === 'function') await helpers.waitForPermitAreasLoaded(); } catch (_) {}
        if (isV1 && data.focusedArea) {
          const hasIdentity = (data.focusedArea.system != null) || (data.focusedArea.id != null);
          if (hasIdentity && typeof helpers.focusAreaByIdentity === 'function') {
            const ident = { type: data.geography?.type, system: data.focusedArea.system, id: data.focusedArea.id };
            try { parentFocused = (await helpers.focusAreaByIdentity(ident)) === true; } catch (_) { parentFocused = false; }
            // If identity exists, prefer waiting longer rather than falling back immediately,
            // to ensure we restore the exact canonical feature
            if (!parentFocused && typeof helpers.waitForFocus === 'function') {
              try { parentFocused = (await helpers.waitForFocus({ system: data.focusedArea.system, id: data.focusedArea.id })) === true; } catch (_) {}
            }
            // Final fallback: use geometry with the original exported name (if provided)
            if (!parentFocused && data.focusedArea.geometry) {
              // Try to match against canonical dataset via geometry intersection score before synthetic focus
              if (typeof helpers.focusAreaFromGeometryCanonical === 'function') {
                try { parentFocused = (await helpers.focusAreaFromGeometryCanonical(data.focusedArea.geometry)) === true; } catch (_) { parentFocused = false; }
              }
              if (!parentFocused && typeof helpers.focusAreaByGeometry === 'function') {
                const name = data.focusedArea.name || (data.focusedArea.properties && data.focusedArea.properties.name) || undefined;
                try { parentFocused = (await helpers.focusAreaByGeometry(data.focusedArea.geometry, name)) === true; } catch (_) { parentFocused = false; }
              }
            }
          } else if (data.focusedArea.geometry && typeof helpers.focusAreaByGeometry === 'function') {
            const name = data.focusedArea.name || (data.focusedArea.properties && data.focusedArea.properties.name) || undefined;
            try { parentFocused = (await helpers.focusAreaByGeometry(data.focusedArea.geometry, name)) === true; } catch (_) { parentFocused = false; }
          }
        }
      } catch (_) {}

      // Stop any ongoing camera animations before applying new camera moves
      try { if (map && typeof map.stop === 'function') map.stop(); } catch (_) {}

      // Apply sub-focus if provided; else fall back to saved view
      try {
        if (isV1 && data.subFocusArea?.geometry && (typeof helpers.applySubFocus === 'function' || typeof helpers.applySubFocusAsync === 'function')) {
          try { helpers.setImportProgress && helpers.setImportProgress('subfocus', 'Applying sub-area focus…'); } catch (_) {}
          let ok = false;
          if (typeof helpers.applySubFocusAsync === 'function') {
            try { ok = (await helpers.applySubFocusAsync(data.subFocusArea.geometry)) === true; } catch (_) { ok = false; }
            if (ok) {
              appliedSubFocus = true;
              try {
                if (typeof helpers.ensureMinZoom === 'function') {
                  if (typeof helpers.onMoveEndOnce === 'function') helpers.onMoveEndOnce(() => {});
                  helpers.ensureMinZoom(14);
                }
              } catch (_) {}
            }
          } else {
            // The subfocus relies on a focused area; retry briefly until focus is ready
            const maxAttempts = 25; // ~5s at 200ms
            let attempts = 0;
            await new Promise((resolve) => {
              const attempt = () => {
                try {
                  ok = helpers.applySubFocus(data.subFocusArea.geometry) === true;
                  if (ok) {
                    appliedSubFocus = true;
                    try {
                      if (typeof helpers.ensureMinZoom === 'function') {
                        if (typeof helpers.onMoveEndOnce === 'function') helpers.onMoveEndOnce(() => {});
                        helpers.ensureMinZoom(14);
                      }
                    } catch (_) {}
                    if (typeof helpers.onMoveEndOnce === 'function') {
                      helpers.onMoveEndOnce(() => resolve());
                    } else {
                      resolve();
                    }
                    return;
                  }
                } catch (_) {}
                attempts += 1;
                if (attempts < maxAttempts) {
                  setTimeout(attempt, 200);
                } else {
                  resolve();
                }
              };
              attempt();
            });
          }
        } else if (isV1 && data.view) {
          try {
            // Defer view application slightly until focus is ready when possible
            try {
              if (isV1 && data.focusedArea && typeof helpers.waitForFocus === 'function') {
                const sys = (data.focusedArea.system != null) ? data.focusedArea.system : null;
                const id = (data.focusedArea.id != null) ? data.focusedArea.id : null;
                await helpers.waitForFocus({ system: sys, id });
              }
            } catch (_) {}
            appliedView = true;
            if (data.view.center) map.setCenter(data.view.center);
            if (typeof data.view.zoom === 'number') map.setZoom(data.view.zoom);
            // Apply pitch early so it is set even if focus wait is long
            if (typeof data.view.pitch === 'number' && map.setPitch) map.setPitch(data.view.pitch);
            // Defer bearing until focus is confirmed (ensures correct area orientation source)
            if (typeof data.view.bearing === 'number' && map.setBearing) {
              const desiredPitch = (typeof data.view.pitch === 'number') ? data.view.pitch : (typeof map.getPitch === 'function' ? map.getPitch() : 0);
              const areaGeom = (data?.subFocusArea?.geometry) || (data?.focusedArea?.geometry) || null;
              const snapped = snapCameraBearingToArea(data.view.bearing, { map, areaGeom, pitch: desiredPitch, preferRightAngles: false, enforceAbsolute45: true });
              map.setBearing(snapped);
            }
          } catch (_) {}
        }
      } catch (_) {}

      // Restore layers (after style is loaded)
      try {
        try { helpers.setImportProgress && helpers.setImportProgress('layers', 'Restoring layers…'); } catch (_) {}
        if (setLayers && (isV1 ? data.layers : data.layers)) {
          // Sanitize imported layers against known INITIAL_LAYERS
          const importedLayers = data.layers || {};
          const sanitized = Object.keys(INITIAL_LAYERS).reduce((acc, key) => {
            const base = INITIAL_LAYERS[key] || {};
            const fromFile = importedLayers[key] || {};
            const visible = typeof fromFile.visible === 'boolean' ? fromFile.visible : (typeof base.visible === 'boolean' ? base.visible : false);
            acc[key] = {
              ...base,
              // Only visibility is carried from file; states reset to let loaders run
              visible,
              loading: false,
              loaded: false,
              error: null
            };
            return acc;
          }, {});

          // Apply layer state and, after React commits and current style settles, reload any visible infrastructure layers
          setLayers(sanitized);
          try {
            if (helpers.reloadVisibleInfra) {
              // Ensure next microtask after React state commit and style load
              setTimeout(() => {
                try {
                  const run = () => { try { helpers.reloadVisibleInfra(); } catch (_) {} };
                  if (map && typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) {
                    try { map.once('style.load', run); } catch (_) { run(); }
                  } else {
                    run();
                  }
                } catch (_) {}
              }, 0);
            }
          } catch (_) {}
        }
      } catch (_) {}

      // Restore event info
      try {
        if (typeof helpers.setEventInfo === 'function') {
          const info = isV1 ? (data.eventInfo || null) : (data.metadata?.eventInfo || null);
          helpers.setEventInfo(info);
        }
      } catch (_) {}

      // Restore shapes
      try {
        try { helpers.setImportProgress && helpers.setImportProgress('shapes', 'Restoring annotations…'); } catch (_) {}
        const shapes = isV1 ? data.customShapes : (data.customShapes || { type: 'FeatureCollection', features: [] });
        if (shapes && draw?.current?.set) {
          draw.current.set(shapes);
          // Notify annotation system to recompute derived labels (defer until Draw has rendered)
          try {
            // Prefer firing after Draw finishes its render pass
            if (map && typeof map.once === 'function') {
              let fired = false;
              const fire = () => {
                if (fired) return; fired = true;
                try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('annotations:changed')); } catch (_) {}
              };
              try { map.once('draw.render', fire); } catch (_) {}
              // Fallback timers to cover environments where draw.render may not fire
              setTimeout(fire, 50);
              setTimeout(fire, 150);
            } else {
              // Minimal fallback
              setTimeout(() => { try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('annotations:changed')); } catch (_) {} }, 50);
            }

            // Robust readiness poll: wait until Draw reflects expected feature count, then fire change
            try {
              const expected = Array.isArray(shapes?.features) ? shapes.features.length : 0;
              let attempts = 0;
              const maxAttempts = 40; // ~4s @ 100ms
              const poll = () => {
                attempts += 1;
                try {
                  const got = draw?.current?.getAll ? draw.current.getAll() : null;
                  const len = got && Array.isArray(got.features) ? got.features.length : 0;
                  if (len >= expected && expected > 0) {
                    try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('annotations:changed')); } catch (_) {}
                    try { if (map && typeof map.triggerRepaint === 'function') map.triggerRepaint(); } catch (_) {}
                    return;
                  }
                } catch (_) {}
                if (attempts < maxAttempts) setTimeout(poll, 100);
              };
              // Start polling a tick later to let set() settle
              setTimeout(poll, 0);
            } catch (_) {}
          } catch (_) {}
        }
      } catch (_) {}

      // Restore dropped objects (fallback generic type for unknowns)
      try {
        try { helpers.setImportProgress && helpers.setImportProgress('objects', 'Restoring objects…'); } catch (_) {}
        if (setDroppedObjects && (isV1 ? data.droppedObjects : data.droppedObjects)) {
          const list = Array.isArray(data.droppedObjects) ? data.droppedObjects : [];
          const normalized = list.map((o, idx) => {
            const safe = { ...o };
            // Ensure minimal shape
            if (!safe.id) safe.id = `obj-${Date.now()}-${idx}`;
            if (!safe.position && safe.geometry?.type === 'Point' && Array.isArray(safe.geometry.coordinates)) {
              const [lng, lat] = safe.geometry.coordinates;
              safe.position = { lng, lat };
            }
            if (!safe.position && safe.geometry?.type === 'Polygon') {
              try {
                const ring = safe.geometry.coordinates?.[0];
                if (Array.isArray(ring) && ring.length >= 4) {
                  const lng = (ring[0][0] + ring[2][0]) / 2;
                  const lat = (ring[0][1] + ring[2][1]) / 2;
                  safe.position = { lng, lat };
                }
              } catch (_) {}
            }
            if (!safe.type || typeof safe.type !== 'string') {
              safe.type = 'generic-object';
            }
            if (!safe.name) safe.name = 'Object';
            safe.properties = { label: safe.properties?.label || safe.name, ...safe.properties };
            return safe;
          });
          setDroppedObjects(normalized);
        }
      } catch (_) {}

      // Restore map view only if subfocus was not applied and view not already set
      try {
        if (!appliedSubFocus && !appliedView) {
          if (isV1 && data.view) {
            if (data.view.center) map.setCenter(data.view.center);
            if (typeof data.view.zoom === 'number') map.setZoom(data.view.zoom);
            // Apply pitch first
            if (typeof data.view.pitch === 'number' && map.setPitch) map.setPitch(data.view.pitch);
            // Snap imported bearing relative to area orientation and quantize to 45°
            if (typeof data.view.bearing === 'number' && map.setBearing) {
              const desiredPitch = (typeof data.view.pitch === 'number') ? data.view.pitch : (typeof map.getPitch === 'function' ? map.getPitch() : 0);
              const areaGeom = (data?.subFocusArea?.geometry) || (data?.focusedArea?.geometry) || null;
              const snapped = snapCameraBearingToArea(data.view.bearing, { map, areaGeom, pitch: desiredPitch, preferRightAngles: false, enforceAbsolute45: true });
              map.setBearing(snapped);
            }
          } else if (data.metadata) {
            if (data.metadata.center) map.setCenter(data.metadata.center);
            if (typeof data.metadata.zoom === 'number') map.setZoom(data.metadata.zoom);
          }
        }
      } catch (_) {}

      // Final nudge: ensure all derived overlays recompute and the map repaints
      try {
        // Mark import as no longer rehydrating so hooks unblock
        try { helpers.setRehydratingImport && helpers.setRehydratingImport(false); } catch (_) {}
        try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('rehydrating-import:end')); } catch (_) {}
        // Surface finalize step and close modal promptly regardless of slow infra
        try { helpers.setImportProgress && helpers.setImportProgress('finalize', 'Finalizing…'); } catch (_) {}
        try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('annotations:changed')); } catch (_) {}
        // Close after a short delay to let UI repaint once; infra continues loading in background
        try { setTimeout(() => { try { helpers.closeImportProgress && helpers.closeImportProgress(); } catch (_) {} }, 150); } catch (_) {}
      } catch (_) {}
      try { if (map && typeof map.triggerRepaint === 'function') map.triggerRepaint(); } catch (_) {}

      // End rehydration guard (already unset above; keep for redundancy/safety)
      try { helpers.setRehydratingImport && helpers.setRehydratingImport(false); } catch (_) {}
      try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('rehydrating-import:end')); } catch (_) {}

      // Re-enable interactions
      try { if (map && map.scrollZoom && map.scrollZoom.enable) map.scrollZoom.enable(); } catch (_) {}
      try { if (map && map.boxZoom && map.boxZoom.enable) map.boxZoom.enable(); } catch (_) {}
      try { if (map && map.dragPan && map.dragPan.enable) map.dragPan.enable(); } catch (_) {}
      try { if (map && map.dragRotate && map.dragRotate.enable) map.dragRotate.enable(); } catch (_) {}
      try { if (map && map.keyboard && map.keyboard.enable) map.keyboard.enable(); } catch (_) {}
      try { if (map && map.doubleClickZoom && map.doubleClickZoom.enable) map.doubleClickZoom.enable(); } catch (_) {}
      try { helpers.closeImportProgress && helpers.closeImportProgress(); } catch (_) {}
    } catch (error) {
      console.error('Error importing plan:', error);
      alert('Error importing plan. Please check the file format.');
      try { helpers.setRehydratingImport && helpers.setRehydratingImport(false); } catch (_) {}
      // Re-enable interactions on failure as well
      try { if (map && map.scrollZoom && map.scrollZoom.enable) map.scrollZoom.enable(); } catch (_) {}
      try { if (map && map.boxZoom && map.boxZoom.enable) map.boxZoom.enable(); } catch (_) {}
      try { if (map && map.dragPan && map.dragPan.enable) map.dragPan.enable(); } catch (_) {}
      try { if (map && map.dragRotate && map.dragRotate.enable) map.dragRotate.enable(); } catch (_) {}
      try { if (map && map.keyboard && map.keyboard.enable) map.keyboard.enable(); } catch (_) {}
      try { if (map && map.doubleClickZoom && map.doubleClickZoom.enable) map.doubleClickZoom.enable(); } catch (_) {}
      try { helpers.closeImportProgress && helpers.closeImportProgress(); } catch (_) {}
    }
  };
  reader.readAsText(file);
};


