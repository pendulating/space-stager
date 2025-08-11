// utils/mapUtils.js
import { MAP_LIBRARIES, MAP_CONFIG, NYC_BASEMAPS, BASEMAP_OPTIONS } from '../constants/mapConfig';

export const loadCSS = () => {
  const cssLinks = [
    { id: 'maplibre-gl.css', href: MAP_LIBRARIES.maplibre.css },
    { id: 'mapbox-gl-draw.css', href: MAP_LIBRARIES.draw.css },
    { id: 'maplibre-search-box.css', href: MAP_LIBRARIES.searchBox.css }
  ];

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
  await Promise.all([
    loadScript(MAP_LIBRARIES.draw.js, () => window.MapboxDraw),
    loadScript(MAP_LIBRARIES.searchBox.js, () => window.maplibreSearchBox)
  ]);
  console.log('All libraries loaded');
};

export const initializeMap = async (container) => {
  const mapInstance = new window.maplibregl.Map({
    container,
    style: BASEMAP_OPTIONS.carto.url,
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

      // Add search control if available
      if (window.maplibreSearchBox) {
        const searchControl = new window.maplibreSearchBox.MapLibreSearchControl({
          useMapFocusPoint: true,
          mapFocusPointMinZoom: 10,
          maxResults: 5,
          minInputLength: 2,
          searchOnEnter: true
        });
        mapInstance.addControl(searchControl, 'top-left');
      }

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
          
          map.addLayer({
            id: 'nyc-satellite-layer',
            type: 'raster',
            source: 'nyc-satellite',
            minzoom: 8,
            paint: {
              'raster-opacity': 1,
              'raster-resampling': 'linear'
            }
          }, map.getLayer('permit-areas-fill') ? 'permit-areas-fill' : undefined);
          
          console.log(`switchBasemap: Successfully added NYC satellite layer`);
        } catch (e) {
          console.error(`switchBasemap: Error adding satellite layer:`, e);
          reject(e);
          return;
        }
        
        // NOW hide layers after satellite is added
        try {
          const style = map.getStyle();
          console.log(`switchBasemap: All available layers in current style:`, style.layers?.map(l => l.id) || []);
          
          // More comprehensive approach: Hide all layers except specific ones we want to keep
          const layersToKeep = [
            'permit-areas-fill',
            'permit-areas-outline', 
            'permit-areas-focused-fill',
            'permit-areas-focused-outline',
            'nyc-satellite-layer', // Our satellite layer
            // Road and place labels (using actual Carto layer names)
            'roadname_minor',
            'roadname_sec',
            'roadname_pri',
            'roadname_major',
            'place_hamlet',
            'place_suburbs',
            'place_villages',
            'place_town',
            'place_country_2',
            'place_country_1',
            'place_state',
            'place_continent',
            'place_city_r6',
            'place_city_r5',
            'place_city_dot_r7',
            'place_city_dot_r4',
            'place_city_dot_r2',
            'place_city_dot_z7',
            'place_capital_dot_z7',
            'poi_stadium',
            'poi_park',
            'watername_ocean',
            'watername_sea',
            'watername_lake',
            'watername_lake_line',
            'housenumber'
          ];
          
          let hiddenCount = 0;
          style.layers?.forEach(layer => {
            if (!layersToKeep.includes(layer.id)) {
              try {
                map.setLayoutProperty(layer.id, 'visibility', 'none');
                console.log(`switchBasemap: Hidden layer: ${layer.id}`);
                hiddenCount++;
              } catch (e) {
                console.log(`switchBasemap: Error hiding layer ${layer.id}:`, e);
              }
            }
          });
          console.log(`switchBasemap: Hidden ${hiddenCount} layers, kept ${layersToKeep.length} layers`);
        } catch (e) {
          console.error(`switchBasemap: Error hiding layers:`, e);
          // Don't reject here, satellite layer is already added
        }
        
        if (onStyleChange && typeof onStyleChange === 'function') {
          setTimeout(() => {
            onStyleChange({ type: 'overlay' });
          }, 100);
        }
        
        resolve();
        
      } else if (basemapKey === 'carto') {
        // For carto, remove NYC satellite layer and restore hidden carto layers
        console.log(`switchBasemap: Switching back to carto style`);
        
        // Remove NYC satellite layers if they exist
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
        
        // Instead of reloading the entire style, restore visibility of hidden layers
        try {
          const style = map.getStyle();
          console.log(`switchBasemap: Restoring visibility of carto layers`);
          
          // List of layers that should be visible in carto mode
          const cartoLayersToShow = [
            // Background and basic layers
            'background',
            'landuse',
            'landcover',
            'water',
            'waterway',
            'building',
            'building-outline',
            'tunnel',
            'road',
            'bridge',
            // Road labels
            'roadname_minor',
            'roadname_sec', 
            'roadname_pri',
            'roadname_major',
            // Place labels
            'place_hamlet',
            'place_suburbs',
            'place_villages', 
            'place_town',
            'place_country_2',
            'place_country_1',
            'place_state',
            'place_continent',
            'place_city_r6',
            'place_city_r5',
            'place_city_dot_r7',
            'place_city_dot_r4',
            'place_city_dot_r2',
            'place_city_dot_z7',
            'place_capital_dot_z7',
            // POI and other labels
            'poi_stadium',
            'poi_park',
            'watername_ocean',
            'watername_sea',
            'watername_lake',
            'watername_lake_line',
            'housenumber'
          ];
          
          let restoredCount = 0;
          style.layers?.forEach(layer => {
            // Show carto layers
            if (cartoLayersToShow.includes(layer.id) || 
                layer.id.startsWith('landuse') ||
                layer.id.startsWith('admin') ||
                layer.id.startsWith('natural') ||
                layer.id.startsWith('transportation') ||
                layer.id.startsWith('boundary')) {
              try {
                map.setLayoutProperty(layer.id, 'visibility', 'visible');
                restoredCount++;
              } catch (e) {
                // Ignore errors for layers that don't support visibility
              }
            }
          });
          
          console.log(`switchBasemap: Restored visibility for ${restoredCount} carto layers`);
          
          // No need to call onStyleChange since we didn't change the style
          // Just resolve immediately
          console.log(`switchBasemap: Successfully switched to ${basemapKey} (fast mode)`);
          resolve();
          
        } catch (e) {
          console.error(`switchBasemap: Error in fast carto switch, falling back to full reload:`, e);
          
          // Fallback: full style reload (original logic)
          const newStyle = basemapOption.url;
          console.log(`switchBasemap: Falling back to full style reload: ${newStyle}`);
          
          const styleLoadTimeout = setTimeout(() => {
            console.warn(`switchBasemap: Style load timeout, proceeding anyway`);
            try {
              map.setCenter(center);
              map.setZoom(zoom);
              map.setBearing(bearing);
              map.setPitch(pitch);
              
              if (onStyleChange && typeof onStyleChange === 'function') {
                setTimeout(() => {
                  onStyleChange({ type: 'style' });
                }, 100);
              }
              
              console.log(`switchBasemap: Successfully switched to ${basemapKey} (timeout fallback)`);
              resolve();
            } catch (error) {
              console.error(`switchBasemap: Error in timeout fallback:`, error);
              reject(error);
            }
          }, 5000);
          
          map.setStyle(newStyle);
          
          map.once('style.load', () => {
            clearTimeout(styleLoadTimeout);
            console.log(`switchBasemap: Carto style loaded successfully!`);
            try {
              map.setCenter(center);
              map.setZoom(zoom);
              map.setBearing(bearing);
              map.setPitch(pitch);
              
              if (onStyleChange && typeof onStyleChange === 'function') {
                setTimeout(() => {
                  onStyleChange({ type: 'style' });
                }, 100);
              }
              
              console.log(`switchBasemap: Successfully switched to ${basemapKey}`);
              resolve();
            } catch (error) {
              console.error(`switchBasemap: Error restoring view state:`, error);
              reject(error);
            }
          });
          
          map.once('error', (error) => {
            clearTimeout(styleLoadTimeout);
            console.error(`switchBasemap: Map error during style switch:`, error);
            reject(new Error(`Failed to load basemap style: ${error.error}`));
          });
        }
      }
      
    } catch (error) {
      console.error(`switchBasemap: Error in basemap switch:`, error);
      reject(error);
    }
  });
};