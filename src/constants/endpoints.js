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
    // Socrata dataset uses entrance_latitude/entrance_longitude and a location field entrance_georeference
    // Prefer numeric lat/lon filtering for reliability
    geoField: 'entrance_georeference',
    latField: 'entrance_latitude',
    lngField: 'entrance_longitude',
    isLocal: false,
    selectFields: [
      'division',
      'line',
      'borough',
      'stop_name',
      'complex_id',
      'constituent_station_name',
      'station_id',
      'gtfs_stop_id',
      'daytime_routes',
      'entrance_type',
      'entry_allowed',
      'exit_allowed',
      'entrance_latitude',
      'entrance_longitude',
      'entrance_georeference'
    ]
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
    isLocal: false,
    // Also pull regulation fields used for export summary
    selectFields: [
      'on_street',
      'from_street',
      'to_street',
      'side_of_street',
      // These fields exist in 693u-uax6; order_number/sign_description do not and will be left blank in export
    ]
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
  streetParkingSigns: {
    // NYC Parking Regulation signs dataset (Socrata)
    // Replace with the correct dataset if different
    baseUrl: 'https://data.cityofnewyork.us/resource/hv9n-xgy4.geojson',
    geoField: 'point',
    isLocal: false,
    // Ensure required fields are selected for export table
    selectFields: [
      'order_number',
      'on_street',
      'from_street',
      'to_street',
      'side_of_street',
      'sign_description'
    ]
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

export const GEOGRAPHY_ENDPOINTS = {
  parks: '/data/permit-areas/nyc-permit-areas-minified.geojson',
  plazas: '/data/static/nyc_public_plazas_enriched.geojson',
  intersections: '/data/static/nyc_cscl_intersections.geojson'
};