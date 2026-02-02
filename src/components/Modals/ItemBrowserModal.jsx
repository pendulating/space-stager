import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, MapPin, Pencil, Package, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { getCandidateSrcs } from '../../utils/spriteResolver';
import { useDroppedObjects } from '../../contexts/DroppedObjectsContext';

const ItemBrowserModal = ({
  isOpen,
  onClose,
  mode = 'objects', // 'objects' or 'annotations'
  // For objects mode
  droppedObjects = [],
  placeableObjects = [],
  onRemoveObject,
  // For annotations mode
  annotations = [],
  onSelectAnnotation,
  onDeleteAnnotation,
  onRenameAnnotation,
  selectedAnnotationId,
  // Map interaction
  onFocusItem
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const modalRef = useRef(null);
  
  const { hover, clearHover, select, selectedObjectId } = useDroppedObjects();

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isObjectsMode = mode === 'objects';
  const items = isObjectsMode ? droppedObjects : annotations;
  
  // Filter items by search
  const filteredItems = items.filter(item => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    if (isObjectsMode) {
      const objectType = placeableObjects.find(p => p.id === item.type);
      return (objectType?.name || '').toLowerCase().includes(query);
    } else {
      return (item.label || item.type || '').toLowerCase().includes(query);
    }
  });

  const handleItemClick = (item) => {
    setSelectedId(item.id);
    if (isObjectsMode) {
      const objectType = placeableObjects.find(p => p.id === item.type);
      const kind = objectType?.geometryType === 'rect' ? 'rect' : 'point';
      select(item.id, kind);
    } else {
      onSelectAnnotation?.(item.id);
    }
  };

  const handleFocusOnMap = (item) => {
    if (onFocusItem) {
      onFocusItem(item);
    }
    onClose();
  };

  const handleDelete = (item, e) => {
    e.stopPropagation();
    if (isObjectsMode) {
      onRemoveObject?.(item.id);
    } else {
      onDeleteAnnotation?.(item.id);
    }
  };

  const renderObjectItem = (obj) => {
    const objectType = placeableObjects.find(p => p.id === obj.type);
    const candidates = objectType ? getCandidateSrcs(objectType, 315, 'isometric') : [];
    const src = candidates[0] || objectType?.imageUrl || null;
    const bg = objectType?.color ? `${objectType.color}E6` : 'rgba(255,255,255,0.9)';
    const isSelected = selectedObjectId === obj.id || selectedId === obj.id;

    return (
      <div
        key={obj.id}
        onClick={() => handleItemClick(obj)}
        onMouseEnter={() => { try { hover(obj.id, 'point'); } catch (_) {} }}
        onMouseLeave={() => { try { clearHover(); } catch (_) {} }}
        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
          isSelected
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-gray-800'
        }`}
        role="button"
        tabIndex={0}
        aria-selected={isSelected}
      >
        {/* Thumbnail */}
        <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: bg }}>
          {src ? (
            <img src={src} alt={objectType?.name} className="w-10 h-10 object-contain" draggable={false} />
          ) : (
            <span className="text-xl">{objectType?.icon}</span>
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
            {objectType?.name || 'Unknown Object'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {obj.coordinates ? `${obj.coordinates[1].toFixed(5)}, ${obj.coordinates[0].toFixed(5)}` : 'On map'}
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleFocusOnMap(obj); }}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600 transition-colors"
            title="Show on map"
            aria-label="Show on map"
          >
            <MapPin className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDelete(obj, e)}
            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-600 transition-colors"
            title="Remove from map"
            aria-label="Remove from map"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderAnnotationItem = (annotation) => {
    const isSelected = selectedAnnotationId === annotation.id || selectedId === annotation.id;
    const typeLabel = annotation.type === 'Point' ? 'Point' : annotation.type === 'LineString' ? 'Line' : 'Shape';
    const typeIcon = annotation.type === 'Point' ? '📍' : annotation.type === 'LineString' ? '📏' : '⬡';

    return (
      <div
        key={annotation.id}
        onClick={() => handleItemClick(annotation)}
        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
          isSelected
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 bg-white dark:bg-gray-800'
        }`}
        role="button"
        tabIndex={0}
        aria-selected={isSelected}
      >
        {/* Type icon */}
        <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center bg-purple-100 dark:bg-purple-900/30">
          <span className="text-2xl">{typeIcon}</span>
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
            {annotation.label || `Untitled ${typeLabel}`}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {typeLabel}
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleFocusOnMap(annotation); }}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-purple-600 transition-colors"
            title="Show on map"
            aria-label="Show on map"
          >
            <MapPin className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDelete(annotation, e)}
            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-600 transition-colors"
            title="Delete annotation"
            aria-label="Delete annotation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg max-h-[80vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={isObjectsMode ? 'Placed Items Browser' : 'Annotations Browser'}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isObjectsMode 
                  ? 'bg-amber-100 dark:bg-amber-900/30' 
                  : 'bg-purple-100 dark:bg-purple-900/30'
              }`}>
                {isObjectsMode ? (
                  <Package className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Pencil className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  {isObjectsMode ? 'Placed Items' : 'Your Annotations'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} on your map
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Search */}
          {items.length > 5 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${isObjectsMode ? 'items' : 'annotations'}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                isObjectsMode 
                  ? 'bg-amber-100 dark:bg-amber-900/30' 
                  : 'bg-purple-100 dark:bg-purple-900/30'
              }`}>
                {isObjectsMode ? (
                  <Package className="w-8 h-8 text-amber-400" />
                ) : (
                  <Pencil className="w-8 h-8 text-purple-400" />
                )}
              </div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">
                {searchQuery ? 'No items match your search' : `No ${isObjectsMode ? 'items' : 'annotations'} yet`}
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                {searchQuery ? 'Try a different search term' : `Use the tools above to add ${isObjectsMode ? 'objects' : 'shapes'}`}
              </p>
            </div>
          ) : (
            filteredItems.map(item => 
              isObjectsMode ? renderObjectItem(item) : renderAnnotationItem(item)
            )
          )}
        </div>

        {/* Footer */}
        {filteredItems.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Click an item to select it on the map • Use 📍 to zoom to it
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemBrowserModal;
