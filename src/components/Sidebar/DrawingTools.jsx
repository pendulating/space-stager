import React from 'react';
import { Circle, Pencil, Square, Trash2 } from 'lucide-react';

const DrawingTools = ({ activeTool, onToolSelect, selectedShape, onDelete, drawAvailable = true, onRetry }) => {
  const tools = [
    { id: 'point', icon: Circle, title: 'Add Point' },
    { id: 'line', icon: Pencil, title: 'Draw Line' },
    { id: 'polygon', icon: Square, title: 'Draw Polygon' }
  ];

  return (
    <div className="p-4 border-b border-gray-200 drawing-tools">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Annotation Tools</h3>
      {!drawAvailable && (
        <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
          Drawing tools are initializing...
          <button 
            onClick={() => {
              console.log('Manual re-initialization requested');
              if (onRetry) {
                onRetry();
              }
            }}
            className="ml-2 px-2 py-1 bg-yellow-200 hover:bg-yellow-300 rounded text-xs"
          >
            Retry
          </button>
        </div>
      )}
      <div className="grid grid-cols-4 gap-2">
        {tools.map(({ id, icon: Icon, title }) => (
          <button
            key={id}
            onClick={() => onToolSelect(activeTool === id ? null : id)}
            className={`p-3 rounded-lg transition-all ${
              activeTool === id 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            } ${!drawAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={title}
            disabled={!drawAvailable}
          >
            <Icon className="w-5 h-5" />
          </button>
        ))}
        <button
          onClick={onDelete}
          className="p-3 bg-gray-100 hover:bg-red-100 text-gray-700 hover:text-red-600 rounded-lg transition-all"
          title="Delete Selected"
          disabled={!selectedShape || !drawAvailable}
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default DrawingTools;