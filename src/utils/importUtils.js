// utils/importUtils.js
import { switchBasemap } from './exportUtils';

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
          // Notify annotation system to recompute derived labels immediately
          try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('annotations:changed')); } catch (_) {}
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


