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

/**
 * Ensure provided layers are placed between permit-area layers and dropped object symbol layers.
 * If any permit-area layer appears above dropped objects, fall back to moving target layers to
 * the top of the stack to preserve visibility.
 */
export const ensureLayersBetweenPermitAreasAndDroppedObjects = (map, layerIds = []) => {
  try {
    if (!map || !Array.isArray(layerIds) || layerIds.length === 0) return;
    const style = map.getStyle && map.getStyle();
    const layers = (style && style.layers) ? style.layers : [];
    let beforeId;
    try {
      const preferSelected = layers.find(l => l && l.id === 'dropped-objects-selected');
      const preferSymbol = layers.find(l => l && l.id === 'dropped-objects-symbol');
      const prefer = preferSelected || preferSymbol;
      const idxSelected = layers.findIndex(l => l && l.id === 'dropped-objects-selected');
      const idxSymbol = layers.findIndex(l => l && l.id === 'dropped-objects-symbol');
      const minDroppedIdx = [idxSelected, idxSymbol].filter(i => i >= 0).reduce((a,b)=>Math.min(a,b), Number.POSITIVE_INFINITY);
      const maxPermitIdx = layers.reduce((acc, l, i) => {
        if (l && typeof l.id === 'string' && (l.id.startsWith('permit-areas') || l.id.startsWith('permitAreas'))) {
          return Math.max(acc, i);
        }
        return acc;
      }, -1);
      if (prefer) beforeId = prefer.id; else {
        const anyDropped = layers.find(l => l && typeof l.id === 'string' && l.id.includes('dropped-objects'));
        beforeId = anyDropped ? anyDropped.id : undefined;
      }
      // If any permit-area layer is above dropped objects, move our layers to top (no beforeId)
      if (maxPermitIdx >= 0 && maxPermitIdx >= minDroppedIdx) {
        beforeId = undefined;
      }
    } catch (_) { beforeId = undefined; }
    for (let i = 0; i < layerIds.length; i++) {
      const lid = layerIds[i];
      try { if (map.getLayer && map.getLayer(lid)) map.moveLayer(lid, beforeId); } catch (_) {}
    }
  } catch (_) {}
};



