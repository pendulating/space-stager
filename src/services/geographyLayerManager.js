// services/geographyLayerManager.js
// Centralized, idempotent helpers for base geography layers

/**
 * Ensure base source and layers exist for a geography without fetching data.
 * Adds an empty FeatureCollection to start to avoid races with events.
 *
 * @param {import('maplibre-gl').Map} map
 * @param {string} idPrefix e.g., 'permit-areas' | 'plaza-areas' | 'intersections'
 * @param {'polygon'|'point'} type
 * @param {{ fillColor?: string, focusColor?: string }} [options]
 */
export function ensureBaseLayers(map, idPrefix, type, options = {}) {
  if (!map || !map.getStyle) return;
  const fillColor = options.fillColor || '#f97316';
  const focusColor = options.focusColor || '#3b82f6';

  const emptyFc = { type: 'FeatureCollection', features: [] };

  try {
    if (!map.getSource(idPrefix)) {
      map.addSource(idPrefix, { type: 'geojson', data: emptyFc, generateId: true });
    }
  } catch (_) {}

  const styleLayers = (map.getStyle && map.getStyle().layers) || [];
  let firstSymbolId;
  for (let i = 0; i < styleLayers.length; i++) {
    if (styleLayers[i].type === 'symbol') { firstSymbolId = styleLayers[i].id; break; }
  }

  if (type === 'polygon') {
    const fillId = `${idPrefix}-fill`;
    const outlineId = `${idPrefix}-outline`;
    const focusedFillId = `${idPrefix}-focused-fill`;
    const focusedOutlineId = `${idPrefix}-focused-outline`;

    try {
      if (!map.getLayer(fillId)) {
        map.addLayer({ id: fillId, type: 'fill', source: idPrefix, layout: { visibility: 'visible' }, paint: { 'fill-color': fillColor, 'fill-opacity': 0.2 } }, firstSymbolId);
      }
    } catch (_) {}
    try {
      if (!map.getLayer(outlineId)) {
        map.addLayer({ id: outlineId, type: 'line', source: idPrefix, layout: { visibility: 'visible' }, paint: { 'line-color': fillColor, 'line-width': 1 } }, firstSymbolId);
      }
    } catch (_) {}
    try {
      if (!map.getLayer(focusedFillId)) {
        map.addLayer({ id: focusedFillId, type: 'fill', source: idPrefix, filter: ['==', ['id'], ''], layout: { visibility: 'visible' }, paint: { 'fill-color': focusColor, 'fill-opacity': 0.3 } }, firstSymbolId);
      }
    } catch (_) {}
    try {
      if (!map.getLayer(focusedOutlineId)) {
        map.addLayer({ id: focusedOutlineId, type: 'line', source: idPrefix, filter: ['==', ['id'], ''], layout: { visibility: 'visible' }, paint: { 'line-color': focusColor, 'line-width': 3, 'line-dasharray': [2, 2], 'line-opacity': 1 } }, firstSymbolId);
      }
    } catch (_) {}
  } else if (type === 'point') {
    const circleId = `${idPrefix}-points`;
    const focusedId = `${idPrefix}-focused-points`;
    try {
      if (!map.getLayer(circleId)) {
        // Subtle filled dot with ring; grow on hover via feature-state
        map.addLayer({
          id: circleId,
          type: 'circle',
          source: idPrefix,
          layout: { visibility: 'visible' },
          paint: {
            'circle-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              '#2563eb',
              fillColor
            ],
            'circle-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              0.35,
              0.12
            ],
            'circle-stroke-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              '#2563eb',
              fillColor
            ],
            'circle-stroke-width': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              3,
              2
            ],
            // radius = base + progress*delta
            'circle-radius': [
              '+',
              6,
              ['*', 1,
                ['coalesce', ['feature-state', 'hoverProgress'], 0]
              ]
            ]
          }
        });
      }
    } catch (_) {}
    try {
      if (!map.getLayer(focusedId)) {
        // Focus ring: subtle filled dot, larger base and hover sizes
        map.addLayer({
          id: focusedId,
          type: 'circle',
          source: idPrefix,
          filter: ['==', ['id'], ''],
          layout: { visibility: 'visible' },
          paint: {
            'circle-color': focusColor,
            'circle-opacity': 0.16,
            'circle-stroke-color': focusColor,
            'circle-stroke-width': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              4,
              3
            ],
            'circle-radius': [
              '+',
              9,
              ['*', 1,
                ['coalesce', ['feature-state', 'hoverProgress'], 0]
              ]
            ]
          }
        });
      }
    } catch (_) {}

    // Ensure ordering: focused on top, then base points
    try { map.moveLayer(circleId); } catch (_) {}
    try { map.moveLayer(focusedId); } catch (_) {}
  }
}

/**
 * Toggle base (non-focused) layer visibility for a geography.
 * @param {import('maplibre-gl').Map} map
 * @param {string} idPrefix
 * @param {'polygon'|'point'} type
 * @param {boolean} visible
 */
export function setBaseVisibility(map, idPrefix, type, visible) {
  if (!map) return;
  const vis = visible ? 'visible' : 'none';
  try {
    if (type === 'polygon') {
      if (map.getLayer(`${idPrefix}-fill`)) map.setLayoutProperty(`${idPrefix}-fill`, 'visibility', vis);
      if (map.getLayer(`${idPrefix}-outline`)) map.setLayoutProperty(`${idPrefix}-outline`, 'visibility', vis);
    } else if (type === 'point') {
      if (map.getLayer(`${idPrefix}-points`)) map.setLayoutProperty(`${idPrefix}-points`, 'visibility', vis);
    }
  } catch (_) {}
}

/**
 * Remove all base and focused layers and the source for a geography.
 * @param {import('maplibre-gl').Map} map
 * @param {string} idPrefix
 */
export function unload(map, idPrefix) {
  if (!map) return;
  const layerIds = [
    `${idPrefix}-focused-outline`,
    `${idPrefix}-focused-fill`,
    `${idPrefix}-outline`,
    `${idPrefix}-fill`,
    `${idPrefix}-focused-points`,
    `${idPrefix}-points`
  ];
  layerIds.forEach(id => { try { if (map.getLayer(id)) map.removeLayer(id); } catch (_) {} });
  try { if (map.getSource(idPrefix)) map.removeSource(idPrefix); } catch (_) {}
}



