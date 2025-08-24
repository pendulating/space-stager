// utils/mapUtils.js
import { MAP_LIBRARIES, MAP_CONFIG, NYC_BASEMAPS, BASEMAP_OPTIONS } from '../constants/mapConfig';

export const loadCSS = () => {
  const cssLinks = [
    { id: 'maplibre-gl.css', href: MAP_LIBRARIES.maplibre.css },
    { id: 'mapbox-gl-draw.css', href: MAP_LIBRARIES.draw.css },
  ];
  if (!MAP_LIBRARIES.searchBox.optional) {
    cssLinks.push({ id: 'maplibre-search-box.css', href: MAP_LIBRARIES.searchBox.css });
  }

  cssLinks.forEach(({ id, href }) => {
    if (!document.querySelector(`link[href*="${id}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
      console.log(`Added ${id}`);
    }
  });
};

export const loadScript = (src, checkFn) => {
  return new Promise((resolve, reject) => {
    if (checkFn && checkFn()) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

export const loadMapLibraries = async () => {
  loadCSS();

  // Load MapLibre first
  await loadScript(MAP_LIBRARIES.maplibre.js, () => window.maplibregl);
  console.log('MapLibre loaded');

  // Load other libraries in parallel
  const loaders = [loadScript(MAP_LIBRARIES.draw.js, () => window.MapboxDraw)];
  if (!MAP_LIBRARIES.searchBox.optional) {
    loaders.push(loadScript(MAP_LIBRARIES.searchBox.js, () => window.maplibreSearchBox));
  }
  await Promise.all(loaders);
  console.log('All libraries loaded');
};

export const initializeMap = async (container) => {
  const envStyleUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_MAP_STYLE_URL)
    ? import.meta.env.VITE_MAP_STYLE_URL
    : null;
  // Prefer dark style if theme is dark and no explicit env style is set
  const prefersDark = (() => {
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (_) {
      return false;
    }
  })();
  const styleUrl = envStyleUrl || (prefersDark ? BASEMAP_OPTIONS.carto.darkUrl : BASEMAP_OPTIONS.carto.url);

  const mapInstance = new window.maplibregl.Map({
    container,
    style: styleUrl,
    center: MAP_CONFIG.center,
    zoom: MAP_CONFIG.zoom,
    preserveDrawingBuffer: MAP_CONFIG.preserveDrawingBuffer,
    transformRequest: (url, resourceType) => {
      try {
        // Only touch our permit-areas GeoJSON and avoid breaking tiles/fonts/sprites
        if (typeof url === 'string' && url.includes('/data/permit-areas/')) {
          const u = new URL(url, window.location.origin);
          // Append cache-busting timestamp
          u.searchParams.set('_ts', String(Date.now()));
          return {
            url: u.toString(),
            headers: {
              'Cache-Control': 'no-cache, no-store, max-age=0',
              Pragma: 'no-cache'
            }
          };
        }
      } catch (_) {
        // noop
      }
      return { url };
    }
  });

  return new Promise((resolve, reject) => {
    mapInstance.on('load', () => {
      // Add controls
      mapInstance.addControl(new window.maplibregl.NavigationControl(), 'top-right');
      mapInstance.addControl(new window.maplibregl.ScaleControl(), 'bottom-right');

      // Add search control if available (default placeholder)
      if (window.maplibreSearchBox) {
        const searchControl = new window.maplibreSearchBox.MapLibreSearchControl({
          useMapFocusPoint: true,
          mapFocusPointMinZoom: 10,
          maxResults: 5,
          minInputLength: 2,
          searchOnEnter: true
        });
        mapInstance.addControl(searchControl, 'top-left');

        // Move the search box to top-center of the map
        try {
          const mapEl = mapInstance.getContainer();
          let attempts = 0;
          const maxAttempts = 30;
          const attachTopCenter = () => {
            // The control container typically has class 'maplibregl-ctrl' and contains '.maplibre-searchbox'
            const ctrlInner = mapEl.querySelector('.maplibre-searchbox');
            const ctrlContainer = ctrlInner ? ctrlInner.closest('.maplibregl-ctrl') : null;
            if (ctrlContainer) {
              // Ensure a single top-center wrapper exists
              let wrapper = mapEl.querySelector('#maplibre-top-center');
              if (!wrapper) {
                wrapper = document.createElement('div');
                wrapper.id = 'maplibre-top-center';
                wrapper.style.position = 'absolute';
                wrapper.style.top = '10px';
                wrapper.style.left = '50%';
                wrapper.style.transform = 'translateX(-50%)';
                wrapper.style.zIndex = '5';
                wrapper.style.pointerEvents = 'none';
                mapEl.appendChild(wrapper);
              }
              // Allow interaction with the control inside
              ctrlContainer.style.pointerEvents = 'auto';
              // Remove default margins so it's centered neatly
              ctrlContainer.style.margin = '0';
              // Move the control into the wrapper
              wrapper.appendChild(ctrlContainer);
              return;
            }
            if (attempts++ < maxAttempts) setTimeout(attachTopCenter, 100);
          };
          attachTopCenter();
        } catch (_) {}
      }

      // Track current base style
      mapInstance.__currentBasemap = 'carto';
      mapInstance.__currentCartoStyleUrl = styleUrl;

      resolve(mapInstance);
    });

    mapInstance.on('error', reject);
  });
};

export const getMetersPerPixel = (map) => {
  const zoom = map.getZoom();
  const lat = map.getCenter().lat;
  return 40075016.686 * Math.abs(Math.cos(lat * Math.PI / 180)) / Math.pow(2, zoom + 8);
};

export const getSafeFilename = (name) => {
  const safeName = (name || 'unnamed').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const date = new Date().toISOString().split('T')[0];
  return `${safeName}-${date}`;
};

export const createNYCBasemapStyle = (basemapType = '2018') => {
  console.log(`createNYCBasemapStyle: Creating style for ${basemapType}`);
  
  const basemap = NYC_BASEMAPS[basemapType];
  if (!basemap) {
    console.warn(`Unknown basemap type: ${basemapType}, falling back to 2018`);
    return createNYCBasemapStyle('2018');
  }

  console.log(`createNYCBasemapStyle: Using basemap config:`, basemap);

  // Create subdomain URLs for the satellite layer
  const satelliteUrls = basemap.subdomains.split('').map(sub => 
    basemap.url.replace('{s}', sub)
  );
  
  // Create subdomain URLs for the label layer
  const labelUrls = basemap.subdomains.split('').map(sub => 
    basemap.labelUrl.replace('{s}', sub)
  );

  console.log(`createNYCBasemapStyle: Satellite URLs:`, satelliteUrls);
  console.log(`createNYCBasemapStyle: Label URLs:`, labelUrls);

  const style = {
    version: 8,
    name: `NYC ${basemapType}`,
    sources: {
      'nyc-satellite': {
        type: 'raster',
        tiles: satelliteUrls,
        tileSize: 256,
        minzoom: 8,
        bounds: [-74.25909, 40.477399, -73.700181, 40.916178] // NYC bounds
      },
      'nyc-labels': {
        type: 'raster',
        tiles: labelUrls,
        tileSize: 256,
        minzoom: 8,
        bounds: [-74.25909, 40.477399, -73.700181, 40.916178] // NYC bounds
      }
    },
    layers: [
      {
        id: 'nyc-satellite-layer',
        type: 'raster',
        source: 'nyc-satellite',
        minzoom: 8,
        paint: {
          'raster-opacity': 1,
          'raster-resampling': 'linear'
        }
      },
      {
        id: 'nyc-labels-layer',
        type: 'raster',
        source: 'nyc-labels',
        minzoom: 8,
        paint: {
          'raster-opacity': 1,
          'raster-resampling': 'linear'
        }
      }
    ]
  };

  console.log(`createNYCBasemapStyle: Created style:`, style);
  return style;
};

export const switchBasemap = (map, basemapKey, onStyleChange) => {
  return new Promise((resolve, reject) => {
    if (!map) {
      reject(new Error('Map instance not provided'));
      return;
    }
    
    console.log(`switchBasemap: Starting switch to ${basemapKey}`);
    
    // Handle theme-driven Carto style switches without consulting BASEMAP_OPTIONS
    if (basemapKey === 'carto-dark' || basemapKey === 'carto-light') {
      const desiredUrl = basemapKey === 'carto-dark' ? BASEMAP_OPTIONS.carto.darkUrl : BASEMAP_OPTIONS.carto.url;

      // Remove NYC satellite overlay if present and restore hidden base layers before switching styles
      try {
        if (map.getLayer('nyc-satellite-layer')) {
          map.removeLayer('nyc-satellite-layer');
        }
        if (map.getSource('nyc-satellite')) {
          map.removeSource('nyc-satellite');
        }
      } catch (_) {}
      try {
        if (map.__basemapState?.hiddenLayers?.length) {
          map.__basemapState.hiddenLayers.forEach(({ id, visibility }) => {
            try { map.setLayoutProperty(id, 'visibility', visibility); } catch (_) {}
          });
          map.__basemapState.hiddenLayers = [];
        }
      } catch (_) {}

      console.log(`switchBasemap: Setting Carto style to ${basemapKey}`);
      // Preserve camera
      const center = map.getCenter();
      const zoom = map.getZoom();
      const bearing = map.getBearing();
      const pitch = map.getPitch();

      let timeoutId;
      const onStyleLoaded = () => {
        map.off('style.load', onStyleLoaded);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        try {
          map.jumpTo({ center, zoom, bearing, pitch });
        } catch (_) {}
        map.__currentCartoStyleUrl = desiredUrl;
        map.__currentBasemap = 'carto';
        if (onStyleChange) onStyleChange({ type: 'style' });
        resolve();
      };
      // Fallback in case style.load doesn't fire (rare) — schedule BEFORE setStyle
      timeoutId = setTimeout(() => {
        console.warn('switchBasemap: style.load timeout, proceeding with rehydration fallback');
        onStyleLoaded();
      }, 2500);
      map.once('style.load', onStyleLoaded);
      try {
        map.setStyle(desiredUrl, { diff: false });
      } catch (_) {
        map.setStyle(desiredUrl);
      }
      return;
    }

    const basemapOption = BASEMAP_OPTIONS[basemapKey];
    if (!basemapOption) {
      reject(new Error(`Unknown basemap key: ${basemapKey}`));
      return;
    }
    
    console.log(`switchBasemap: Using basemap option:`, basemapOption);
    
    // Store current view state
    const center = map.getCenter();
    const zoom = map.getZoom();
    const bearing = map.getBearing();
    const pitch = map.getPitch();
    
    console.log(`switchBasemap: Current view state:`, { center, zoom, bearing, pitch });
    
    try {
      if (basemapKey === 'satellite') {
        // For satellite, try to add NYC satellite layer on top of existing style
        console.log(`switchBasemap: Adding NYC satellite layer to existing style`);
        
        const basemap = NYC_BASEMAPS['2018'];
        const satelliteUrls = basemap.subdomains.split('').map(sub => 
          basemap.url.replace('{s}', sub)
        );
        
        // Remove existing NYC layers if they exist
        try {
          if (map.getLayer('nyc-satellite-layer')) {
            map.removeLayer('nyc-satellite-layer');
          }
          if (map.getSource('nyc-satellite')) {
            map.removeSource('nyc-satellite');
          }
        } catch (e) {
          // Ignore errors if layers don't exist
        }
        
        // Add NYC satellite source and layer FIRST
        try {
          map.addSource('nyc-satellite', {
            type: 'raster',
            tiles: satelliteUrls,
            tileSize: 256,
            minzoom: 8,
            bounds: [-74.25909, 40.477399, -73.700181, 40.916178] // NYC bounds
          });
          // Insert below the first symbol layer so labels/roads remain on top
          const style = map.getStyle();
          // Prefer placing satellite beneath active geography fill if present, else at the very bottom (above background)
          const beforeId = map.getLayer('permit-areas-fill')
            ? 'permit-areas-fill'
            : (map.getLayer('plaza-areas-fill') ? 'plaza-areas-fill' : (style.layers?.find(l => l.type !== 'background')?.id));
          map.addLayer({
            id: 'nyc-satellite-layer',
            type: 'raster',
            source: 'nyc-satellite',
            minzoom: 8,
            paint: {
              'raster-opacity': 1,
              'raster-resampling': 'linear'
            }
          }, beforeId);
          
          console.log(`switchBasemap: Successfully added NYC satellite layer`);
        } catch (e) {
          console.error(`switchBasemap: Error adding satellite layer:`, e);
          reject(e);
          return;
        }
        
        // Snapshot and hide base fill/background/raster layers (keep lines/symbols and app overlays)
        try {
          const style2 = map.getStyle();
          const hidden = [];
          style2.layers?.forEach(layer => {
            const id = layer.id;
            if (
              id === 'nyc-satellite-layer' ||
              id.startsWith('permit-areas') ||
              id.startsWith('plaza-areas') ||
              id.startsWith('zone-creator') ||
              id.startsWith('mapbox-gl-draw') ||
              id.startsWith('gl-draw')
            ) {
              return;
            }
            // Hide only background/fill/raster/hillshade to let satellite show through
            if (['background', 'fill', 'raster', 'hillshade'].includes(layer.type)) {
              try {
                const prev = map.getLayoutProperty(id, 'visibility') || 'visible';
                if (prev !== 'none') {
                  hidden.push({ id, visibility: prev });
                  map.setLayoutProperty(id, 'visibility', 'none');
                }
              } catch (_) {
                // ignore
              }
            }
            
            // Also hide road network layers (line type) but keep road labels (symbol type)
            if (layer.type === 'line' && (
              id.includes('road') || 
              id.includes('highway') || 
              id.includes('transportation') || 
              id.includes('street') ||
              id.includes('motorway') ||
              id.includes('trunk') ||
              id.includes('primary') ||
              id.includes('secondary') ||
              id.includes('tertiary') ||
              id.includes('residential')
            )) {
              try {
                const prev = map.getLayoutProperty(id, 'visibility') || 'visible';
                if (prev !== 'none') {
                  hidden.push({ id, visibility: prev });
                  map.setLayoutProperty(id, 'visibility', 'none');
                }
              } catch (_) {
                // ignore
              }
            }
          });
          map.__basemapState = map.__basemapState || {};
          map.__basemapState.hiddenLayers = hidden;
          console.log(`switchBasemap: Snapshot/hid ${hidden.length} base layers`);
        } catch (e) {
          console.error(`switchBasemap: Error snapshotting/hiding base layers:`, e);
        }
        
        if (onStyleChange && typeof onStyleChange === 'function') {
          setTimeout(() => {
            onStyleChange({ type: 'overlay' });
          }, 100);
        }
        
        resolve();
        
      } else if (basemapKey === 'carto') {
        // For carto, remove satellite and restore any hidden layers from snapshot; avoid style reload
        console.log(`switchBasemap: Switching back to carto style (restore snapshot)`);
        try {
          if (map.__basemapState?.hiddenLayers?.length) {
            map.__basemapState.hiddenLayers.forEach(({ id, visibility }) => {
              try { map.setLayoutProperty(id, 'visibility', visibility); } catch (_) {}
            });
            console.log(`switchBasemap: Restored ${map.__basemapState.hiddenLayers.length} hidden layers`);
          }
          // Clear snapshot
          if (map.__basemapState) map.__basemapState.hiddenLayers = [];
        } catch (e) {
          console.error(`switchBasemap: Error restoring hidden layers:`, e);
        }

        // Remove NYC satellite overlay
        try {
          if (map.getLayer('nyc-satellite-layer')) {
            map.removeLayer('nyc-satellite-layer');
          }
          if (map.getSource('nyc-satellite')) {
            map.removeSource('nyc-satellite');
          }
        } catch (e) {
          console.log(`switchBasemap: Error removing satellite layers:`, e);
        }

        // If dark mode is active, ensure Carto dark style is applied; otherwise light
        const prefersDark = (() => {
          try {
            return document.documentElement.classList.contains('dark');
          } catch (_) { return false; }
        })();
        const desiredUrl = prefersDark ? BASEMAP_OPTIONS.carto.darkUrl : BASEMAP_OPTIONS.carto.url;
        const currentUrl = map.__currentCartoStyleUrl || '';
        if (currentUrl !== desiredUrl) {
          console.log('switchBasemap: Adjusting Carto base style to match theme');
          const center = map.getCenter();
          const zoom = map.getZoom();
          const bearing = map.getBearing();
          const pitch = map.getPitch();
          const onStyleLoaded = () => {
            map.off('style.load', onStyleLoaded);
            try { map.jumpTo({ center, zoom, bearing, pitch }); } catch (_) {}
            map.__currentCartoStyleUrl = desiredUrl;
            map.__currentBasemap = 'carto';
            if (onStyleChange) onStyleChange({ type: 'style' });
            resolve();
          };
          map.once('style.load', onStyleLoaded);
          try {
            map.setStyle(desiredUrl, { diff: false });
          } catch (_) {
            map.setStyle(desiredUrl);
          }
        } else {
          // Notify overlay change only (no full style reload)
          if (onStyleChange && typeof onStyleChange === 'function') {
            setTimeout(() => onStyleChange({ type: 'overlay' }), 100);
          }
          console.log(`switchBasemap: Successfully restored carto without style reload`);
          resolve();
        }
      }
      
    } catch (error) {
      console.error(`switchBasemap: Error in basemap switch:`, error);
      reject(error);
    }
  });
};