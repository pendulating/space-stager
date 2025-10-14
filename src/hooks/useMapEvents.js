import { useEffect } from 'react';

/**
 * useMapEvents
 * Centralized lifecycle for MapLibre/Mapbox map events with automatic cleanup
 * and optional re-attachment on style reload (useful for layer-bound handlers).
 *
 * handlers: { [eventName: string]: Function | { handler: Function, layerId?: string, once?: boolean } }
 * options:
 *  - reattachOnStyleLoad?: boolean (default: true) re-attach handlers after style reload
 */
export const useMapEvents = (map, handlers = {}, options = {}) => {
  useEffect(() => {
    if (!map || !handlers) return;

    const { reattachOnStyleLoad = true } = options || {};

    const normalized = Array.isArray(handlers)
      ? handlers.filter((cfg) => cfg && typeof cfg.handler === 'function' && typeof cfg.event === 'string')
      : Object.entries(handlers)
          .filter(([, cfg]) => typeof cfg === 'function' || (cfg && typeof cfg.handler === 'function'))
          .map(([event, cfg]) => {
            const isFn = typeof cfg === 'function';
            return {
              event,
              handler: isFn ? cfg : cfg.handler,
              layerId: isFn ? undefined : cfg.layerId,
              once: isFn ? false : !!cfg.once
            };
          });

    const attachAll = () => {
      normalized.forEach(({ event, handler, layerId, once }) => {
        try {
          try { if (layerId) map.off(event, layerId, handler); else map.off(event, handler); } catch (_) {}
          if (once && map.once) {
            if (layerId) map.once(event, layerId, handler);
            else map.once(event, handler);
          } else {
            if (layerId) map.on(event, layerId, handler);
            else map.on(event, handler);
          }
        } catch (_) {}
      });
    };

    const detachAll = () => {
      normalized.forEach(({ event, handler, layerId }) => {
        try { if (layerId) map.off(event, layerId, handler); else map.off(event, handler); } catch (_) {}
      });
    };

    attachAll();

    let onStyleLoad;
    if (reattachOnStyleLoad) {
      onStyleLoad = () => {
        try { attachAll(); } catch (_) {}
      };
      try { map.on('style.load', onStyleLoad); } catch (_) {}
    }

    return () => {
      try { if (onStyleLoad) map.off('style.load', onStyleLoad); } catch (_) {}
      detachAll();
    };
  }, [map, handlers, options]);
};


