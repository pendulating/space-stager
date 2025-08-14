// src/components/Header/Header.jsx
import React from 'react';
import { Map, Info, Settings, Moon, Sun, Upload } from 'lucide-react';
import { useTutorial } from '../../contexts/TutorialContext';

const Header = ({ 
  showInfo, 
  setShowInfo,
  isDarkMode = false,
  onToggleDarkMode = () => {},
  onImportClick = null
}) => {
  const { isTutorialDisabled, disableTutorial, enableTutorial } = useTutorial();

  return (
    <>
      <div className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Map className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              NYC Public Space Event Stager
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            {/* Import Plan (JSON) - always visible */}
            <button
              onClick={onImportClick || (() => {})}
              className="p-2 rounded-lg transition-colors bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
              title="Import Plan (JSON)"
              aria-label="Import plan"
            >
              <Upload className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={onToggleDarkMode}
              className="p-2 rounded-lg transition-colors bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? (
                <Sun className="w-5 h-5 text-yellow-400" />
              ) : (
                <Moon className="w-5 h-5 text-gray-700" />
              )}
            </button>
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
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Toggle Info"
            >
              <Info className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>
      </div>

    </>
  );
};

export default Header;