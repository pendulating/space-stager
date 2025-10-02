// components/MTA/TrainLineCluster.jsx
import React from 'react';
import TrainLineIcon from './TrainLineIcon';
import { sortTrainLines } from '../../utils/mtaUtils';

/**
 * Cluster of MTA train line icons
 * Shows multiple train lines together with smart overflow handling
 * 
 * @param {string[]} lines - Array of train line identifiers
 * @param {string} size - Size variant: 'small', 'medium', 'large'
 * @param {number} maxVisible - Maximum number of icons to show before overflow
 * @param {string} className - Additional CSS classes
 */
const TrainLineCluster = ({ 
  lines = [], 
  size = 'medium', 
  maxVisible = 4,
  className = ''
}) => {
  if (!lines || lines.length === 0) return null;
  
  const sortedLines = sortTrainLines(lines);
  const visibleLines = sortedLines.slice(0, maxVisible);
  const overflowCount = sortedLines.length - maxVisible;
  
  const gapClasses = {
    small: 'gap-0.5',
    medium: 'gap-1',
    large: 'gap-1.5'
  };
  
  const overflowSizeClasses = {
    small: 'text-[9px] w-4 h-4',
    medium: 'text-[10px] w-5 h-5',
    large: 'text-xs w-6 h-6'
  };
  
  return (
    <div className={`inline-flex items-center ${gapClasses[size] || gapClasses.medium} ${className}`}>
      {visibleLines.map((line, index) => (
        <TrainLineIcon 
          key={`${line}-${index}`} 
          line={line} 
          size={size}
        />
      ))}
      {overflowCount > 0 && (
        <span 
          className={`inline-flex items-center justify-center rounded-full font-semibold bg-gray-400 text-white ${overflowSizeClasses[size]}`}
          title={`+${overflowCount} more lines: ${sortedLines.slice(maxVisible).join(', ')}`}
        >
          +{overflowCount}
        </span>
      )}
    </div>
  );
};

export default TrainLineCluster;

