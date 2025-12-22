import React from 'react';
import { Dot, Square, Type, ArrowRight } from 'lucide-react';

const DashedLineIcon = (props) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 20 L8 16" strokeDasharray="3 3" />
    <path d="M10 14 L14 10" strokeDasharray="3 3" />
    <path d="M16 8 L20 4" strokeDasharray="3 3" />
  </svg>
);

const DrawingTools = ({ activeTool, onToolSelect, selectedShape, onDelete, drawAvailable = true, onRetry, onHoverChange }) => {
  const tools = [
    { id: 'point', icon: Dot, title: 'Point' },
    { id: 'line', icon: DashedLineIcon, title: 'Line' },
    { id: 'polygon', icon: Square, title: 'Polygon' }
  ];

  return (
    <div className="p-2 drawing-tools">
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
      <div className="grid grid-cols-3 gap-2">
        {tools.map(({ id, icon: Icon, title }) => (
          <div key={id} className="relative group">
            <span aria-hidden="true" className="block pb-[100%]" />
            <button
              onClick={() => onToolSelect(activeTool === id ? null : id)}
              onMouseEnter={() => { try { onHoverChange && onHoverChange(title); } catch (_) {} }}
              onMouseLeave={() => { try { onHoverChange && onHoverChange(''); } catch (_) {} }}
              className={`absolute inset-0 rounded-lg border transition ${
                activeTool === id
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 border-gray-200/70 dark:border-gray-700/60'
              } ${!drawAvailable ? 'opacity-50 cursor-not-allowed' : ''} flex items-center justify-center`}
              title={title}
              disabled={!drawAvailable}
            >
              <Icon className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DrawingTools;