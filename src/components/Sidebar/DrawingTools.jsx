import React from 'react';
import { Circle, Pencil, Square, Trash2, Type, ArrowRight } from 'lucide-react';

const DrawingTools = ({ activeTool, onToolSelect, selectedShape, onDelete, drawAvailable = true, onRetry }) => {
  const tools = [
    { id: 'point', icon: Circle, title: 'Add Point' },
    { id: 'line', icon: Pencil, title: 'Draw Line' },
    { id: 'polygon', icon: Square, title: 'Draw Polygon' },
    { id: 'text', icon: Type, title: 'Text Annotation' },
    { id: 'arrow', icon: ArrowRight, title: 'Arrow Annotation' }
  ];

  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-700 drawing-tools">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Annotation Tools</h3>
      {!drawAvailable && (
        <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-700 dark:text-yellow-300">
          Drawing tools are initializing...
          <br />
          <small className="text-yellow-600 dark:text-yellow-300">
            Status: {drawAvailable ? 'Ready' : 'Initializing'}
          </small>
          <button 
            onClick={() => {
              console.log('Manual re-initialization requested via retry button');
              if (onRetry) {
                console.log('Calling onRetry function...');
                onRetry();
              } else {
                console.warn('onRetry function not available');
              }
            }}
            className="ml-2 px-2 py-1 bg-yellow-200 dark:bg-yellow-800 hover:bg-yellow-300 dark:hover:bg-yellow-700 rounded text-xs"
          >
            Retry
          </button>
        </div>
      )}
      <div className="grid grid-cols-5 gap-2">
        {tools.map(({ id, icon: Icon, title }) => (
          <button
            key={id}
            onClick={() => onToolSelect(activeTool === id ? null : id)}
            className={`p-3 rounded-lg transition-all ${
              activeTool === id 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
            } ${!drawAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={title}
            disabled={!drawAvailable}
          >
            <Icon className="w-5 h-5" />
          </button>
        ))}
        <button
          onClick={onDelete}
          className="p-3 bg-gray-100 dark:bg-gray-800 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-700 dark:text-gray-200 hover:text-red-600 dark:hover:text-red-300 rounded-lg transition-all"
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