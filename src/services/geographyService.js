// Generic geography loaders modeled after permitAreaService with defensive initialization

import { ensureBaseLayers } from './geographyLayerManager.js';

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
      // Delegate base layer creation to geographyLayerManager for a single source of truth
      ensureBaseLayers(map, sourceId, 'polygon', { fillColor, focusColor });

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
      // Delegate base point layer creation to geographyLayerManager to avoid duplication
      ensureBaseLayers(map, sourceId, 'point', { fillColor: circleColor, focusColor });

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


