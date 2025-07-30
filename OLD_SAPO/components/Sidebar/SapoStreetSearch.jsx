import React, { useState } from 'react';
import { geocodeAddress } from '../../utils/geocodingUtils';

const SapoStreetSearch = ({ start, onStartChange, end, onEndChange, onSearch }) => {
  const [startSuggestions, setStartSuggestions] = useState([]);
  const [endSuggestions, setEndSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleInputChange = async (value, type) => {
    if (type === 'start') {
      onStartChange(value);
    } else {
      onEndChange(value);
    }

    if (value.length > 2) {
      setLoading(true);
      const results = await geocodeAddress(value);
      if (type === 'start') {
        setStartSuggestions(results ? results.features : []);
      } else {
        setEndSuggestions(results ? results.features : []);
      }
      setLoading(false);
    } else {
      type === 'start' ? setStartSuggestions([]) : setEndSuggestions([]);
    }
  };

  const onSuggestionClick = (suggestion, type) => {
    const address = suggestion.properties.label;
    if (type === 'start') {
      onStartChange(address);
      setStartSuggestions([]);
    } else {
      onEndChange(address);
      setEndSuggestions([]);
    }
  };

  const renderSuggestions = (suggestions, type) => (
    <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1">
      {loading && <li className="p-2">Loading...</li>}
      {suggestions.map((item) => (
        <li
          key={item.properties.id}
          className="p-2 hover:bg-gray-100 cursor-pointer"
          onClick={() => onSuggestionClick(item, type)}
        >
          {item.properties.label}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="p-4 border-b border-gray-200">
      <h3 className="text-lg font-semibold mb-2">Define Street Segment</h3>
      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            placeholder="Start Address"
            value={start}
            onChange={(e) => handleInputChange(e.target.value, 'start')}
            className="w-full p-2 border rounded"
          />
          {startSuggestions.length > 0 && renderSuggestions(startSuggestions, 'start')}
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="End Address"
            value={end}
            onChange={(e) => handleInputChange(e.target.value, 'end')}
            className="w-full p-2 border rounded"
          />
          {endSuggestions.length > 0 && renderSuggestions(endSuggestions, 'end')}
        </div>
      </div>
      <button
        onClick={onSearch}
        className="w-full mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Find Street Segment
      </button>
    </div>
  );
};

export default SapoStreetSearch; 