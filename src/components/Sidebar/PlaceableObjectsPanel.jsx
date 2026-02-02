import React, { useCallback, useState, useEffect } from 'react';
import { useMapViewState } from '../../hooks/useMapViewState';
import { getCandidateSrcs, bgColorFor } from '../../utils/spriteResolver';
import { useGlobalKeymap } from '../../hooks/useGlobalKeymap';

const PlaceableObjectsPanel = ({ 
  objects, 
  onActivation, 
  placementMode,
  onRectActivation,
  activeRectObjectTypeId,
  onCancelPlacement,
  onCancelRectPlacement
 }) => {
  const handleClick = useCallback((e, obj) => {
    if (obj?.geometryType === 'rect') {
      // Ensure point placement mode is off before activating rectangle placement
      if (typeof onCancelPlacement === 'function') {
        try { onCancelPlacement(); } catch (_) {}
      }
      if (onRectActivation) onRectActivation(obj);
      return;
    }
    const isBatchMode = e.shiftKey;
    // Ensure rectangle placement mode is off before activating point placement
    if (activeRectObjectTypeId && typeof onCancelRectPlacement === 'function') {
      try { onCancelRectPlacement(); } catch (_) {}
    }
    onActivation(obj, isBatchMode);
  }, [onActivation, onRectActivation, onCancelPlacement, onCancelRectPlacement, activeRectObjectTypeId]);

  const [bgBySrc, setBgBySrc] = useState({});
  const [hoverLabel, setHoverLabel] = useState('');
  useMapViewState(null);

  useGlobalKeymap([
    typeof onCancelPlacement === 'function' ? {
      key: 'Escape',
      onEvent: () => { try { onCancelPlacement(); } catch (_) {} },
      priority: 60,
      stop: false
    } : null
  ]);

  useEffect(() => {
    if (!objects || !objects.length) return;
    const needed = {};
    objects.forEach((obj) => {
      const candidates = getCandidateSrcs(obj, 315, 'isometric');
      const src = candidates[0] || obj.imageUrl || null;
      if (src && !bgBySrc[src]) needed[src] = obj.color || '#64748b';
    });
    const srcs = Object.keys(needed);
    if (srcs.length === 0) return;
    let active = true;
    Promise.all(srcs.map(async (src) => [src, await bgColorFor(src, needed[src], 0.9)])).then((pairs) => {
      if (!active) return;
      setBgBySrc((prev) => {
        const next = { ...prev };
        pairs.forEach(([s, bg]) => { next[s] = bg; });
        return next;
      });
    }).catch(() => {});
    return () => { active = false; };
  }, [objects, bgBySrc]);

  const isActivePoint = (obj) => placementMode?.objectType?.id === obj.id;
  const isActiveRect = (obj) => activeRectObjectTypeId === obj.id;

  return (
    <div className="placeable-objects-panel">
      <div className="grid grid-cols-3 gap-2 pr-1">
        {objects.map((obj) => {
          const active = isActivePoint(obj) || isActiveRect(obj);
          const isBatch = isActivePoint(obj) && placementMode?.isBatchMode;
          const candidates = getCandidateSrcs(obj, 315, 'isometric');
          const src = candidates[0] || obj.imageUrl || null;
          const bg = (src && bgBySrc[src]) || (obj.color ? `${obj.color}E6` : undefined);
          return (
            <button
              key={obj.id}
              onClick={(e) => handleClick(e, obj)}
              onMouseEnter={() => setHoverLabel(obj.name)}
              onMouseLeave={() => setHoverLabel('')}
              className={`relative flex flex-col items-center group rounded-xl border-2 transition-all active:scale-95 overflow-hidden ${
                active 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-md ring-2 ring-blue-500/30' 
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm'
              } ${isBatch ? 'ring-2 ring-blue-500' : ''}`}
              title={`Click to place ${obj.name}${active ? ' (click again to cancel)' : ''}`}
              aria-pressed={active}
              aria-label={`Place ${obj.name}${active ? ' - currently selected' : ''}`}
            >
              {/* Object image */}
              <div className="w-full aspect-square p-1.5">
                <div className="w-full h-full rounded-lg flex items-center justify-center" style={{ backgroundColor: bg || 'rgba(255,255,255,0.9)' }}>
                  {src ? (
                    <img
                      src={src}
                      alt={obj.name}
                      className="w-full h-full object-contain"
                      draggable={false}
                    />
                  ) : (
                    <div 
                      className={`w-full h-full flex items-center justify-center text-white font-medium rounded-lg ${
                        obj?.geometryType === 'rect' ? 'text-3xl' : 'text-xl'
                      }`}
                      style={{ backgroundColor: obj.color || '#64748b' }}
                    >
                      {obj.icon}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Object name */}
              <div className={`w-full px-1 pb-1.5 text-center ${active ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                <span className="text-[10px] font-medium leading-tight line-clamp-1">{obj.name}</span>
              </div>
              
              {/* Active indicator */}
              {active && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PlaceableObjectsPanel;
