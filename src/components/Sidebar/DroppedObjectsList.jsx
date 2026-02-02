import React from 'react';
import { X } from 'lucide-react';
import { getCandidateSrcs } from '../../utils/spriteResolver';
import { useDroppedObjects } from '../../contexts/DroppedObjectsContext';

const DroppedObjectsList = ({ 
  objects = [],
  placeableObjects = [],
  onRemove 
}) => {
  if (!objects || objects.length === 0) return null;

  const [hoverLabel, setHoverLabel] = React.useState('');
  const { hover, clearHover, select, selectedObjectId, selectedKind } = useDroppedObjects();
  const itemRefs = React.useRef(new Map());

  React.useEffect(() => {
    try {
      if (!selectedObjectId) return;
      const el = itemRefs.current.get(selectedObjectId);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      }
    } catch (_) {}
  }, [selectedObjectId]);

  return (
    <div className="dropped-objects-list">
      <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
        {objects.map(obj => {
          const objectType = placeableObjects.find(p => p.id === obj.type);
          const candidates = objectType ? getCandidateSrcs(objectType, 315, 'isometric') : [];
          const src = candidates[0] || objectType?.imageUrl || null;
          const bg = (src && objectType?.color) ? `${objectType.color}E6` : null;
          const isSelected = selectedObjectId === obj.id;
          
          return (
            <div
              key={obj.id}
              ref={(el) => { if (el) itemRefs.current.set(obj.id, el); else itemRefs.current.delete(obj.id); }}
              className={`relative group rounded-xl border-2 transition-all cursor-pointer overflow-hidden ${
                isSelected 
                  ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-md' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
              }`}
              onMouseEnter={() => { setHoverLabel(objectType?.name || obj.name || ''); try { hover(obj.id, 'point'); } catch (_) {} }}
              onMouseLeave={() => { setHoverLabel(''); try { clearHover(); } catch (_) {} }}
              onClick={(e) => {
                e.stopPropagation();
                try {
                  const kind = (objectType && objectType.geometryType === 'rect') ? 'rect' : 'point';
                  select(obj.id, kind);
                } catch (_) {}
              }}
              title={`${objectType?.name || obj.name} - Click to select on map`}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`${objectType?.name || obj.name}${isSelected ? ' - selected' : ''}`}
            >
              {/* Object image */}
              <div className="w-full aspect-square p-1">
                <div className="w-full h-full rounded-lg flex items-center justify-center" style={{ backgroundColor: bg || 'rgba(255,255,255,0.9)' }}>
                  {src ? (
                    <img
                      src={src}
                      alt={objectType?.name}
                      className="w-[85%] h-[85%] object-contain"
                      draggable={false}
                      onError={(e) => { try { e.currentTarget.style.display = 'none'; } catch (_) {} }}
                    />
                  ) : (
                    <div 
                      className="w-full h-full flex items-center justify-center text-white text-sm rounded-lg"
                      style={{ backgroundColor: objectType?.color || '#64748b' }}
                    >
                      {objectType?.icon}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Object name */}
              <div className="px-1 pb-1 text-center">
                <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 line-clamp-1">
                  {objectType?.name || obj.name}
                </span>
              </div>
              
              {/* Remove button */}
              {onRemove && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(obj.id); }}
                  className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-white bg-red-500 hover:bg-red-600 rounded-full p-1 shadow-sm"
                  title="Remove this item from the map"
                  aria-label={`Remove ${objectType?.name || obj.name} from map`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              
              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-0.5 left-0.5 w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DroppedObjectsList;
