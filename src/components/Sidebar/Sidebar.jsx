// src/components/Sidebar/Sidebar.jsx
import React from 'react';
import { ChevronLeft } from 'lucide-react';
import PermitAreaSearch from './PermitAreaSearch';
import ZoneCreatorPanel from './ZoneCreatorPanel.jsx';
import { useZoneCreatorContext } from '../../contexts/ZoneCreatorContext.jsx';
import LayersPanel from './LayersPanel';
import GeographyCompactSelector from './GeographyCompactSelector';
import BasemapToggle from './BasemapToggle';

const Sidebar = ({ 
  layers,
  focusedArea,
  onClearFocus,
  onToggleLayer,
  permitAreas,
  infrastructure,
  map,
  onStyleChange,
  isSitePlanMode = false,
  geographyType,
  onCollapse = () => {}
}) => {
  const { isActive, setIsActive } = useZoneCreatorContext();
  return (
    <div className={`${isSitePlanMode ? 'w-80' : 'w-96'} bg-white dark:bg-gray-800 dark:text-gray-100 shadow-lg z-10 flex flex-col transition-all duration-300 h-full relative`}>
      {/* Collapse control */}
      <button
        type="button"
        onClick={onCollapse}
        aria-label="Collapse sidebar"
        className="absolute -right-3 top-4 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-r px-1 py-2 shadow hover:bg-gray-50 dark:hover:bg-gray-700"
        title="Hide sidebar"
      >
        <ChevronLeft className="w-4 h-4 text-gray-700" />
      </button>
      <BasemapToggle 
        map={map}
        onStyleChange={onStyleChange}
      />

      <GeographyCompactSelector
        onConfirmChange={() => {
          // noop here; SpaceStager will react to geography change by clearing states
        }}
      />

      {/* Search panel, customized per geography; in intersections mode also show Zone Creator */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
        isSitePlanMode 
          ? 'max-h-0 opacity-0 transform -translate-y-2' 
          : 'max-h-96 opacity-100 transform translate-y-0'
      }`}>
        <PermitAreaSearch
          searchQuery={permitAreas.searchQuery}
          onSearchChange={permitAreas.setSearchQuery}
          searchResults={permitAreas.searchResults}
          isSearching={permitAreas.isSearching}
          onSelectArea={geographyType === 'intersections'
            ? ((feature) => {
                try {
                  const geom = feature?.geometry;
                  if (geom && geom.type === 'Point' && map && map.easeTo) {
                    map.easeTo({ center: geom.coordinates, duration: 600, essential: true });
                  }
                } catch (_) {}
              })
            : permitAreas.focusOnPermitArea}
          focusedArea={focusedArea}
          title={geographyType === 'intersections' ? 'Search Intersections' : 'Search Zones'}
          placeholder={geographyType === 'intersections' ? 'Search intersections...' : 'Search zones...'}
        />
      </div>

      {geographyType === 'intersections' && (
        <div className="transition-all duration-300 ease-in-out overflow-hidden max-h-96 opacity-100 transform translate-y-0">
          <ZoneCreatorPanel geographyType={geographyType} />
        </div>
      )}

      <div className="flex-1 min-h-0">
        <LayersPanel
          layers={layers}
          focusedArea={focusedArea}
          onToggleLayer={onToggleLayer}
          onClearFocus={onClearFocus}
          isSitePlanMode={isSitePlanMode}
          geographyType={geographyType}
        />
      </div>
    </div>
  );
};

export default Sidebar;