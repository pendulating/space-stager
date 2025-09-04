// utils/importUtils.js
import { switchBasemap } from './mapUtils';
import { INITIAL_LAYERS } from '../constants/layers';

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
        const ok = (typeof helpers.confirmDestructive === 'function')
          ? await helpers.confirmDestructive()
          : (typeof window !== 'undefined' ? window.confirm('Import will discard current work. Continue?') : true);
        if (!ok) return;
      } catch (_) {}

      // Begin rehydration guard and wipe slate clean (optional helper impls)
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
        if (isV1 && data.focusedArea) {
          const hasIdentity = (data.focusedArea.system != null) || (data.focusedArea.id != null);
          if (hasIdentity && typeof helpers.focusAreaByIdentity === 'function') {
            const ident = { type: data.geography?.type, system: data.focusedArea.system, id: data.focusedArea.id };
            helpers.focusAreaByIdentity(ident);
          } else if (data.focusedArea.geometry && typeof helpers.focusAreaByGeometry === 'function') {
            helpers.focusAreaByGeometry(data.focusedArea.geometry);
          }
        }
      } catch (_) {}

      // Stop any ongoing camera animations before applying new camera moves
      try { if (map && typeof map.stop === 'function') map.stop(); } catch (_) {}

      // Apply sub-focus if provided; else fall back to saved view
      try {
        if (isV1 && data.subFocusArea?.geometry && typeof helpers.applySubFocus === 'function') {
          // The subfocus relies on a focused area; retry briefly until focus is ready
          let ok = false;
          const maxAttempts = 25; // ~5s at 200ms
          let attempts = 0;
          await new Promise((resolve) => {
            const attempt = () => {
              try {
                ok = helpers.applySubFocus(data.subFocusArea.geometry) === true;
                if (ok) {
                  appliedSubFocus = true;
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
        } else if (isV1 && data.view) {
          try {
            appliedView = true;
            if (data.view.center) map.setCenter(data.view.center);
            if (typeof data.view.zoom === 'number') map.setZoom(data.view.zoom);
            if (typeof data.view.bearing === 'number' && map.setBearing) map.setBearing(data.view.bearing);
            if (typeof data.view.pitch === 'number' && map.setPitch) map.setPitch(data.view.pitch);
          } catch (_) {}
        }
      } catch (_) {}

      // Restore layers
      try {
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

          // Apply layer state and, after React commits, reload any visible infrastructure layers
          setLayers(sanitized);
          try {
            if (helpers.reloadVisibleInfra) {
              setTimeout(() => {
                try { helpers.reloadVisibleInfra(); } catch (_) {}
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
            if (typeof data.view.bearing === 'number' && map.setBearing) map.setBearing(data.view.bearing);
            if (typeof data.view.pitch === 'number' && map.setPitch) map.setPitch(data.view.pitch);
          } else if (data.metadata) {
            if (data.metadata.center) map.setCenter(data.metadata.center);
            if (typeof data.metadata.zoom === 'number') map.setZoom(data.metadata.zoom);
          }
        }
      } catch (_) {}

      // Final nudge: ensure all derived overlays recompute and the map repaints
      try {
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('annotations:changed'));
      } catch (_) {}
      try { if (map && typeof map.triggerRepaint === 'function') map.triggerRepaint(); } catch (_) {}

      // End rehydration guard
      try { helpers.setRehydratingImport && helpers.setRehydratingImport(false); } catch (_) {}

      // Re-enable interactions
      try { if (map && map.scrollZoom && map.scrollZoom.enable) map.scrollZoom.enable(); } catch (_) {}
      try { if (map && map.boxZoom && map.boxZoom.enable) map.boxZoom.enable(); } catch (_) {}
      try { if (map && map.dragPan && map.dragPan.enable) map.dragPan.enable(); } catch (_) {}
      try { if (map && map.dragRotate && map.dragRotate.enable) map.dragRotate.enable(); } catch (_) {}
      try { if (map && map.keyboard && map.keyboard.enable) map.keyboard.enable(); } catch (_) {}
      try { if (map && map.doubleClickZoom && map.doubleClickZoom.enable) map.doubleClickZoom.enable(); } catch (_) {}
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
    }
  };
  reader.readAsText(file);
};


