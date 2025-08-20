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
  csclCenterlines: {
    // NYC CSCL - LION centerlines (same resource as fire lanes & special disaster routes)
    // Docs: https://dev.socrata.com/foundry/data.cityofnewyork.us/inkn-q76z
    baseUrl: 'https://data.cityofnewyork.us/resource/inkn-q76z.geojson',
    geoField: 'the_geom',
    isLocal: false
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
  streetParkingSigns: {
    // NYC DOT Parking Regulation Locations & Signs
    // Docs: https://dev.socrata.com/foundry/data.cityofnewyork.us/nfid-uabd
    baseUrl: 'https://data.cityofnewyork.us/resource/nfid-uabd.json',
    geoField: null,
    isLocal: false,
    selectFields: [
      'order_number', 'record_type', 'order_type', 'borough',
      'on_street', 'on_street_suffix', 'from_street', 'from_street_suffix',
      'to_street', 'to_street_suffix', 'side_of_street',
      'order_completed_on_date', 'sign_code', 'sign_description', 'sign_size',
      'sign_design_voided_on_date', 'sign_location', 'distance_from_intersection',
      'arrow_direction', 'facing_direction', 'sheeting_type', 'support',
      'sign_notes', 'sign_x_coord', 'sign_y_coord'
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
  },
  accessiblePedSignals: {
    // Accessible Pedestrian Signals (APS) Locations
    // Data: https://data.cityofnewyork.us/resource/de3m-c5p4.geojson
    baseUrl: 'https://data.cityofnewyork.us/resource/de3m-c5p4.geojson',
    geoField: 'the_geom',
    isLocal: false,
    selectFields: ['location', 'boroname', 'borough', 'date_insta']
  },
  curbCuts: {
    // NYC DOT Curb Cuts (2022) - ArcGIS FeatureServer
    // Example: https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_Cut_2022/FeatureServer/5/query?...&f=geojson
    baseUrl: 'https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_Cut_2022/FeatureServer/5/query',
    geoField: null,
    isLocal: false,
    selectFields: ['OBJECTID', 'SUB_FEATURE_CODE', 'STATUS']
  },
  dcwpParkingGarages: {
    // DCWP licensed businesses (Garage & Parking Lot). Points with latitude/longitude and BIN column
    baseUrl: 'https://data.cityofnewyork.us/resource/w7w3-xahh.json',
    isLocal: false,
    geoField: null,
    selectFields: [
      'business_category',
      'license_status',
      'bin',
      'latitude',
      'longitude',
      'business_name',
      'detail',
      'address_building',
      'address_street_name',
      'address_street_name_2',
      'address_borough'
    ]
  },
  stationEnvelopes: {
    // MTA Subway and Rail Station Envelopes (NY State open data)
    // Docs: https://dev.socrata.com/foundry/data.ny.gov/vkng-7ivg
    baseUrl: 'https://data.ny.gov/resource/vkng-7ivg.geojson',
    geoField: 'shape',
    isLocal: false,
    selectFields: [
      'station_name', 'agency', 'borough', 'shape_id'
    ]
  }
};

export const GEOGRAPHY_ENDPOINTS = {
  parks: '/data/permit-areas/nyc-permit-areas-minified.geojson',
  plazas: '/data/static/nyc_public_plazas_enriched.geojson',
  intersections: '/data/static/nyc_cscl_intersections.geojson'
};

// Supplemental datasets used during export (queried dynamically)
export const EXPORT_ENDPOINTS = {
  sidewalks: {
    baseUrl: 'https://data.cityofnewyork.us/resource/52n9-sdep.geojson',
    geoField: 'the_geom'
  }
};