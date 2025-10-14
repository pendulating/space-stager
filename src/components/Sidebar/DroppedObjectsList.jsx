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
    <div className="p-0 bg-transparent">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Placed (<span>{objects.length}</span>)</h4>
      </div>
      <div className="px-2 pb-2">
        <div className="grid grid-cols-3 gap-3 max-h-48 overflow-y-auto pr-1">
        {objects.map(obj => {
          const objectType = placeableObjects.find(p => p.id === obj.type);
          const candidates = objectType ? getCandidateSrcs(objectType, 315, 'isometric') : [];
          const src = candidates[0] || objectType?.imageUrl || null;
          const bg = (src && objectType?.color) ? `${objectType.color}E6` : null;
          return (
            <div
              key={obj.id}
              ref={(el) => { if (el) itemRefs.current.set(obj.id, el); else itemRefs.current.delete(obj.id); }}
              className={`relative group bg-white dark:bg-gray-800 rounded-xl transition m-3 ${selectedObjectId === obj.id ? 'border-transparent ring-4 ring-blue-500 ring-offset-0 ring-offset-white dark:ring-offset-gray-800' : 'border-gray-200/70 dark:border-gray-700/60'}`}
              onMouseEnter={() => { setHoverLabel(objectType?.name || obj.name || ''); try { hover(obj.id, 'point'); } catch (_) {} }}
              onMouseLeave={() => { setHoverLabel(''); try { clearHover(); } catch (_) {} }}
              onClick={(e) => {
                e.stopPropagation();
                try {
                  const kind = (objectType && objectType.geometryType === 'rect') ? 'rect' : 'point';
                  select(obj.id, kind);
                } catch (_) {}
              }}
              title={objectType?.name || obj.name}
            >
              <span aria-hidden="true" className="block pb-[100%]" />
              <div className="absolute inset-0 rounded-xl flex items-center justify-center" style={{ backgroundColor: bg || 'rgba(255,255,255,0.9)' }}>
                {src ? (
                  <img
                    src={src}
                    alt={objectType?.name}
                    className="w-[90%] h-[90%] object-contain"
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
    </div>
  );
};

export default DroppedObjectsList;
