import React, { useCallback, useEffect, useState } from 'react';
import { useMapViewState } from '../../hooks/useMapViewState';
import { getCandidateSrcs, bgColorFor } from '../../utils/spriteResolver';

const PlaceableObjectsPanel = ({ 
  objects, 
  onActivation, 
  placementMode,
  onRectActivation,
  activeRectObjectTypeId,
  onCancelPlacement
 }) => {
  const handleClick = useCallback((e, obj) => {
    if (obj?.geometryType === 'rect') {
      if (onRectActivation) onRectActivation(obj);
      return;
    }
    const isBatchMode = e.shiftKey;
    onActivation(obj, isBatchMode);
  }, [onActivation, onRectActivation]);

  const [bgBySrc, setBgBySrc] = useState({});
  const [hoverLabel, setHoverLabel] = useState('');
  useMapViewState(null);

  useEffect(() => {
    if (typeof onCancelPlacement !== 'function') return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancelPlacement();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancelPlacement]);

  useEffect(() => {
    if (!objects || !objects.length) return;
    const needed = {};
    objects.forEach((obj) => {
      const candidates = getCandidateSrcs(obj, 135, 'isometric');
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
    <div className="p-2">

      <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto pr-1">
        {objects.map((obj) => {
          const active = isActivePoint(obj) || isActiveRect(obj);
          const isBatch = isActivePoint(obj) && placementMode?.isBatchMode;
          const candidates = getCandidateSrcs(obj, 135, 'isometric');
          const src = candidates[0] || obj.imageUrl || null;
          const bg = (src && bgBySrc[src]) || (obj.color ? `${obj.color}E6` : undefined);
          return (
            <button
              key={obj.id}
              onClick={(e) => handleClick(e, obj)}
              onMouseEnter={() => setHoverLabel(obj.name)}
              onMouseLeave={() => setHoverLabel('')}
              className={`relative block w-full aspect-square group rounded-2xl border transition ${
                active ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' : 'bg-white dark:bg-gray-900 border-gray-200/70 dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-800'
              } ${isBatch ? 'ring-2 ring-blue-500' : ''}`}
              title={`Click to place ${obj.name}${active ? ' (click again to cancel)' : ''}`}
            >
              <div className="absolute inset-1 rounded-xl flex items-center justify-center" style={{ backgroundColor: bg || 'rgba(255,255,255,0.9)' }}>
                {src ? (
                  <img
                    src={src}
                    alt={obj.name}
                    className="w-full h-full object-contain"
                    draggable={false}
                  />
                ) : (
                  <div 
                    className="w-full h-full flex items-center justify-center text-white text-sm font-medium rounded-xl"
                    style={{ backgroundColor: obj.color || '#64748b' }}
                  >
                    {obj.icon}
                  </div>
                )}
              </div>
              {active && (
                <div className="absolute inset-0 rounded-2xl ring-2 ring-blue-500 pointer-events-none" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PlaceableObjectsPanel;
