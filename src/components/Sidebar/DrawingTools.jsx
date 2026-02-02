import React from 'react';
import { Dot, Square, Type, ArrowRight, Loader2, AlertTriangle } from 'lucide-react';

const DashedLineIcon = (props) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 20 L8 16" strokeDasharray="3 3" />
    <path d="M10 14 L14 10" strokeDasharray="3 3" />
    <path d="M16 8 L20 4" strokeDasharray="3 3" />
  </svg>
);

const DrawingTools = ({ activeTool, onToolSelect, selectedShape, onDelete, drawAvailable = true, onRetry, onHoverChange }) => {
  const tools = [
    { id: 'point', icon: Dot, title: 'Point', description: 'Mark a location' },
    { id: 'line', icon: DashedLineIcon, title: 'Line', description: 'Draw a path' },
    { id: 'polygon', icon: Square, title: 'Area', description: 'Draw a shape' }
  ];

  return (
    <div className="drawing-tools">
      {!drawAvailable && (
        <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">Loading drawing tools...</span>
          </div>
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
            className="w-full px-3 py-2 bg-amber-100 dark:bg-amber-800/50 hover:bg-amber-200 dark:hover:bg-amber-700/50 rounded-lg text-sm font-medium text-amber-800 dark:text-amber-200 transition-colors"
          >
            Retry Loading
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-3 gap-2">
        {tools.map(({ id, icon: Icon, title, description }) => {
          const isActive = activeTool === id;
          return (
            <button
              key={id}
              onClick={() => onToolSelect(isActive ? null : id)}
              onMouseEnter={() => { try { onHoverChange && onHoverChange(title); } catch (_) {} }}
              onMouseLeave={() => { try { onHoverChange && onHoverChange(''); } catch (_) {} }}
              className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 transition-all active:scale-95 ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700'
              } ${!drawAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={description}
              disabled={!drawAvailable}
              aria-pressed={isActive}
              aria-label={`${title}: ${description}`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium">{title}</span>
            </button>
          );
        })}
      </div>
      
      {/* Active tool hint */}
      {activeTool && drawAvailable && (
        <div className="mt-3 p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200/60 dark:border-indigo-800/40">
          <p className="text-xs text-indigo-700 dark:text-indigo-300 text-center">
            {activeTool === 'point' && 'Click on the map to place a point'}
            {activeTool === 'line' && 'Click points on the map, double-click to finish'}
            {activeTool === 'polygon' && 'Click points to draw shape, click first point to close'}
          </p>
        </div>
      )}
    </div>
  );
};

export default DrawingTools;