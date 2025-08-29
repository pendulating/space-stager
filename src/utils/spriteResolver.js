/**
 * Sprite Resolver
 *
 * Central authority for enhanced-rendering sprite URLs, image preloading, and
 * contrasting background color computation. Consumers should NOT assemble URLs
 * manually; instead call getCandidateSrcs() and useStableImageSrc() to avoid
 * flicker when switching between ISO/2D or when a candidate fails to load.
 *
 * Fallback order (by design):
 *  - nested current-view dir (/static/{base}/{view}/renders/{file}.png)
 *  - nested isometric dir
 *  - flat current-view (/static/{base}/{file}.png)
 *  - flat isometric
 *  - legacy isometric (/data/icons/isometric-bw)
 */
import { buildSpriteFallbacks, VIEW_TYPES, quantizeAngleTo45 } from './enhancedRenderingUtils';
import { getContrastingBackgroundForIcon } from './colorUtils';

// Simple LRU helpers
const cappedSet = (map, key, value, cap) => {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  if (map.size > cap) {
    const first = map.keys().next().value;
    map.delete(first);
  }
};

const IMAGE_CACHE_MAX = 256;
const BG_CACHE_MAX = 512;

// src -> { status: 'ready'|'loading'|'error', img?: HTMLImageElement, promise?: Promise }
const imageCache = new Map();
// src -> computed contrasting bg color
const bgCache = new Map();

export const getFallbacks = (baseName, angle, viewType = VIEW_TYPES.ISOMETRIC) => {
  return buildSpriteFallbacks(baseName, angle, viewType);
};

export const preloadImage = (src) => {
  if (!src) return Promise.resolve(false);
  const cached = imageCache.get(src);
  if (cached) {
    if (cached.status === 'ready') return Promise.resolve(true);
    if (cached.status === 'loading' && cached.promise) return cached.promise;
    if (cached.status === 'error') {
      // try again: fall through to recreate
    }
  }
  const p = new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        cappedSet(imageCache, src, { status: 'ready', img }, IMAGE_CACHE_MAX);
        resolve(true);
      };
      img.onerror = () => {
        cappedSet(imageCache, src, { status: 'error' }, IMAGE_CACHE_MAX);
        resolve(false);
      };
      cappedSet(imageCache, src, { status: 'loading', promise: p }, IMAGE_CACHE_MAX);
      img.src = src;
    } catch (_) {
      cappedSet(imageCache, src, { status: 'error' }, IMAGE_CACHE_MAX);
      resolve(false);
    }
  });
  return p;
};

export const preloadChain = async (srcs) => {
  if (!Array.isArray(srcs) || srcs.length === 0) return false;
  // Try sequentially; stop after first success
  for (let i = 0; i < srcs.length; i++) {
    // Fire preloads for early elements optimistically
    // but await each in order to short-circuit on first ready
    // eslint-disable-next-line no-await-in-loop
    const ok = await preloadImage(srcs[i]);
    if (ok) return true;
  }
  return false;
};

export const prefetchView = (baseName, angles = [0,45,90,135,180,225,270,315], viewType = VIEW_TYPES.ISOMETRIC) => {
  try {
    angles.forEach((angle) => {
      const chain = buildSpriteFallbacks(baseName, angle, viewType);
      // Kick off fetch for primary candidate only; subsequent loads happen on demand
      if (chain[0]) preloadImage(chain[0]);
    });
  } catch (_) {}
};

export const bgColorFor = async (src, defaultColor = '#64748b', contrastFactor = 0.9) => {
  if (!src) return defaultColor;
  const cached = bgCache.get(src);
  if (cached) return cached;
  try {
    const bg = await getContrastingBackgroundForIcon(src, defaultColor, contrastFactor);
    cappedSet(bgCache, src, bg, BG_CACHE_MAX);
    return bg;
  } catch (_) {
    return defaultColor;
  }
};

export const firstReadyInChain = (srcs) => {
  for (let i = 0; i < (srcs?.length || 0); i++) {
    const cached = imageCache.get(srcs[i]);
    if (cached && cached.status === 'ready') return srcs[i];
  }
  return null;
};

export const getCandidateSrcs = (objectType, angle, viewType) => {
  if (!objectType) return [];
  try {
    const isEnhanced = !!objectType?.enhancedRendering?.enabled;
    if (isEnhanced && objectType.enhancedRendering?.spriteBase) {
      const base = objectType.enhancedRendering.spriteBase;
      const q = quantizeAngleTo45(typeof angle === 'number' ? angle : 0);
      return buildSpriteFallbacks(base, q, viewType);
    }
    if (objectType.imageUrl) return [objectType.imageUrl];
    return [];
  } catch (_) {
    return [];
  }
};

export const __debugCaches = () => ({ imageCache, bgCache });


