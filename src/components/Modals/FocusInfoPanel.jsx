import React from 'react';
import { X, Map } from 'lucide-react';

const FocusInfoPanel = ({ 
  focusedArea, 
  showFocusInfo, 
  onClose, 
  onClearFocus 
}) => {
  if (!focusedArea || !showFocusInfo) return null;

  return (
    <div className="bg-blue-600 text-white border-b border-blue-700 px-4 py-3">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-2">
          <Map className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium mb-1">
              {(() => {
                const p = focusedArea.properties || {};
                const fallback = [p.FSN_1, p.FSN_2, p.FSN_3, p.FSN_4].filter(Boolean).join(' & ');
                const title = p.name || fallback || 'Unnamed Area';
                return `Focused on: ${title}`;
              })()}
            </p>
            <p>
              {focusedArea.properties.propertyname || ''} 
              {focusedArea.properties.subpropertyname ? ` › ${focusedArea.properties.subpropertyname}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {onClearFocus && (
            <button 
              onClick={onClearFocus}
              className="text-white hover:text-blue-200 text-xs bg-blue-700 hover:bg-blue-800 px-2 py-1 rounded"
              title="Clear Focus"
            >
              Clear Focus
            </button>
          )}
          <button 
            onClick={onClose}
            className="text-white hover:text-blue-200"
            title="Hide Panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FocusInfoPanel;
