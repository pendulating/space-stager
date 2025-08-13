#!/usr/bin/env node

import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function ensureDir(path) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function copy(src, dest) {
  ensureDir(dirname(dest));
  copyFileSync(src, dest);
  console.log(`Copied ${src} -> ${dest}`);
}

const root = resolve(__dirname, '..');
const vendorDir = resolve(root, 'public', 'vendor');
ensureDir(vendorDir);

// MapLibre GL
copy(
  resolve(root, 'node_modules', 'maplibre-gl', 'dist', 'maplibre-gl.css'),
  resolve(vendorDir, 'maplibre-gl.css')
);
copy(
  resolve(root, 'node_modules', 'maplibre-gl', 'dist', 'maplibre-gl.js'),
  resolve(vendorDir, 'maplibre-gl.js')
);

// Mapbox GL Draw
copy(
  resolve(root, 'node_modules', '@mapbox', 'mapbox-gl-draw', 'dist', 'mapbox-gl-draw.css'),
  resolve(vendorDir, 'mapbox-gl-draw.css')
);
copy(
  resolve(root, 'node_modules', '@mapbox', 'mapbox-gl-draw', 'dist', 'mapbox-gl-draw.js'),
  resolve(vendorDir, 'mapbox-gl-draw.js')
);

// MapLibre Search Box (optional)
const searchCss = resolve(root, 'node_modules', '@stadiamaps', 'maplibre-search-box', 'dist', 'maplibre-search-box.css');
const searchUmd = resolve(root, 'node_modules', '@stadiamaps', 'maplibre-search-box', 'dist', 'maplibre-search-box.umd.js');
if (existsSync(searchCss) && existsSync(searchUmd)) {
  copy(searchCss, resolve(vendorDir, 'maplibre-search-box.css'));
  copy(searchUmd, resolve(vendorDir, 'maplibre-search-box.umd.js'));
} else {
  console.warn('[copy-vendor] MapLibre Search Box assets not found; skipping.');
}

console.log('Vendor assets copied.');


