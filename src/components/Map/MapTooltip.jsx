import React from 'react';

const MapTooltip = ({ tooltip }) => {
  // Add safety check for undefined tooltip
  if (!tooltip || !tooltip.visible || !tooltip.content) return null;

  return (
    <div 
      className="map-tooltip absolute z-50 bg-white p-2 rounded-lg shadow-lg border border-gray-200 max-w-xs"
      style={{ 
        left: tooltip.x + 10, 
        top: tooltip.y + 10
      }}
    >
      {tooltip.content.map((field, index) => (
        <div key={index} className="text-xs">
          <span className="font-medium text-gray-700">{field.label}:</span>
          <span className="text-gray-600 ml-1">{field.value}</span>
        </div>
      ))}
    </div>
  );
};

export default MapTooltip;
