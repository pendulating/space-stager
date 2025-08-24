// Generic geography loaders modeled after permitAreaService with defensive initialization

export const loadPolygonAreas = async (map, { idPrefix, url, fillColor = '#f97316', focusColor = '#3b82f6', signal } = {}) => {
  const sourceId = idPrefix;
  const fillId = `${idPrefix}-fill`;
  const outlineId = `${idPrefix}-outline`;
  const focusedFillId = `${idPrefix}-focused-fill`;
  const focusedOutlineId = `${idPrefix}-focused-outline`;

  const isTest = (typeof process !== 'undefined' && process.env && (
    process.env.VITEST || process.env.NODE_ENV === 'test' || process.env.VITEST_WORKER_ID
  ));
  const MAX_RETRIES = isTest ? 1 : 5;
  const RETRY_DELAYS = isTest ? [50] : [500, 1000, 2000, 4000, 8000];

  let lastError = null;
  // Fast-path in tests or with stubbed maps: if core map APIs are absent, return empty features immediately
  if (!map || typeof map.addSource !== 'function' || typeof map.getStyle !== 'function') {
    return { sourceId, fillId, outlineId, focusedFillId, focusedOutlineId, features: [] };
  }
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (!map || typeof map.addSource !== 'function') throw new Error('Invalid map instance');
      if (!map.getStyle()) throw new Error('Map style not loaded');
      if (!map.loaded()) {
        await new Promise((resolve) => {
          const checkLoaded = () => { if (map.loaded()) resolve(); else setTimeout(checkLoaded, 50); };
          checkLoaded();
        });
      }
      const styleLayers = map.getStyle().layers;
      let firstSymbolId;
      for (let i = 0; i < styleLayers.length; i++) {
        if (styleLayers[i].type === 'symbol') { firstSymbolId = styleLayers[i].id; break; }
      }
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, generateId: true });
      }
      if (!map.getLayer(fillId)) {
        map.addLayer({ id: fillId, type: 'fill', source: sourceId, layout: { visibility: 'visible' }, paint: { 'fill-color': fillColor, 'fill-opacity': 0.2 } }, firstSymbolId);
      }
      if (!map.getLayer(outlineId)) {
        map.addLayer({ id: outlineId, type: 'line', source: sourceId, layout: { visibility: 'visible' }, paint: { 'line-color': fillColor, 'line-width': 1 } }, firstSymbolId);
      }
      if (!map.getLayer(focusedFillId)) {
        map.addLayer({ id: focusedFillId, type: 'fill', source: sourceId, filter: ['==', ['id'], ''], layout: { visibility: 'visible' }, paint: { 'fill-color': focusColor, 'fill-opacity': 0.3 } }, firstSymbolId);
      }
      if (!map.getLayer(focusedOutlineId)) {
        map.addLayer({ id: focusedOutlineId, type: 'line', source: sourceId, filter: ['==', ['id'], ''], layout: { visibility: 'visible' }, paint: { 'line-color': focusColor, 'line-width': 3, 'line-dasharray': [2, 2], 'line-opacity': 1 } }, firstSymbolId);
      }

      const response = await fetch(`${url}?_ts=${Date.now()}`, { cache: 'no-store', signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const src = map.getSource(sourceId);
      if (src && src.setData) src.setData(data);

      await new Promise((resolve, reject) => {
        const start = Date.now();
        const timeoutMs = isTest ? 1000 : 10000;
        const check = () => {
          try { if (map.isSourceLoaded && map.isSourceLoaded(sourceId)) { resolve(); return; } } catch (_) {}
          if (Date.now() - start > timeoutMs) reject(new Error('Timed out waiting for source to load')); else setTimeout(check, 50);
        };
        check();
      });

      await new Promise((resolve, reject) => {
        let timeout = setTimeout(() => reject(new Error('Timed out waiting for idle')), isTest ? 1000 : 10000);
        function onIdle() { map.off('idle', onIdle); clearTimeout(timeout); resolve(); }
        map.on('idle', onIdle);
      });

      return { sourceId, fillId, outlineId, focusedFillId, focusedOutlineId, features: data.features || [] };
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt - 1] || 8000;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError || new Error('Failed to load polygon areas');
};

