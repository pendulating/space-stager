// constants/layers.js

// Define layer groups for organizing infrastructure layers
export const LAYER_GROUPS = {
  'amenities': {
    name: 'Amenities',
    icon: '🚻',
    layers: ['benches', 'publicRestrooms', 'linknycKiosks', 'trees']
  },
  'lanes': {
    name: 'Biking',
    icon: '🚴',
    layers: ['bikeLanes', 'bikeParking', 'citibikeStations']
  },
  'transit': {
    name: 'Transit',
    icon: '🚇',
    layers: ['subwayEntrances', 'stationEnvelopes', 'busStops']
  },
  'accessibility': {
    name: 'Accessibility',
    icon: '🚶',
    layers: ['accessiblePedSignals', 'pedestrianRamps', 'curbCuts']
  },
  'parking': {
    name: 'Parking',
    icon: '🚗',
    layers: ['parkingMeters', 'streetParkingSigns', 'dcwpParkingGarages', 'parkingLots']
  },
  'safety-features': {
    name: 'Safety Features',
    icon: '🛡️',
    layers: ['hydrants', 'iceLadders', 'fireLanes', 'specialDisasterRoutes']
  },
  'nyc-parks': {
    name: 'NYC Parks',
    icon: '🌳',
    layers: ['parksTrails', 'parksSigns', 'sprayShowers', 'drinkingFountains']
  }
};


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
    endpoint: '/api/bike-parking',
    enhancedRendering: {
      enabled: true,
      spriteBase: 'bike-rack',
      publicDir: '/data/icons/isometric-bw',
      desiredParallelTo: 'cscl',
      angles: [0, 45, 90, 135, 180, 225, 270, 315]
    }
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
    endpoint: '/api/parking-meters',
    enhancedRendering: {
      enabled: true,
      spriteBase: 'parking-meter',
      publicDir: '/data/icons/isometric-bw',
      desiredParallelTo: 'cscl',
      angles: [0, 45, 90, 135, 180, 225, 270, 315]
    }
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
    endpoint: '/api/linknyc-kiosks',
    // Pilot: enhanced isometric sprite rendering aligned to CSCL centerlines
    enhancedRendering: {
      enabled: true,
      spriteBase: 'linknyc', // expects {base}_{000|045|...}.png
      publicDir: '/data/icons/isometric-bw',
      desiredParallelTo: 'cscl',
      angles: [0, 45, 90, 135, 180, 225, 270, 315]
    }
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
    endpoint: '/api/trees',
    enhancedRendering: {
      enabled: true,
      spriteBase: 'tree_maple',
      publicDir: '/data/icons/isometric-bw',
      angles: [0, 45, 90, 135, 180, 225, 270, 315]
    }
  },
  hydrants: { 
    visible: false, 
    name: 'Fire Hydrants', 
    color: '#ef4444', 
    loading: false,
    loaded: false,
    endpoint: '/api/hydrants',
    enhancedRendering: {
      enabled: true,
      spriteBase: 'fire-hydrant',
      publicDir: '/data/icons/isometric-bw',
      angles: [0, 45, 90, 135, 180, 225, 270, 315]
    }
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
    endpoint: '/api/benches',
    enhancedRendering: {
      enabled: true,
      spriteBase: 'bench',
      publicDir: '/data/icons/isometric-bw',
      desiredParallelTo: 'cscl',
      angles: [0, 45, 90, 135, 180, 225, 270, 315]
    }
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