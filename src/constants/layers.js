// constants/layers.js

// Define layer groups for organizing infrastructure layers
export const LAYER_GROUPS = {
  'public-infrastructure': {
    name: 'Public Infrastructure',
    icon: '🏛️',
    layers: ['hydrants', 'busStops', 'subwayEntrances', 'stationEnvelopes', 'accessiblePedSignals', 'curbCuts', 'dcwpParkingGarages', 'benches', 'publicRestrooms', 'drinkingFountains', 'sprayShowers', 'linknycKiosks', 'parkingMeters', 'streetParkingSigns', 'pedestrianRamps']
  },
  'lanes': {
    name: 'Lanes',
    icon: '🚴',
    layers: ['bikeLanes', 'bikeParking', 'citibikeStations', 'parkingLots']
  },
  'safety-features': {
    name: 'Safety Features',
    icon: '🛡️',
    layers: ['iceLadders', 'fireLanes', 'specialDisasterRoutes']
  },
  'nyc-parks': {
    name: 'NYC Parks',
    icon: '🌳',
    layers: ['trees', 'parksTrails', 'parksSigns']
  }
};

// Define the starter set of layers that are most useful for average users
export const STARTER_SET_LAYERS = [
  'trees',
  'hydrants',
  'busStops',
  'subwayEntrances',
  'benches',
  'bikeParking',
  'citibikeStations',
  'publicRestrooms'
];

export const INITIAL_LAYERS = {
  permitAreas: { 
    visible: true, 
    name: 'Zone', 
    color: '#f97316', 
    loading: true, 
    loaded: false,
    id: 'permit-areas' 
  },
  bikeLanes: { 
    visible: false, 
    name: 'Bike Lanes', 
    color: '#b2c5a5', 
    loading: false,
    loaded: false,
    endpoint: '/api/bike-lanes' // Add API endpoint
  },
  bikeParking: {
    visible: false,
    name: 'Bike Parking',
    color: '#b2c5a5',
    loading: false,
    loaded: false,
    endpoint: '/api/bike-parking'
  },
  citibikeStations: {
    visible: false,
    name: 'Citibike Stations',
    color: '#0ea5e9',
    loading: false,
    loaded: false,
    endpoint: '/api/citibike-stations'
  },
  subwayEntrances: {
    visible: false,
    name: 'Subway Entrances',
    color: '#dc2626',
    loading: false,
    loaded: false,
    endpoint: '/api/subway-entrances'
  },
  fireLanes: {
    visible: false,
    name: 'Fire Lanes',
    color: '#ef4444',
    loading: false,
    loaded: false,
    endpoint: '/api/fire-lanes'
  },
  specialDisasterRoutes: {
    visible: false,
    name: 'Special Disaster Routes',
    color: '#f59e0b',
    loading: false,
    loaded: false,
    endpoint: '/api/special-disaster-routes'
  },
  pedestrianRamps: {
    visible: false,
    name: 'Pedestrian Ramps',
    color: '#8b5cf6',
    loading: false,
    loaded: false,
    endpoint: '/api/pedestrian-ramps'
  },
  parkingMeters: {
    visible: false,
    name: 'Parking Meters',
    color: '#f59e0b',
    loading: false,
    loaded: false,
    endpoint: '/api/parking-meters'
  },
  streetParkingSigns: {
    visible: false,
    name: 'Street Parking Regulations',
    color: '#111827',
    loading: false,
    loaded: false,
    endpoint: '/api/street-parking-signs'
  },
  linknycKiosks: {
    visible: false,
    name: 'LinkNYC Kiosks',
    color: '#06b6d4',
    loading: false,
    loaded: false,
    endpoint: '/api/linknyc-kiosks'
  },
  publicRestrooms: {
    visible: false,
    name: 'Public Restrooms',
    color: '#8b5cf6',
    loading: false,
    loaded: false,
    endpoint: '/api/public-restrooms'
  },
  drinkingFountains: {
    visible: false,
    name: 'Drinking Fountains',
    color: '#0891b2',
    loading: false,
    loaded: false,
    endpoint: '/api/drinking-fountains'
  },
  sprayShowers: {
    visible: false,
    name: 'Spray Showers',
    color: '#0ea5e9',
    loading: false,
    loaded: false,
    endpoint: '/api/spray-showers'
  },
  parksTrails: {
    visible: false,
    name: 'Parks Trails',
    color: '#059669',
    loading: false,
    loaded: false,
    endpoint: '/api/parks-trails'
  },
  parkingLots: {
    visible: false,
    name: 'Parking Lots',
    color: '#dc2626',
    loading: false,
    loaded: false,
    endpoint: '/api/parking-lots'
  },
  iceLadders: {
    visible: false,
    name: 'Ice Ladders',
    color: '#0ea5e9',
    loading: false,
    loaded: false,
    endpoint: '/api/ice-ladders'
  },
  parksSigns: {
    visible: false,
    name: 'Parks Signs',
    color: '#7c3aed',
    loading: false,
    loaded: false,
    endpoint: '/api/parks-signs'
  },
  trees: { 
    visible: false, 
    name: 'Trees', 
    color: '#22c55e', 
    loading: false,
    loaded: false,
    endpoint: '/api/trees'
  },
  hydrants: { 
    visible: false, 
    name: 'Fire Hydrants', 
    color: '#ef4444', 
    loading: false,
    loaded: false,
    endpoint: '/api/hydrants'
  },

  busStops: { 
    visible: false, 
    name: 'Bus Stops', 
    color: '#dc2626', 
    loading: false,
    loaded: false,
    endpoint: '/api/bus-stops'
  },
  benches: { 
    visible: false, 
    name: 'Benches', 
    color: '#8b5cf6', 
    loading: false,
    loaded: false,
    endpoint: '/api/benches'
  },
  stationEnvelopes: {
    visible: false,
    name: 'Transit Station Envelopes',
    color: '#10b981',
    loading: false,
    loaded: false,
    endpoint: '/api/station-envelopes'
  },
  accessiblePedSignals: {
    visible: false,
    name: 'Accessible Ped Signals',
    color: '#eab308',
    loading: false,
    loaded: false,
    endpoint: '/api/accessible-ped-signals'
  },
  curbCuts: {
    visible: false,
    name: 'Curb Cuts',
    color: '#ef4444',
    loading: false,
    loaded: false,
    endpoint: '/api/curb-cuts'
  },
  dcwpParkingGarages: {
    visible: false,
    name: 'DCWP Parking Garages',
    color: '#3b82f6',
    loading: false,
    loaded: false,
    endpoint: '/api/dcwp-parking-garages'
  }
};