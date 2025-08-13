// src/components/MobileLanding.jsx
import React from 'react';

function MobileLanding() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="mx-auto mb-6 h-12 w-12 rounded-xl bg-nyc-blue/10 flex items-center justify-center">
          <span className="text-nyc-blue text-2xl" aria-hidden>
            📱
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Space Stager isn’t available on mobile
        </h1>
        <p className="text-gray-600 mb-6">
          Please use a tablet or desktop device with a larger screen to access the app.
        </p>
        <div className="text-sm text-gray-500">
          Recommended: screens at least 768px wide (iPad or larger).
        </div>
      </div>
    </div>
  );
}

export default MobileLanding;


