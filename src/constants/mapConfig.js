// constants/mapConfig.js
export const MAP_CONFIG = {
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [-73.985, 40.758],
  zoom: 16,
  preserveDrawingBuffer: true,
  permitAreaSource: '/data/permit-areas/nyc-permit-areas-minified.geojson',
  permitFetchCacheMode: 'no-store'
};

export const BASEMAP_OPTIONS = {
  carto: {
    name: 'Carto',
    type: 'style',
    url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
  },
  satellite: {
    name: 'Satellite',
    type: 'custom',
    basemapType: '2022'
  }
};

export const NYC_BASEMAPS = {
  '2018': {
    name: 'NYC Satellite 2018',
    url: 'https://maps{s}.nyc.gov/xyz/1.0.0/photo/2018/{z}/{x}/{y}.png8',
    labelUrl: 'https://maps{s}.nyc.gov/xyz/1.0.0/carto/label-lt/{z}/{x}/{y}.png8',
    subdomains: '1234',
    bounds: [[40.4888, -74.2759], [40.9279, -73.6896]],
    labelBounds: [[40.0341, -74.2727], [41.2919, -71.9101]]
  },
  '2022': {
    name: 'NYC Satellite 2022',
    url: 'https://maps.nyc.gov/xyz/1.0.0/2022Ortho/{z}/{x}/{y}.png',
    labelUrl: 'https://maps{s}.nyc.gov/xyz/1.0.0/carto/label-lt/{z}/{x}/{y}.png8',
    subdomains: '1234',
    bounds: [[40.4888, -74.2759], [40.9279, -73.6896]],
    labelBounds: [[40.0341, -74.2727], [41.2919, -71.9101]]
  }
};

export const MAP_LIBRARIES = {
  maplibre: {
    css: '/vendor/maplibre-gl.css',
    js: '/vendor/maplibre-gl.js'
  },
  draw: {
    css: '/vendor/mapbox-gl-draw.css',
    js: '/vendor/mapbox-gl-draw.js'
  },
  searchBox: {
    css: '/vendor/maplibre-search-box.css',
    js: '/vendor/maplibre-search-box.umd.js',
    optional: true
  }
};