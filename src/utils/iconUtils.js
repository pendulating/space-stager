// utils/iconUtils.js

// Icons for infrastructure layers (supports both SVG and PNG)
export const INFRASTRUCTURE_ICONS = {
  trees: {
    id: 'tree-icon',
    type: 'png',
    src: '/data/icons/street-tree.png'
  },
  hydrants: {
    id: 'hydrant-icon',
    type: 'png',
    src: '/data/icons/fire-hydrant.png'
  },
  benches: {
    id: 'bench-icon',
    type: 'png',
    src: '/data/icons/bench.png'
  },
  busStops: {
    id: 'bus-stop-icon',
    type: 'svg',
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="8" width="12" height="8" fill="currentColor"/>
      <rect x="8" y="10" width="8" height="4" fill="white"/>
      <circle cx="12" cy="12" r="1" fill="currentColor"/>
      <rect x="10" y="16" width="4" height="2" fill="currentColor"/>
    </svg>`
  },
  parking: {
    id: 'parking-icon',
    type: 'svg',
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="16" height="16" fill="currentColor"/>
      <path d="M8 8H12C13.1046 8 14 8.89543 14 10V14C14 15.1046 13.1046 16 12 16H8V8Z" fill="white"/>
      <path d="M10 10V14H12C12.5523 14 13 13.5523 13 13V11C13 10.4477 12.5523 10 12 10H10Z" fill="currentColor"/>
    </svg>`
  },
  bikeParking: {
    id: 'bike-parking-icon',
    type: 'png',
    src: '/data/icons/bike-parking.png'
  },
  pedestrianRamps: {
    id: 'pedestrian-ramp-icon',
    type: 'svg',
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 20L20 20L20 4L4 4L4 20Z" fill="currentColor"/>
      <path d="M6 18L18 18L18 6L6 6L6 18Z" fill="white"/>
      <path d="M8 16L16 16L16 8L8 8L8 16Z" fill="currentColor"/>
      <path d="M10 14L14 14L14 10L10 10L10 14Z" fill="white"/>
      <path d="M12 12L12 12" stroke="currentColor" stroke-width="2"/>
    </svg>`
  },
  parkingMeters: {
    id: 'parking-meter-icon',
    type: 'svg',
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="4" width="8" height="16" fill="currentColor"/>
      <rect x="10" y="6" width="4" height="12" fill="white"/>
      <circle cx="12" cy="10" r="1" fill="currentColor"/>
      <circle cx="12" cy="14" r="1" fill="currentColor"/>
      <rect x="11" y="16" width="2" height="2" fill="currentColor"/>
    </svg>`
  },
  linknycKiosks: {
    id: 'linknyc-kiosk-icon',
    type: 'png',
    src: '/data/icons/linknyc.png'
  },
  publicRestrooms: {
    id: 'public-restroom-icon',
    type: 'svg',
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="16" height="16" fill="currentColor"/>
      <rect x="6" y="6" width="12" height="12" fill="white"/>
      <circle cx="9" cy="10" r="1.5" fill="currentColor"/>
      <circle cx="15" cy="10" r="1.5" fill="currentColor"/>
      <rect x="8" y="12" width="2" height="4" fill="currentColor"/>
      <rect x="14" y="12" width="2" height="4" fill="currentColor"/>
      <rect x="7" y="16" width="3" height="2" fill="currentColor"/>
      <rect x="14" y="16" width="3" height="2" fill="currentColor"/>
    </svg>`
  },
  drinkingFountains: {
    id: 'drinking-fountain-icon',
    type: 'svg',
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="4" width="8" height="16" fill="currentColor"/>
      <rect x="10" y="6" width="4" height="12" fill="white"/>
      <circle cx="12" cy="8" r="1" fill="currentColor"/>
      <rect x="11" y="10" width="2" height="6" fill="currentColor"/>
      <rect x="10" y="16" width="4" height="2" fill="currentColor"/>
      <rect x="9" y="18" width="6" height="2" fill="currentColor"/>
    </svg>`
  },
  sprayShowers: {
    id: 'spray-shower-icon',
    type: 'svg',
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8" r="3" fill="currentColor"/>
      <rect x="10" y="11" width="4" height="8" fill="currentColor"/>
      <rect x="11" y="19" width="2" height="3" fill="currentColor"/>
      <circle cx="8" cy="6" r="1" fill="white"/>
      <circle cx="16" cy="6" r="1" fill="white"/>
      <circle cx="10" cy="10" r="1" fill="white"/>
      <circle cx="14" cy="10" r="1" fill="white"/>
      <path d="M6 4 L8 6 M18 4 L16 6 M6 12 L8 10 M18 12 L16 10" stroke="currentColor" stroke-width="1" fill="none"/>
    </svg>`
  },
  iceLadders: {
    id: 'ice-ladder-icon',
    type: 'svg',
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="4" width="8" height="16" fill="currentColor"/>
      <rect x="10" y="6" width="4" height="12" fill="white"/>
      <rect x="11" y="8" width="2" height="2" fill="currentColor"/>
      <rect x="11" y="12" width="2" height="2" fill="currentColor"/>
      <rect x="11" y="16" width="2" height="2" fill="currentColor"/>
      <rect x="9" y="20" width="6" height="2" fill="currentColor"/>
      <path d="M6 6 L8 8 M18 6 L16 8 M6 18 L8 16 M18 18 L16 16" stroke="currentColor" stroke-width="1" fill="none"/>
    </svg>`
  },
  parksSigns: {
    id: 'parks-sign-icon',
    type: 'svg',
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="4" width="12" height="16" fill="currentColor"/>
      <rect x="8" y="6" width="8" height="12" fill="white"/>
      <rect x="10" y="8" width="4" height="2" fill="currentColor"/>
      <rect x="10" y="12" width="4" height="2" fill="currentColor"/>
      <rect x="10" y="16" width="4" height="2" fill="currentColor"/>
      <rect x="9" y="20" width="6" height="2" fill="currentColor"/>
      <circle cx="12" cy="11" r="1" fill="currentColor"/>
    </svg>`
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