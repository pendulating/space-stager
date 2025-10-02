// components/MTA/TrainLineIcon.jsx
import React from 'react';
import { getTrainLineClasses } from '../../utils/mtaUtils';

/**
 * Individual MTA train line icon component
 * Based on NYC Core Framework subway icon styles
 * https://www.nyc.gov/assets/oti/html/nyc-core-framework/subway-icons.html
 * 
 * @param {string} line - Train line identifier (e.g., '1', 'A', 'Q')
 * @param {string} size - Size variant: 'small' (16px), 'medium' (20px), 'large' (24px)
 * @param {string} className - Additional CSS classes
 */
const TrainLineIcon = ({ line, size = 'medium', className = '' }) => {
  if (!line) return null;
  
  const sizeClasses = {
    small: 'w-4 h-4 text-[10px]',
    medium: 'w-5 h-5 text-xs',
    large: 'w-6 h-6 text-sm'
  };
  
  const colorClasses = getTrainLineClasses(line);
  const sizeClass = sizeClasses[size] || sizeClasses.medium;
  
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold ${colorClasses} ${sizeClass} ${className}`}
      style={{
        minWidth: size === 'small' ? '16px' : size === 'large' ? '24px' : '20px'
      }}
      title={`${line} Train`}
    >
      {line}
    </span>
  );
};

export default TrainLineIcon;

