// constants/endpoints.js
export const INFRASTRUCTURE_ENDPOINTS = {
  bikeLanes: {
    baseUrl: 'https://data.cityofnewyork.us/resource/mzxg-pwib.geojson',
    geoField: 'the_geom',
    isLocal: false
  },
  bikeParking: {
    baseUrl: 'https://data.cityofnewyork.us/resource/592z-n7dk.geojson',
    geoField: 'the_geom',
    isLocal: false
  },
  citibikeStations: {
    baseUrl: '/data/static/citibike_stations/citibike_stations.geojson',
    geoField: null,
    isLocal: true
  },
  subwayEntrances: {
    baseUrl: 'https://data.ny.gov/resource/i9wp-a4ja.geojson',
    geoField: 'the_geom',
    isLocal: false
  },
  fireLanes: {
    baseUrl: 'https://data.cityofnewyork.us/resource/inkn-q76z.geojson',
    geoField: 'the_geom',
    isLocal: false,
    filterField: 'fire_lane',
    filterValue: 'True'
  },
  specialDisasterRoutes: {
    baseUrl: 'https://data.cityofnewyork.us/resource/inkn-q76z.geojson',
    geoField: 'the_geom',
    isLocal: false,
    filterField: 'special_disaster',
    filterValue: 'True'
  },
  pedestrianRamps: {
    baseUrl: 'https://data.cityofnewyork.us/resource/ufzp-rrqu.geojson',
    geoField: 'the_geom',
    isLocal: false
  },
  parkingMeters: {
    baseUrl: 'https://data.cityofnewyork.us/resource/693u-uax6.geojson',
    geoField: 'location',
    isLocal: false
  },
  linknycKiosks: {
    baseUrl: 'https://data.cityofnewyork.us/resource/s4kf-3yrf.json',
    geoField: 'location',
    isLocal: false
  },
  publicRestrooms: {
    baseUrl: 'https://data.cityofnewyork.us/resource/i7jb-7jku.geojson',
    geoField: 'location_1',
    isLocal: false
  },
  drinkingFountains: {
    baseUrl: 'https://data.cityofnewyork.us/resource/qnv7-p7a2.geojson',
    geoField: 'the_geom',
    isLocal: false
  },
  sprayShowers: {
    baseUrl: 'https://data.cityofnewyork.us/resource/ckaz-6gaa.geojson',
    geoField: 'point',
    isLocal: false
  },
  parksTrails: {
    baseUrl: 'https://data.cityofnewyork.us/resource/vjbm-hsyr.geojson',
    geoField: 'shape',
    isLocal: false
  },
  parkingLots: {
    baseUrl: 'https://data.cityofnewyork.us/resource/7cgt-uhhz.geojson',
    geoField: 'the_geom',
    isLocal: false
  },
  iceLadders: {
    baseUrl: 'https://data.cityofnewyork.us/resource/eubv-y6cr.geojson',
    geoField: 'the_geom',
    isLocal: false
  },
  parksSigns: {
    baseUrl: 'https://data.cityofnewyork.us/resource/hv9n-xgy4.geojson',
    geoField: 'point',
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