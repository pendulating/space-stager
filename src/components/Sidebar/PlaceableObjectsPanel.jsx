import React, { useCallback, useEffect, useState } from 'react';
import { getContrastingBackgroundForIcon } from '../../utils/colorUtils';

const PlaceableObjectsPanel = ({ 
  objects, 
  onActivation, 
  placementMode,
  onRectActivation,
  activeRectObjectTypeId
}) => {
  const handleClick = useCallback((e, obj) => {
    // If object is rectangle-based, use rect activation path
    if (obj?.geometryType === 'rect') {
      if (onRectActivation) onRectActivation(obj);
      return;
    }
    // Check if shift is held for batch mode (only for point objects)
    const isBatchMode = e.shiftKey;
    onActivation(obj, isBatchMode);
  }, [onActivation, onRectActivation]);

  const [bgBySrc, setBgBySrc] = useState({});

  // Precompute contrasting backgrounds for all object thumbnails (base icon or 135° variant)
  useEffect(() => {
    if (!objects || !objects.length) return;
    const needed = {};
    objects.forEach((obj) => {
      if (!obj?.imageUrl) return;
      const isEnhanced = !!obj?.enhancedRendering?.enabled;
      let src = obj.imageUrl;
      if (isEnhanced) {
        const base = obj.enhancedRendering.spriteBase;
        const dir = obj.enhancedRendering.publicDir || '/data/icons/isometric-bw';
        src = `${dir}/${base}_135.png`;
      }
      if (src && !bgBySrc[src]) {
        needed[src] = obj.color || '#64748b';
      }
    });
    const srcs = Object.keys(needed);
    if (srcs.length === 0) return;
    let active = true;
    Promise.all(srcs.map(async (src) => {
      const bg = await getContrastingBackgroundForIcon(src, needed[src], 0.9);
      return [src, bg];
    })).then((pairs) => {
      if (!active) return;
      setBgBySrc((prev) => {
        const next = { ...prev };
        pairs.forEach(([s, bg]) => { next[s] = bg; });
        return next;
      });
    }).catch(() => {});
    return () => { active = false; };
  }, [objects, bgBySrc]);

  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Event Objects</h3>
      <div className="grid grid-cols-2 gap-2 placeable-objects-grid">
        {objects.map((obj) => {
          const isActivePoint = placementMode?.objectType?.id === obj.id;
          const isBatchMode = isActivePoint && placementMode.isBatchMode;
          const isActiveRect = activeRectObjectTypeId === obj.id;
          const isActive = isActivePoint || isActiveRect;
          
          return (
            <div
              key={obj.id}
              onClick={(e) => handleClick(e, obj)}
              className={`flex flex-col items-center p-3 rounded-lg transition-all cursor-pointer object-item ${
                isActive 
                  ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500' 
                  : 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 border-2 border-transparent'
              } ${
                isBatchMode ? 'border-4 border-blue-600' : ''
              }`}
              title={`Click to place ${obj.name}${isActive ? ' (click again to cancel)' : ''}`}
            >
              {obj.imageUrl ? (
                (() => {
                  const isEnhanced = !!obj?.enhancedRendering?.enabled;
                  let src = obj.imageUrl;
                  if (isEnhanced) {
                    const base = obj.enhancedRendering.spriteBase;
                    const dir = obj.enhancedRendering.publicDir || '/data/icons/isometric-bw';
                    src = `${dir}/${base}_135.png`;
                  }
                  const bg = bgBySrc[src] || (obj.color ? `${obj.color}E6` : undefined); // fallback alpha if not computed yet
                  return (
                    <div
                      className="w-12 h-12 mb-2 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: bg || 'rgba(255,255,255,0.9)' }}
                    >
                      <img
                        src={src}
                        alt={obj.name}
                        className="w-10 h-10"
                        style={{ objectFit: 'contain' }}
                        draggable={false}
                      />
                    </div>
                  );
                })()
              ) : (
                <div 
                  className="w-12 h-12 mb-2 rounded-full flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: obj.color }}
                >
                  {obj.icon}
                </div>
              )}
              <span className="text-xs text-gray-700 dark:text-gray-200 text-center font-medium">
                {obj.name}
              </span>
              {isActive && (
                <span className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                  {isBatchMode ? 'Batch Mode' : 'Active'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlaceableObjectsPanel;
