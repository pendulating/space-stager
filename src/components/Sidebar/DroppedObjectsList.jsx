import React from 'react';
import { X } from 'lucide-react';
import { getCandidateSrcs } from '../../utils/spriteResolver';

const DroppedObjectsList = ({ 
  objects = [],
  placeableObjects = [],
  onRemove 
}) => {
  if (!objects || objects.length === 0) return null;

  const [hoverLabel, setHoverLabel] = React.useState('');

  return (
    <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold tracking-wide text-gray-600 dark:text-gray-300 uppercase">Placed</h3>
        <div className="text-xs text-gray-500 dark:text-gray-400 h-4 inline-flex items-center justify-center min-w-[40%] text-center mx-2">
          {hoverLabel && (
            <span className="px-2 py-0.5 rounded-full bg-white/80 dark:bg-gray-800/70 border border-gray-200/60 dark:border-gray-700/60 text-gray-700 dark:text-gray-200 shadow-sm truncate max-w-full">
              {hoverLabel}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{objects.length}</div>
      </div>

      <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
        {objects.map(obj => {
          const objectType = placeableObjects.find(p => p.id === obj.type);
          const candidates = objectType ? getCandidateSrcs(objectType, 135, 'isometric') : [];
          const src = candidates[0] || objectType?.imageUrl || null;
          return (
            <div
              key={obj.id}
              className="relative group bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/60 p-1.5 flex items-center justify-center hover:shadow-sm transition"
              onMouseEnter={() => setHoverLabel(objectType?.name || obj.name || '')}
              onMouseLeave={() => setHoverLabel('')}
              title={objectType?.name || obj.name}
            >
              {src ? (
                <img
                  src={src}
                  alt={objectType?.name}
                  className="w-8 h-8 object-contain"
                  draggable={false}
                  onError={(e) => { try { e.currentTarget.style.display = 'none'; } catch (_) {} }}
                />
              ) : (
                <div 
                  className="w-8 h-8 rounded flex items-center justify-center text-white text-sm"
                  style={{ backgroundColor: objectType?.color || '#64748b' }}
                >
                  {objectType?.icon}
                </div>
              )}
              {onRemove && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(obj.id); }}
                  className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity text-white bg-red-500 hover:bg-red-600 rounded-full p-0.5 shadow"
                  title="Remove object"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DroppedObjectsList;
