// constants/mapConfig.js
export const MAP_CONFIG = {
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [-73.985, 40.758],
  zoom: 16,
  preserveDrawingBuffer: true,
  permitAreaSource: '/data/permit-areas/nyc_20250611_122007.geojson'
};

export const MAP_LIBRARIES = {
  maplibre: {
    css: 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css',
    js: 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js'
  },
  draw: {
    css: 'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.3/mapbox-gl-draw.css',
    js: 'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.3/mapbox-gl-draw.js'
  },
  searchBox: {
    css: 'https://unpkg.com/@stadiamaps/maplibre-search-box/dist/maplibre-search-box.css',
    js: 'https://unpkg.com/@stadiamaps/maplibre-search-box/dist/maplibre-search-box.umd.js'
  }
};