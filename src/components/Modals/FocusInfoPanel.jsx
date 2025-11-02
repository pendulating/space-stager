import React, { useState, useEffect } from 'react';
import { X, Map } from 'lucide-react';

const FocusInfoPanel = ({ 
  focusedArea, 
  showFocusInfo, 
  onClose, 
  onClearFocus,
  hasSubFocus = false,
  onBeginSubFocus = null,
  onClearSubFocus = null
}) => {
  const [isVisible, setIsVisible] = useState(false);

  // Show panel when focused, auto-hide after 4 seconds
  useEffect(() => {
    if (focusedArea && showFocusInfo) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 4000); // Hide after 4 seconds
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [focusedArea, showFocusInfo]);

  if (!focusedArea || !showFocusInfo) return null;

  return (
    <div className={`bg-blue-600 text-white border-b border-blue-700 px-4 transition-all duration-500 overflow-hidden ${
      isVisible ? 'py-3 max-h-32 opacity-100' : 'py-0 max-h-0 opacity-0'
    }`}>
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
            {hasSubFocus && (
              <p className="mt-1 text-emerald-100 text-xs">Sub-area focus active</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {onBeginSubFocus && !hasSubFocus && (
            <button
              onClick={() => {
                try { const evt = new CustomEvent('subfocus:arm'); window.dispatchEvent(evt); } catch (_) {}
                onBeginSubFocus();
              }}
              className="text-white hover:text-blue-200 text-xs bg-blue-700 hover:bg-blue-800 px-2 py-1 rounded"
              title="Draw sub-area to focus"
            >
              Define sub-area
            </button>
          )}
          {onClearSubFocus && hasSubFocus && (
            <button
              onClick={() => {
                try { const evt = new CustomEvent('subfocus:disarm'); window.dispatchEvent(evt); } catch (_) {}
                onClearSubFocus();
              }}
              className="text-white hover:text-blue-200 text-xs bg-blue-700 hover:bg-blue-800 px-2 py-1 rounded"
              title="Clear sub-area focus"
            >
              Clear sub-area
            </button>
          )}
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
