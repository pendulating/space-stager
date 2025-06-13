import React from 'react';
import { X, Info } from 'lucide-react';

const InfoPanel = ({ onClose }) => {
  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-2">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Event Staging Tool for NYC Permits</p>
            <p>Draw custom event fixtures and export your siteplan for permit applications. NYC infrastructure layers coming soon with optimized data loading.</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="text-blue-600 hover:text-blue-800"
          title="Close Info"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default InfoPanel;
