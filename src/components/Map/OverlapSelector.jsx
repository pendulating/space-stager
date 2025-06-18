import React from 'react';
import { X, Layers } from 'lucide-react';

const OverlapSelector = ({ 
  overlappingAreas = [], 
  selectedIndex = 0,
  clickPosition = { x: 0, y: 0 },
  onSelect, 
  onClose 
}) => {
  if (!overlappingAreas || overlappingAreas.length <= 1) return null;

  // Helper function to get area display name
  const getAreaDisplayName = (area) => {
    const props = area.properties || {};
    return props.name || props.propertyname || 'Unnamed Area';
  };

  // Helper function to get area description
  const getAreaDescription = (area) => {
    const props = area.properties || {};
    let description = '';
    
    if (props.propertyname && props.propertyname !== props.name) {
      description += props.propertyname;
    }
    if (props.subpropertyname) {
      let subDesc = '';
      if (typeof props.subpropertyname === 'string') {
        subDesc = props.subpropertyname;
      } else if (Array.isArray(props.subpropertyname)) {
        subDesc = props.subpropertyname.join(', ');
      } else {
        subDesc = JSON.stringify(props.subpropertyname);
      }
      description += description ? ` › ${subDesc}` : subDesc;
    }
    
    // Add area size indication
    if (area.calculatedArea) {
      const areaText = area.calculatedArea > 0.001 ? 'Large area' : 'Small area';
      description += description ? ` (${areaText})` : areaText;
    }
    
    return description || 'No additional details';
  };

  return (
    <>
      {/* Overlay Selector */}
      <div 
        className="absolute bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 min-w-80 max-w-sm"
        style={{ 
          left: Math.min(clickPosition.x + 10, window.innerWidth - 350), 
          top: Math.min(clickPosition.y + 10, window.innerHeight - 200)
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">Multiple Areas Found</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            title="Close selector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <p className="text-xs text-gray-600 mb-3">
          {overlappingAreas.length} overlapping permit areas detected. Smaller areas shown first:
        </p>
        
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {overlappingAreas.map((area, index) => (
            <button
              key={index}
              onClick={() => onSelect(index)}
              className={`w-full text-left p-3 rounded-md border transition-all cursor-pointer hover:shadow-md ${
                index === selectedIndex 
                  ? 'border-blue-500 bg-blue-50 text-blue-900' 
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-sm">
                {getAreaDisplayName(area)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {getAreaDescription(area)}
              </div>
            </button>
          ))}
        </div>
        
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-500">
          <span>Click an area above to focus</span>
          <span>Double-click map to bypass</span>
        </div>
      </div>

      {/* Overlap Navigation Instructions */}
      <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm text-gray-800 px-4 py-3 rounded-lg shadow-lg border border-gray-200 max-w-sm z-40">
        <div className="flex items-start space-x-2">
          <Layers className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium mb-1">Overlapping Areas Detected</p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• <strong>Click</strong> an area in the popup to focus</li>
              <li>• <strong>Double-click</strong> map to focus top area</li>
              <li>• Smaller areas appear first in the list</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export default OverlapSelector;
