import React from 'react';

const ActiveToolIndicator = ({ activeTool }) => {
  if (!activeTool) return null;

  const getToolInstructions = (tool) => {
    switch (tool) {
      case 'point':
        return 'Click to add point';
      case 'line':
        return 'Click to start drawing line';
      case 'polygon':
        return 'Click to start drawing polygon';
      default:
        return 'Select a drawing mode';
    }
  };

  return (
    <div className="absolute top-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg active-tool-indicator z-50">
      <p className="text-sm font-medium">
        {getToolInstructions(activeTool)}
      </p>
      <p className="text-xs opacity-90 mt-1">Press ESC to cancel</p>
    </div>
  );
};

export default ActiveToolIndicator;
