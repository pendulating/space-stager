import { useEffect, useRef, useState } from 'react';
import { loadMapLibraries, initializeMap } from '../utils/mapUtils.js';

function isHarnessEnabled() {
  try {
    return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('testHarness');
  } catch (_) {
    return false;
  }
}

function initHarness(mapInstance) {
  if (!mapInstance || !isHarnessEnabled()) return;
  try {
    const style = document.createElement('style');
    style.id = 'test-harness-css';
    style.textContent = '*{transition:none!important;animation:none!important}';
    document.head.appendChild(style);
  } catch (_) {}

  const helpers = {
    map: mapInstance,
    waitForIdle: () => new Promise((resolve) => {
      if (mapInstance.loaded() && (mapInstance.areTilesLoaded?.() || true)) return resolve();
      mapInstance.once('idle', resolve);
    }),
    setView: ({ center, zoom, bearing = 0, pitch = 0 }) => {
      mapInstance.jumpTo({ center, zoom, bearing, pitch });
    },
    getLayerVisibility: (id) => {
      try { return mapInstance.getLayoutProperty(id, 'visibility') ?? 'visible'; } catch { return undefined; }
    },
    getFeatureCount: (layerId) => {
      try { return mapInstance.queryRenderedFeatures({ layers: [layerId] }).length; } catch { return 0; }
    }
  };
  window.__app = Object.assign({}, window.__app || {}, helpers);
}

export const useMap = (mapContainer) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [styleLoaded, setStyleLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current) return;

    const setupMap = async () => {
      try {
        await loadMapLibraries();
        const mapInstance = await initializeMap(mapContainer.current);
        mapRef.current = mapInstance;
        setMap(mapInstance);
        
        // Check immediately if map is already loaded (might happen in development)
        if (mapInstance.loaded() && mapInstance.isStyleLoaded()) {
          console.log('Map already loaded during initialization');
          setMapLoaded(true);
          setStyleLoaded(true);
        }
        
        // Use the 'load' event for initial loading
        mapInstance.on('load', () => {
          console.log('Map load event fired - map and initial style are ready');
          setMapLoaded(true);
          setStyleLoaded(true);
          initHarness(mapInstance);
        });
        
        // Listen for pre-style change signal (emitted by switchBasemap) and debounce style.load
        let styleLoadTimer = null;
        const onWillChange = () => {
          try { setStyleLoaded(false); } catch (_) {}
        };
        const onStyleLoad = () => {
          if (styleLoadTimer) clearTimeout(styleLoadTimer);
          styleLoadTimer = setTimeout(() => {
            console.log('Style load event fired (debounced)');
            setStyleLoaded(true);
          }, 60);
        };
        try { window.addEventListener('map:style:will-change', onWillChange); } catch (_) {}
        mapInstance.on('style.load', onStyleLoad);
        // Store for cleanup
        mapRef.current.__onWillChange = onWillChange;
        mapRef.current.__onStyleLoad = onStyleLoad;
        
      } catch (error) {
        console.error('Map setup failed:', error);
        setMapLoaded(false);
        setStyleLoaded(false);
      }
    };

    setupMap();

    return () => {
      try {
        const m = mapRef.current;
        if (m && m.__onStyleLoad) {
          try { m.off && m.off('style.load', m.__onStyleLoad); } catch (_) {}
        }
        try { window.removeEventListener('map:style:will-change', m && m.__onWillChange ? m.__onWillChange : () => {}); } catch (_) {}
        if (m) { m.remove(); }
      } catch (_) {}
      mapRef.current = null;
      setMap(null);
      setMapLoaded(false);
      setStyleLoaded(false);
    };
  }, [mapContainer]);

  return { map, mapLoaded, styleLoaded };
};