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
    <div className={`${isSitePlanMode ? 'w-80' : 'w-96'} bg-white shadow-lg z-10 flex flex-col transition-all duration-300 h-full`}>
      <BasemapToggle 
        map={map}
        onStyleChange={onStyleChange}
      />

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
          onSelectArea={permitAreas.focusOnPermitArea}
          focusedArea={focusedArea}
        />
      </div>

      <div className="flex-1 min-h-0">
        <LayersPanel
          layers={layers}
          focusedArea={focusedArea}
          onToggleLayer={onToggleLayer}
          onClearFocus={onClearFocus}
          isSitePlanMode={isSitePlanMode}
        />
      </div>
    </div>
  );
};

export default Sidebar;