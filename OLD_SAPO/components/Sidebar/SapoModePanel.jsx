import React from 'react';
import { Route, Play, Square, Trash2, Search } from 'lucide-react';

const SapoModePanel = ({ sapoMode, focusedArea }) => {
  const { clearSapoMode } = sapoMode;

  return (
    <div className="p-4 border-b border-gray-200">
      <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
        <Route className="w-4 h-4 mr-2 text-green-600" />
        SAPO Street Planning
      </h3>
      
      <div className="space-y-3">
        {!focusedArea && (
            <div className="text-center py-4 sapo-progress-indicator">
                <div className="inline-flex items-center text-gray-600">
                <Search className="w-4 h-4 mr-2" />
                Define a street segment
                </div>
                <div className="text-xs text-gray-500 mt-1">
                Use the search boxes to set the start and end of your work zone.
                </div>
            </div>
        )}
        
        {focusedArea && (
          <div className="space-y-2">
            <div className="bg-green-50 p-3 rounded-md sapo-status-complete">
              <div className="flex items-center text-green-700 text-sm">
                <Square className="w-4 h-4 mr-2" />
                Street zone established
              </div>
              <div className="text-xs text-green-600 mt-1">
                You can now place objects and draw within this zone
              </div>
            </div>
            
            <button
              onClick={clearSapoMode}
              className="w-full flex items-center justify-center px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Street Zone
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SapoModePanel;
