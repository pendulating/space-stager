import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

const PermitAreaSearch = ({ 
  searchQuery,
  onSearchChange,
  searchResults,
  isSearching,
  onSelectArea
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
    onSelectArea(area);
  };

  return (
    <div className="p-4 border-b border-gray-200">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Search Permit Areas</h3>
      
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery || ''}
          onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          placeholder="Search for permit areas..."
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
      </div>
      
      {/* Loading Indicator */}
      {isSearching && (
        <div className="mt-2 text-center py-2">
          <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          <span className="ml-2 text-xs text-gray-500">Searching...</span>
        </div>
      )}
      
      {/* Search Results */}
      {searchResults && searchResults.length > 0 && (
        <div className="mt-2 search-results">
          {searchResults.map((result, index) => (
            <div 
              key={index}
              onClick={() => handleAreaSelect(result)}
              className="p-2 hover:bg-blue-50 cursor-pointer rounded-md transition-colors search-result"
            >
              <div className="font-medium text-sm text-gray-800">
                {highlightSearchTerm(result.properties.name || '(Unnamed)', searchQuery)}
              </div>
              {result.properties.propertyname && (
                <div className="text-xs text-gray-600">
                  {highlightSearchTerm(result.properties.propertyname, searchQuery)}
                  {result.properties.subpropertyname && ` › ${highlightSearchTerm(result.properties.subpropertyname, searchQuery)}`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* No Results Message */}
      {searchQuery && searchQuery.length >= 2 && searchResults && searchResults.length === 0 && !isSearching && (
        <div className="mt-2 py-2 text-center text-xs text-gray-500">
          No matching permit areas found
        </div>
      )}
    </div>
  );
};

export default PermitAreaSearch;
