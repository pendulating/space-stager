import React, { useState, useEffect } from 'react';
import GeoclientSettingsModal from '../Modals/GeoclientSettingsModal.jsx';
import { Search, Eye, EyeOff, Loader2, CheckCircle, AlertCircle, Circle } from 'lucide-react';

const PermitAreaSearch = ({ 
  searchQuery,
  onSearchChange,
  searchResults,
  isSearching,
  onSelectArea,
  focusedArea,
  title = 'Search Zones',
  placeholder = 'Search zones...',
  onChangeMode = null,
  permitAreasLayer = null,
  onToggleLayer = null,
  geographyType = 'parks',
  geoclientResults = [],
  geoclientLoading = false,
  geoclientStatus = null,
  geoclientError = null,
  geoclientCooldownMs = 0,
  onSelectGeoclientResult = null
}) => {
  const [activeAddressIndex, setActiveAddressIndex] = useState(-1);
  const [showSettings, setShowSettings] = useState(false);
  useEffect(() => {
    setActiveAddressIndex(-1);
  }, [geoclientResults, searchQuery]);
  // Function to highlight search term in text
  const highlightSearchTerm = (text, term) => {
    if (!text || !term.trim()) return text;
    
    const regex = new RegExp(`(${term.trim()})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? <span key={index} className="search-highlight bg-yellow-200">{part}</span> : part
    );
  };

  // Handle area selection
  const handleAreaSelect = (area) => {
    if (
      focusedArea &&
      focusedArea.properties &&
      area.properties &&
      focusedArea.properties.system === area.properties.system
    ) {
      return;
    }
    onSelectArea(area);
  };

  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-800">
      {/* Zone Geometry Layer Toggle - Acts as Header */}
      {permitAreasLayer && onToggleLayer && (
        <div className="mb-3 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 min-w-0 flex-1">
              <button
                onClick={() => onToggleLayer('permitAreas')}
                className="p-1 rounded flex-shrink-0 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                disabled={permitAreasLayer.loading}
              >
                {permitAreasLayer.requested ? (
                  <Eye className="w-4 h-4 text-blue-600" />
                ) : (
                  <EyeOff className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                )}
              </button>
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: permitAreasLayer.color || '#f97316' }} />
              <span className={`text-sm font-medium truncate ${
                permitAreasLayer.requested ? 'text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
              }`}>
                {geographyType === 'plazas' ? 'Plazas' : geographyType === 'intersections' ? 'Intersections' : 'Parks'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {permitAreasLayer.error && <AlertCircle className="w-4 h-4 text-red-500" title="Error loading" />}
              {permitAreasLayer.loading && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" title="Loading" />}
              {permitAreasLayer.requested && permitAreasLayer.loaded && permitAreasLayer.empty && <Circle className="w-4 h-4 text-gray-300" title="No data" />}
              {permitAreasLayer.requested && permitAreasLayer.loaded && !permitAreasLayer.empty && <CheckCircle className="w-4 h-4 text-emerald-600" title="Loaded" />}
              {!permitAreasLayer.requested && <Circle className="w-4 h-4 text-gray-400" title="Hidden" />}
            </div>
          </div>
        </div>
      )}
      
      {/* Search Input */}
      <div className="relative permit-area-search">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        </div>
        <input
          type="text"
          value={searchQuery || ''}
          onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (!Array.isArray(geoclientResults) || geoclientResults.length === 0) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveAddressIndex((prev) => {
                const next = prev < 0 ? 0 : Math.min(prev + 1, geoclientResults.length - 1);
                return next;
              });
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveAddressIndex((prev) => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter') {
              if (activeAddressIndex >= 0 && activeAddressIndex < geoclientResults.length && typeof onSelectGeoclientResult === 'function') {
                e.preventDefault();
                onSelectGeoclientResult(geoclientResults[activeAddressIndex]);
              }
            } else if (e.key === 'Escape') {
              setActiveAddressIndex(-1);
            }
          }}
          placeholder={placeholder}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>

      {/* Mode switcher (previously in GeographyCompactSelector) */}
      {typeof onChangeMode === 'function' && (
        <div className="mt-2">
          <button
            onClick={onChangeMode}
            className="w-full px-3 py-1.5 rounded text-xs border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Wrong mode selected? Click here to switch.
          </button>
        </div>
      )}
      
      {/* Loading Indicator */}
      {isSearching && (
        <div className="mt-2 text-center py-2">
          <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-blue-600" />
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">Searching...</span>
        </div>
      )}
      
      {/* Search Results */}
      {searchResults && searchResults.length > 0 && (
        <div className="mt-2 search-results">
          {searchResults.map((result, index) => (
            <div 
              key={index}
              onClick={() => handleAreaSelect(result)}
              className="p-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer rounded-md transition-colors search-result"
            >
              <div className="font-medium text-sm text-gray-800 dark:text-gray-100">
                {highlightSearchTerm(result.properties.name || result.properties.FSN_1 || '(Unnamed)', searchQuery)}
              </div>
              {result.properties.propertyname && (
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {highlightSearchTerm(result.properties.propertyname, searchQuery)}
                  {result.properties.subpropertyname && (
                    <>
                      {' › '}
                      {typeof result.properties.subpropertyname === 'string'
                        ? highlightSearchTerm(result.properties.subpropertyname, searchQuery)
                        : Array.isArray(result.properties.subpropertyname)
                          ? result.properties.subpropertyname.join(', ')
                          : JSON.stringify(result.properties.subpropertyname)}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* No Results Message */}
      {searchQuery && searchQuery.length >= 2 && searchResults && searchResults.length === 0 && !isSearching && (
        <div className="mt-2 py-2 text-center text-xs text-gray-500 dark:text-gray-400">
          No matching zones found
        </div>
      )}

      {/* Addresses & Places from Geoclient */}
      {searchQuery && searchQuery.length >= 2 && (
        <div className="mt-4" role="listbox" aria-label="Addresses & Places">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            <div className="flex items-center justify-between">
              <span>Addresses & Places</span>
              <button type="button" className="text-[11px] underline text-blue-600" onClick={() => setShowSettings(true)}>Settings</button>
            </div>
          </div>
          {geoclientLoading && geoclientCooldownMs <= 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400">Searching addresses…</div>
          )}
          {geoclientCooldownMs > 0 && (
            <div className="text-xs text-amber-600 dark:text-amber-400">Rate limited. Resuming in {(geoclientCooldownMs/1000).toFixed(1)}s…</div>
          )}
          {!geoclientLoading && Array.isArray(geoclientResults) && geoclientResults.length > 0 && (
            <div className="space-y-1">
              {geoclientResults.map((item, idx) => (
                <div
                  key={`${item.id || item.label}-${idx}`}
                  className={`p-2 cursor-pointer rounded-md transition-colors ${
                    activeAddressIndex === idx
                      ? 'bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-300'
                      : 'hover:bg-blue-50 dark:hover:bg-blue-950/30'
                  }`}
                  onClick={() => onSelectGeoclientResult && onSelectGeoclientResult(item)}
                  onMouseMove={() => setActiveAddressIndex(idx)}
                  title={item.label}
                  role="option"
                  aria-selected={activeAddressIndex === idx}
                >
                  <div className="text-sm text-gray-800 dark:text-gray-100 truncate">{item.label}</div>
                  {Array.isArray(item.coords) && item.coords.length >= 2 && (
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">{item.coords[1].toFixed(6)}, {item.coords[0].toFixed(6)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
          {!geoclientLoading && Array.isArray(geoclientResults) && geoclientResults.length === 0 && !geoclientError && geoclientStatus !== 429 && (
            <div className="text-xs text-gray-400">No addresses found</div>
          )}
          {!geoclientLoading && geoclientStatus === 429 && (
            <div className="text-xs text-amber-600 dark:text-amber-400">Rate limited. Please pause for a moment and try again.</div>
          )}
          {!geoclientLoading && geoclientError && geoclientStatus && geoclientStatus >= 500 && (
            <div className="text-xs text-red-600 dark:text-red-400">Address service temporarily unavailable. Try again shortly.</div>
          )}
        </div>
      )}

      {showSettings ? (
        <GeoclientSettingsModal isOpen onClose={() => setShowSettings(false)} />
      ) : null}
    </div>
  );
};

export default PermitAreaSearch;
