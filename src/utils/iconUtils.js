// utils/iconUtils.js

// Icons for infrastructure layers (load from public/data/icons/layers/*.svg)
// We treat file-based SVGs as "png" type in our code paths so they render via <img> and load into Maplibre via Image().
export const INFRASTRUCTURE_ICONS = {
  trees: {
    id: 'tree-icon',
    type: 'png',
    src: '/data/icons/layers/tree.svg',
    areaScale: 1
  },
  hydrants: {
    id: 'hydrant-icon',
    type: 'png',
    src: '/data/icons/layers/fire-hydrant.svg',
    areaScale: 1
  },
  benches: {
    id: 'bench-icon',
    type: 'png',
    src: '/data/icons/layers/bench.svg',
    areaScale: 1
  },
  busStops: {
    id: 'bus-stop-icon',
    type: 'png',
    src: '/data/icons/layers/bus-stop.svg',
    areaScale: 1
  },
  bikeParking: {
    id: 'bike-parking-icon',
    type: 'png',
    src: '/data/icons/layers/bike-rack.svg',
    areaScale: 1
  },
  citibikeStations: {
    id: 'citibike-station-icon',
    type: 'png',
    src: '/data/icons/layers/citibike.svg',
    areaScale: 1
  },
  subwayEntrances: {
    id: 'subway-entrance-icon',
    type: 'png',
    src: '/data/icons/layers/subway-entrance.svg',
    areaScale: 1
  },
  fireLanes: {
    id: 'fire-lane-icon',
    type: 'png',
    src: '/data/icons/layers/parking.svg', // placeholder; lines use color, icon used only in panel
    areaScale: 1
  },
  specialDisasterRoutes: {
    id: 'special-disaster-route-icon',
    type: 'png',
    src: '/data/icons/layers/parking.svg', // placeholder
    areaScale: 1
  },
  pedestrianRamps: {
    id: 'pedestrian-ramp-icon',
    type: 'png',
    src: '/data/icons/layers/ped-ramp.svg',
    areaScale: 0.25
  },
  parkingMeters: {
    id: 'parking-meter-icon',
    type: 'png',
    src: '/data/icons/layers/parking-meter.svg',
    areaScale: 1
  },
  linknycKiosks: {
    id: 'linknyc-kiosk-icon',
    type: 'png',
    src: '/data/icons/layers/linknyc.svg',
    areaScale: 1
  },
  publicRestrooms: {
    id: 'public-restroom-icon',
    type: 'png',
    src: '/data/icons/layers/public-restroom.svg',
    areaScale: 1
  },
  drinkingFountains: {
    id: 'drinking-fountain-icon',
    type: 'png',
    src: '/data/icons/layers/drinking-fountain.svg',
    areaScale: 1
  },
  sprayShowers: {
    id: 'spray-shower-icon',
    type: 'png',
    src: '/data/icons/layers/spray-area.svg',
    areaScale: 1
  },
  iceLadders: {
    id: 'ice-ladder-icon',
    type: 'png',
    src: '/data/icons/layers/parking.svg', // placeholder
    areaScale: 1
  },
  parksSigns: {
    id: 'parks-sign-icon',
    type: 'png',
    src: '/data/icons/layers/park-sign.svg',
    areaScale: 1
  },
  streetParkingSigns: {
    id: 'street-parking-signs-icon',
    type: 'png',
    src: '/data/icons/layers/parking.svg',
    areaScale: 1
  }
};

// Convert SVG to data URL for Mapbox
export const svgToDataUrl = (svg) => {
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
};

// Get icon data URL for a specific layer
export const getIconDataUrl = (layerId) => {
  const icon = INFRASTRUCTURE_ICONS[layerId];
  if (!icon) return null;
  
  if (icon.type === 'svg') {
    return svgToDataUrl(icon.svg);
  } else if (icon.type === 'png') {
    return icon.src;
  }
  
  return null;
};

// Get zoom-independent icon size expression for PNG icons
export const getZoomIndependentIconSize = (baseSize) => {
  // Most of our layer icons are SVGs rasterized at large intrinsic sizes (e.g., 512px),
  // so Maplibre's icon-size must be quite small. Normalize the provided base into a small
  // scale and interpolate with zoom so icons are readable but not huge.
  const b = Math.max(0.01, Math.min(1, baseSize));
  const s = Math.max(0.01, Math.min(0.2, b * 0.04)); // 0.8 -> ~0.032
  return [
    'interpolate', ['linear'], ['zoom'],
    10, s * 0.7,
    12, s * 0.85,
    14, s,
    16, s * 2.6,
    18, s * 3.6,
    20, s * 4.6,
    22, s * 6.6,
    24, s * 8.6,
    30, s * 10.6
  ];
};

// Check if a layer uses PNG icons
export const layerUsesPngIcon = (layerId) => {
  const icon = INFRASTRUCTURE_ICONS[layerId];
  return icon && icon.type === 'png';
};

// Add icons to Mapbox map
// Track which icon ids we've already attempted to add (to reduce repeated work/logging)
const requestedIconIds = new Set();

export const addIconsToMap = (map, onlyLayerIds = null) => {
  if (!map) return false;
  const targetEntries = onlyLayerIds && Array.isArray(onlyLayerIds) && onlyLayerIds.length > 0
    ? Object.entries(INFRASTRUCTURE_ICONS).filter(([layerId]) => onlyLayerIds.includes(layerId))
    : Object.entries(INFRASTRUCTURE_ICONS);
  // Only log when truly adding new icons
  
  if (!map.isStyleLoaded || !map.isStyleLoaded()) {
    // Map not ready yet
    return false;
  }

  let allIconsLoaded = true;
  let iconsAdded = 0;

  targetEntries.forEach(([layerId, icon]) => {
    
    // Skip if icon already exists
    if (map.hasImage(icon.id)) {
      iconsAdded++;
      return;
    }

    if (requestedIconIds.has(icon.id)) {
      // Already requested/attempted; skip duplicate work
      return;
    }

    let dataUrl;
    if (icon.type === 'svg') {
      dataUrl = svgToDataUrl(icon.svg);
    } else if (icon.type === 'png') {
      dataUrl = icon.src;
    }
    
    // Create an image element to load the icon
    const img = new Image();
    requestedIconIds.add(icon.id);
    
    img.onload = () => {
      try {
        if (map.hasImage(icon.id)) {
          map.removeImage(icon.id);
        }
        map.addImage(icon.id, img);
        iconsAdded++;
      } catch (error) {
        console.error(`Error adding icon ${icon.id}:`, error);
        allIconsLoaded = false;
      }
    };
    
    img.onerror = (error) => {
      console.error(`Failed to load icon ${icon.id}:`, error);
      allIconsLoaded = false;
    };
    
    img.src = dataUrl;
  });
  
  return allIconsLoaded;
};

// Retry loading icons if they fail
export const retryLoadIcons = (map, maxRetries = 3, layerIds = null) => {
  let retryCount = 0;
  
  const attemptLoad = () => {
    if (retryCount >= maxRetries) {
      console.error('Failed to load icons after maximum retries');
      return;
    }
    
    retryCount++;
    const success = addIconsToMap(map, layerIds);
    if (!success) {
      setTimeout(attemptLoad, 1000); // Retry after 1 second
    }
  };
  
  attemptLoad();
}; 