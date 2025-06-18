import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
        <h1 className="text-3xl font-bold mb-4 text-gray-900">NYC Event Stager</h1>
        <p className="mb-8 text-gray-600">Choose your permit type to begin:</p>
        <div className="space-y-4">
          <Link to="/dpr" className="block w-full py-3 px-6 rounded-lg bg-green-600 text-white font-semibold text-lg hover:bg-green-700 transition">Parks & Rec (DPR)</Link>
          <Link to="/sapo" className="block w-full py-3 px-6 rounded-lg bg-blue-600 text-white font-semibold text-lg hover:bg-blue-700 transition">SAPO (Street Activity Permit Office)</Link>
        </div>
      </div>
    </div>
  );
};

export default LandingPage; 