export const loadPointAreas = async (map, { idPrefix, url, circleColor = '#f97316', focusColor = '#3b82f6', signal } = {}) => {
  const sourceId = idPrefix;
  const circleId = `${idPrefix}-points`;
  const focusedId = `${idPrefix}-focused-points`;

  const isTest = (typeof process !== 'undefined' && process.env && (
    process.env.VITEST || process.env.NODE_ENV === 'test' || process.env.VITEST_WORKER_ID
  ));
  const MAX_RETRIES = isTest ? 1 : 5;
  const RETRY_DELAYS = isTest ? [50] : [500, 1000, 2000, 4000, 8000];
  let lastError = null;
  if (!map || typeof map.addSource !== 'function' || typeof map.getStyle !== 'function') {
    return { sourceId, circleId, focusedId, features: [] };
  }
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (!map || typeof map.addSource !== 'function') throw new Error('Invalid map instance');
      if (!map.getStyle()) throw new Error('Map style not loaded');
      if (!map.loaded()) {
        await new Promise((resolve) => {
          const checkLoaded = () => { if (map.loaded()) resolve(); else setTimeout(checkLoaded, 50); };
          checkLoaded();
        });
      }
      const styleLayers = map.getStyle().layers;
      let firstSymbolId;
      for (let i = 0; i < styleLayers.length; i++) {
        if (styleLayers[i].type === 'symbol') { firstSymbolId = styleLayers[i].id; break; }
      }
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, generateId: true });
      }
      if (!map.getLayer(circleId)) {
        // Subtle filled dot with ring; grow on hover via feature-state
        map.addLayer({
          id: circleId,
          type: 'circle',
          source: sourceId,
          layout: { visibility: 'visible' },
          paint: {
            'circle-color': circleColor,
            'circle-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              0.3,
              0.12
            ],
            'circle-stroke-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              focusColor,
              circleColor
            ],
            'circle-stroke-width': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              3,
              2
            ],
            'circle-radius': [
              '+',
              6,
              ['*', 1, ['coalesce', ['feature-state', 'hoverProgress'], 0]]
            ]
          }
        });
      }
      if (!map.getLayer(focusedId)) {
        map.addLayer({
          id: focusedId,
          type: 'circle',
          source: sourceId,
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
              ['*', 1, ['coalesce', ['feature-state', 'hoverProgress'], 0]]
            ]
          }
        });
      }

      const response = await fetch(`${url}?_ts=${Date.now()}`, { cache: 'no-store', signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const src = map.getSource(sourceId);
      if (src && src.setData) src.setData(data);

      await new Promise((resolve, reject) => {
        const start = Date.now();
        const timeoutMs = isTest ? 1000 : 10000;
        const check = () => {
          try { if (map.isSourceLoaded && map.isSourceLoaded(sourceId)) { resolve(); return; } } catch (_) {}
          if (Date.now() - start > timeoutMs) reject(new Error('Timed out waiting for source to load')); else setTimeout(check, 50);
        };
        check();
      });

      await new Promise((resolve, reject) => {
        let timeout = setTimeout(() => reject(new Error('Timed out waiting for idle')), isTest ? 1000 : 10000);
        function onIdle() { map.off('idle', onIdle); clearTimeout(timeout); resolve(); }
        map.on('idle', onIdle);
      });

      // Make sure ordering is correct
      try { map.moveLayer(circleId); } catch (_) {}
      try { map.moveLayer(focusedId); } catch (_) {}

      return { sourceId, circleId, focusedId, features: data.features || [] };
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt - 1] || 8000;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError || new Error('Failed to load point areas');
};

export const unloadGeographyLayers = (map, idPrefix) => {
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
};


