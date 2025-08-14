import React, { useState } from 'react';
import { GEOGRAPHIES } from '../../constants/geographies';

const Card = ({ id, config, selected, disabled, onSelect }) => {
  return (
    <button
      onClick={() => !disabled && onSelect(id)}
      className={`w-full text-left p-4 rounded-lg border transition-all ${
        selected ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50 dark:ring-blue-900/40 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      disabled={disabled}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-semibold text-gray-900 dark:text-gray-100 capitalize">{id}</div>
          <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">{config.description || ''}</div>
        </div>
        {selected && (
          <div className="text-blue-600 dark:text-blue-300 text-xs font-medium">Selected</div>
        )}
      </div>
      {config.info !== undefined && (
        <div className="text-xs text-gray-700 dark:text-gray-300 mt-2">{config.info}</div>
      )}
      {config.link !== undefined && (
        <div className="text-xs mt-2">
          <span className="text-gray-500 dark:text-gray-400">Reference: </span>
          <span className="text-blue-600 dark:text-blue-300 underline">{config.link || 'Add link'}</span>
        </div>
      )}
      {disabled && (
        <div className="mt-2 inline-block text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded">Coming soon</div>
      )}
    </button>
  );
};

const GeographySelector = ({ isOpen, onContinue }) => {
  const [selected, setSelected] = useState(null);

  if (!isOpen) return null;

  const isIntersectionsAvailable = true; // dataset may not exist yet, we still render but mark as disabled if needed later
  const cards = [
    { id: 'parks', disabled: false },
    { id: 'plazas', disabled: false },
    { id: 'intersections', disabled: !isIntersectionsAvailable }
  ];

  return (
    <div className="fixed inset-0 z-[2000]">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-300">Choose your geography</h2>
            <p className="text-sm text-blue-800 dark:text-blue-300/80 mt-1">Select which geographies you want to use to pick your event zone.</p>
          </div>
          <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.map(c => (
              <Card
                key={c.id}
                id={c.id}
                config={GEOGRAPHIES[c.id] || {}}
                selected={selected === c.id}
                disabled={c.disabled}
                onSelect={setSelected}
              />
            ))}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-end">
            <button
              onClick={() => selected && onContinue(selected)}
              disabled={!selected}
              className={`px-4 py-2 rounded-md ${selected ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300 cursor-not-allowed'}`}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeographySelector;


