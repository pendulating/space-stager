import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

const PermitAreaSearch = ({ 
  searchQuery,
  onSearchChange,
  searchResults,
  isSearching,
  onSelectArea,
  focusedArea,
  title = 'Search Zones',
  placeholder = 'Search zones...'
}) => {
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
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">{title}</h3>
      
      {/* Search Input */}
      <div className="relative permit-area-search">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        </div>
        <input
          type="text"
          value={searchQuery || ''}
          onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>
      
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
    </div>
  );
};

export default PermitAreaSearch;
