// src/components/Header/Header.jsx
import React from 'react';
import { Map, Info, Settings } from 'lucide-react';
import { useTutorial } from '../../contexts/TutorialContext';

const Header = ({ 
  showInfo, 
  setShowInfo
}) => {
  const { isTutorialDisabled, disableTutorial, enableTutorial } = useTutorial();

  return (
    <>
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Map className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">
              NYC Public Space Event Stager
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            {/* Development Tutorial Toggle */}
            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={isTutorialDisabled ? enableTutorial : disableTutorial}
                className={`p-2 rounded-lg transition-colors ${
                  isTutorialDisabled 
                    ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                    : 'bg-green-100 text-green-600 hover:bg-green-200'
                }`}
                title={isTutorialDisabled ? 'Enable Tutorial' : 'Disable Tutorial'}
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Toggle Info"
            >
              <Info className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

    </>
  );
};

export default Header;