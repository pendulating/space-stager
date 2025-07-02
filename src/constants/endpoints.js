// constants/endpoints.js
export const INFRASTRUCTURE_ENDPOINTS = {
  bikeLanes: {
    baseUrl: 'https://data.cityofnewyork.us/resource/mzxg-pwib.geojson',
    geoField: 'the_geom',
    isLocal: false
  },
  trees: {
    baseUrl: 'https://data.cityofnewyork.us/resource/hn5i-inap.geojson',
    geoField: 'location',
    isLocal: false
  },
  hydrants: {
    baseUrl: 'https://data.cityofnewyork.us/resource/5bgh-vtsn.geojson',
    geoField: 'the_geom',
    isLocal: false
  },
  parking: {
    baseUrl: 'https://data.cityofnewyork.us/resource/hn5i-inap.geojson',
    geoField: 'location',
    isLocal: false
  },
  busStops: {
    baseUrl: '/data/static/bus_stops_nyc.geojson',
    geoField: null,
    isLocal: true
  },
  benches: {
    baseUrl: 'https://data.cityofnewyork.us/resource/esmy-s8q5.geojson',
    geoField: 'the_geom',
    isLocal: false
  }
};