// src/components/Sidebar/Sidebar.jsx
import React from 'react';
import PermitAreaSearch from './PermitAreaSearch';
import LayersPanel from './LayersPanel';
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
  isSitePlanMode = false
}) => {
  return (
    <div className={`${isSitePlanMode ? 'w-64' : 'w-80'} bg-white shadow-lg z-10 flex flex-col transition-all duration-300 h-full`}>
      <BasemapToggle 
        map={map}
        onStyleChange={onStyleChange}
      />

      <PermitAreaSearch
        searchQuery={permitAreas.searchQuery}
        onSearchChange={permitAreas.setSearchQuery}
        searchResults={permitAreas.searchResults}
        isSearching={permitAreas.isSearching}
        onSelectArea={permitAreas.focusOnPermitArea}
        focusedArea={focusedArea}
      />

      <div className="flex-1 min-h-0">
        <LayersPanel
          layers={layers}
          focusedArea={focusedArea}
          onToggleLayer={onToggleLayer}
          onClearFocus={onClearFocus}
        />
      </div>
    </div>
  );
};

export default Sidebar;