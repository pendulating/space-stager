// utils/iconUtils.js

// SVG icons for infrastructure layers
export const INFRASTRUCTURE_ICONS = {
  trees: {
    id: 'tree-icon',
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L8 8H10V14H14V8H16L12 2Z" fill="currentColor"/>
      <path d="M8 14C8 16.2091 9.79086 18 12 18C14.2091 18 16 16.2091 16 14H8Z" fill="currentColor"/>
      <circle cx="12" cy="6" r="2" fill="currentColor"/>
    </svg>`
  },
  hydrants: {
    id: 'hydrant-icon',
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="4" width="4" height="16" fill="currentColor"/>
      <rect x="8" y="8" width="8" height="2" fill="currentColor"/>
      <rect x="6" y="12" width="12" height="2" fill="currentColor"/>
      <rect x="4" y="16" width="16" height="2" fill="currentColor"/>
      <circle cx="12" cy="6" r="1" fill="white"/>
    </svg>`
  },
  benches: {
    id: 'bench-icon',
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="16" width="16" height="2" fill="currentColor"/>
      <rect x="6" y="14" width="12" height="2" fill="currentColor"/>
      <rect x="8" y="12" width="8" height="2" fill="currentColor"/>
      <rect x="4" y="10" width="2" height="6" fill="currentColor"/>
      <rect x="18" y="10" width="2" height="6" fill="currentColor"/>
    </svg>`
  },
  busStops: {
    id: 'bus-stop-icon',
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="8" width="12" height="8" fill="currentColor"/>
      <rect x="8" y="10" width="8" height="4" fill="white"/>
      <circle cx="12" cy="12" r="1" fill="currentColor"/>
      <rect x="10" y="16" width="4" height="2" fill="currentColor"/>
    </svg>`
  },
  parking: {
    id: 'parking-icon',
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="16" height="16" fill="currentColor"/>
      <path d="M8 8H12C13.1046 8 14 8.89543 14 10V14C14 15.1046 13.1046 16 12 16H8V8Z" fill="white"/>
      <path d="M10 10V14H12C12.5523 14 13 13.5523 13 13V11C13 10.4477 12.5523 10 12 10H10Z" fill="currentColor"/>
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
  return svgToDataUrl(icon.svg);
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

    const dataUrl = svgToDataUrl(icon.svg);
    console.log(`[DEBUG] Created data URL for ${icon.id}:`, dataUrl.substring(0, 100) + '...');
    
    // Create an image element to load the SVG
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