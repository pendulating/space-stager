// constants/layers.js
export const INITIAL_LAYERS = {
  permitAreas: { 
    visible: true, 
    name: 'NYC Permit Areas', 
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
  parking: { 
    visible: false, 
    name: 'Parking Meters', 
    color: '#3b82f6', 
    loading: false,
    loaded: false,
    endpoint: '/api/parking'
  },
  busStops: { 
    visible: false, 
    name: 'Bus Stops', 
    color: '#dc2626', 
    loading: false,
    loaded: false,
    endpoint: '/api/bus-stops'
  }
};