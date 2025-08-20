// utils/colorUtils.js

// Simple cache so we only analyze each image once per session
const lightnessCache = new Map();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const hexToRgb = (hex) => {
  if (typeof hex !== 'string') return null;
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
};

export const rgbaString = (rgb, alpha = 1) => {
  if (!rgb) return `rgba(0,0,0,${alpha})`;
  const a = clamp(alpha, 0, 1);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
};

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  // In case assets are served from CDN in future
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = (e) => reject(e);
  img.src = src;
});

// Returns true if the image is predominantly light (high luminance)
export const isImageLight = async (src) => {
  if (!src || typeof document === 'undefined') return false;
  if (lightnessCache.has(src)) return lightnessCache.get(src);

  try {
    const img = await loadImage(src);
    const maxDim = 24; // downscale for speed
    const scale = Math.min(1, maxDim / Math.max(img.width || maxDim, img.height || maxDim));
    const w = Math.max(1, Math.floor((img.width || maxDim) * scale));
    const h = Math.max(1, Math.floor((img.height || maxDim) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    let weightedLumSum = 0;
    let alphaSum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3] / 255; // 0..1
      if (a < 0.1) continue; // ignore near-transparent
      // Perceived luminance
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b; // 0..255
      weightedLumSum += lum * a;
      alphaSum += a;
    }
    const avgLum = alphaSum > 0 ? weightedLumSum / alphaSum : 0;
    const isLight = avgLum >= 200; // threshold tuned for white-dominant icons
    lightnessCache.set(src, isLight);
    return isLight;
  } catch (_) {
    // On failure, assume not light to keep white background
    lightnessCache.set(src, false);
    return false;
  }
};

// Determine a contrasting background color for an icon image.
// If the icon is light, use the provided hex (or a neutral) with alpha.
// If the icon is dark, use a semi-opaque white.
export const getContrastingBackgroundForIcon = async (src, fallbackHex = '#64748b', alpha = 0.9) => {
  const light = await isImageLight(src);
  if (light) {
    const rgb = hexToRgb(fallbackHex) || { r: 31, g: 41, b: 55 }; // gray-800 fallback
    return rgbaString(rgb, alpha);
  }
  return `rgba(255, 255, 255, ${alpha})`;
};


