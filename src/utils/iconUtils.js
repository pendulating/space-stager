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
  // For zoom-independent sizing, use a small constant value that doesn't scale with zoom
  // This approach prevents the geographic scaling and keeps icons at screen pixel size
  return [
    "interpolate",
    ["linear"], ["zoom"],
    0, 0.02,
    16, 0.02,  // Smallest icon at minimum zoom
    20, 0.5,
    24, 0.5  // Same size at max zoom
  ] // Very small constant value to test visibility
};

// Check if a layer uses PNG icons
export const layerUsesPngIcon = (layerId) => {
  const icon = INFRASTRUCTURE_ICONS[layerId];
  return icon && icon.type === 'png';
};

// Add icons to Mapbox map
export const addIconsToMap = (map) => {
  console.log('[DEBUG] addIconsToMap called');
  
  if (!map || !map.isStyleLoaded()) {
    console.log('Map not ready for icons, will retry later');
    return false;
  }

  let allIconsLoaded = true;
  let iconsAdded = 0;
  
  console.log('[DEBUG] Starting to add icons to map');
  
  Object.entries(INFRASTRUCTURE_ICONS).forEach(([layerId, icon]) => {
    console.log(`[DEBUG] Processing icon for ${layerId}: ${icon.id}`);
    
    // Skip if icon already exists
    if (map.hasImage(icon.id)) {
      console.log(`Icon ${icon.id} already exists`);
      iconsAdded++;
      return;
    }

    let dataUrl;
    if (icon.type === 'svg') {
      dataUrl = svgToDataUrl(icon.svg);
      console.log(`[DEBUG] Created SVG data URL for ${icon.id}:`, dataUrl.substring(0, 100) + '...');
    } else if (icon.type === 'png') {
      dataUrl = icon.src;
      console.log(`[DEBUG] Using PNG source for ${icon.id}:`, dataUrl);
    }
    
    // Create an image element to load the icon
    const img = new Image();
    
    img.onload = () => {
      try {
        console.log(`[DEBUG] Image loaded for ${icon.id}, adding to map`);
        if (map.hasImage(icon.id)) {
          map.removeImage(icon.id);
        }
        map.addImage(icon.id, img);
        console.log(`Successfully added icon: ${icon.id}`);
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
  
  console.log(`[DEBUG] Icon loading complete. Icons added: ${iconsAdded}, all loaded: ${allIconsLoaded}`);
  return allIconsLoaded;
};

// Retry loading icons if they fail
export const retryLoadIcons = (map, maxRetries = 3) => {
  let retryCount = 0;
  
  const attemptLoad = () => {
    if (retryCount >= maxRetries) {
      console.error('Failed to load icons after maximum retries');
      return;
    }
    
    retryCount++;
    console.log(`Attempting to load icons (attempt ${retryCount}/${maxRetries})`);
    
    const success = addIconsToMap(map);
    if (!success) {
      setTimeout(attemptLoad, 1000); // Retry after 1 second
    }
  };
  
  attemptLoad();
}; 