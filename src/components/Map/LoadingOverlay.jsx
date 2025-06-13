import React from 'react';

const LoadingOverlay = ({ isLoading, showDebugInfo = false }) => {
  if (!isLoading) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Loading map...</p>
        {showDebugInfo && (
          <p className="text-xs text-gray-500 mt-2">Check console for debugging info</p>
        )}
      </div>
    </div>
  );
};

export default LoadingOverlay;
