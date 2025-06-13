import React from 'react';
import { Route, Play, Square, Trash2 } from 'lucide-react';

const SapoModePanel = ({ sapoMode }) => {
  const { sapoLine, isDrawingLine, sapoZone, startDrawingLine, clearSapoMode } = sapoMode;

  return (
    <div className="p-4 border-b border-gray-200">
      <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
        <Route className="w-4 h-4 mr-2 text-green-600" />
        SAPO Street Planning
      </h3>
      
      <div className="space-y-3">
        {!sapoLine && !isDrawingLine && (
          <button
            onClick={startDrawingLine}
            className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors sapo-control-button"
          >
            <Play className="w-4 h-4 mr-2" />
            Draw Street Line
          </button>
        )}
        
        {isDrawingLine && (
          <div className="text-center py-4 sapo-progress-indicator">
            <div className="inline-flex items-center text-green-600">
              <div className="animate-pulse w-2 h-2 bg-green-600 rounded-full mr-2"></div>
              Drawing line mode active
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Click map points to draw line, double-click to finish
            </div>
          </div>
        )}
        
        {sapoLine && !sapoZone && (
          <div className="text-center py-4">
            <div className="inline-flex items-center text-blue-600">
              <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
              Creating street zone...
            </div>
          </div>
        )}
        
        {sapoZone && (
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
