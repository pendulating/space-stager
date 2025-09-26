// utils/mapLayerUtils.js

/**
 * Ensure symbol layers are aligned to the viewport so icons/text do not rotate with the map.
 * Applies a consistent set of layout properties for provided layer ids.
 */
export const ensureViewportAlignedSymbols = (map, layerIds = []) => {
  try {
    if (!map || !Array.isArray(layerIds)) return;
    for (let i = 0; i < layerIds.length; i++) {
      const id = layerIds[i];
      if (!id) continue;
      try { map.setLayoutProperty(id, 'icon-rotation-alignment', 'viewport'); } catch (_) {}
      try { map.setLayoutProperty(id, 'icon-pitch-alignment', 'viewport'); } catch (_) {}
      try { map.setLayoutProperty(id, 'icon-anchor', 'center'); } catch (_) {}
      try { map.setLayoutProperty(id, 'icon-offset', [0, 0]); } catch (_) {}
    }
  } catch (_) {}
};

export default ensureViewportAlignedSymbols;



