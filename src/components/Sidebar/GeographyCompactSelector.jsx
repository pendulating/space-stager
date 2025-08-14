import React, { useState } from 'react';
import { useGeography } from '../../contexts/GeographyContext';
import GeographySelector from '../Modals/GeographySelector';

const GeographyCompactSelector = ({ onConfirmChange }) => {
  const { geographyType, selectGeography } = useGeography();
  const [showSelector, setShowSelector] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Geography</h3>
        <button
          onClick={() => setShowSelector(true)}
          className="px-3 py-1.5 rounded text-xs border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Wrong mode selected? Click here to switch.
        </button>
      </div>

      <GeographySelector
        isOpen={showSelector}
        onContinue={(type) => {
          setShowSelector(false);
          if (type && type !== geographyType) {
            selectGeography(type);
            onConfirmChange && onConfirmChange(type);
          }
        }}
      />
    </div>
  );
};

export default GeographyCompactSelector;


