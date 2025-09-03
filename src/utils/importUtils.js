// utils/importUtils.js
import { switchBasemap } from './mapUtils';

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

      // Final nudge: ensure all derived overlays recompute and the map repaints
      try {
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('annotations:changed'));
      } catch (_) {}
      try { if (map && typeof map.triggerRepaint === 'function') map.triggerRepaint(); } catch (_) {}
    } catch (error) {
      console.error('Error importing plan:', error);
      alert('Error importing plan. Please check the file format.');
    }
  };
  reader.readAsText(file);
};


