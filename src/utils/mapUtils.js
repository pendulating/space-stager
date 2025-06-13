// utils/mapUtils.js
import { MAP_LIBRARIES, MAP_CONFIG } from '../constants/mapConfig';

export const loadCSS = () => {
  const cssLinks = [
    { id: 'maplibre-gl.css', href: MAP_LIBRARIES.maplibre.css },
    { id: 'mapbox-gl-draw.css', href: MAP_LIBRARIES.draw.css },
    { id: 'maplibre-search-box.css', href: MAP_LIBRARIES.searchBox.css }
  ];

  cssLinks.forEach(({ id, href }) => {
    if (!document.querySelector(`link[href*="${id}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
      console.log(`Added ${id}`);
    }
  });
};

export const loadScript = (src, checkFn) => {
  return new Promise((resolve, reject) => {
    if (checkFn && checkFn()) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

export const loadMapLibraries = async () => {
  loadCSS();

  // Load MapLibre first
  await loadScript(MAP_LIBRARIES.maplibre.js, () => window.maplibregl);
  console.log('MapLibre loaded');

  // Load other libraries in parallel
  await Promise.all([
    loadScript(MAP_LIBRARIES.draw.js, () => window.MapboxDraw),
    loadScript(MAP_LIBRARIES.searchBox.js, () => window.maplibreSearchBox)
  ]);
  console.log('All libraries loaded');
};

export const initializeMap = async (container) => {
  const mapInstance = new window.maplibregl.Map({
    container,
    style: MAP_CONFIG.style,
    center: MAP_CONFIG.center,
    zoom: MAP_CONFIG.zoom,
    preserveDrawingBuffer: MAP_CONFIG.preserveDrawingBuffer
  });

  return new Promise((resolve, reject) => {
    mapInstance.on('load', () => {
      // Add controls
      mapInstance.addControl(new window.maplibregl.NavigationControl(), 'top-right');
      mapInstance.addControl(new window.maplibregl.ScaleControl(), 'bottom-right');

      // Add search control if available
      if (window.maplibreSearchBox) {
        const searchControl = new window.maplibreSearchBox.MapLibreSearchControl({
          useMapFocusPoint: true,
          mapFocusPointMinZoom: 10,
          maxResults: 5,
          minInputLength: 2,
          searchOnEnter: true
        });
        mapInstance.addControl(searchControl, 'top-left');
      }

      resolve(mapInstance);
    });

    mapInstance.on('error', reject);
  });
};

export const getMetersPerPixel = (map) => {
  const zoom = map.getZoom();
  const lat = map.getCenter().lat;
  return 40075016.686 * Math.abs(Math.cos(lat * Math.PI / 180)) / Math.pow(2, zoom + 8);
};

export const getSafeFilename = (name) => {
  const safeName = (name || 'unnamed').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const date = new Date().toISOString().split('T')[0];
  return `${safeName}-${date}`;
};