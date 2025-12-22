// src/components/Header/Header.jsx
import React from 'react';
import { Map, Info, Settings, Moon, Sun, Upload, BookOpen, FileText } from 'lucide-react';
import { useTutorial } from '../../contexts/TutorialContext';

const Header = ({ 
  showInfo, 
  setShowInfo,
  isDarkMode = false,
  onToggleDarkMode = () => {},
  onImportClick = null,
  onShowExamples = null
}) => {
  const { isTutorialDisabled, disableTutorial, enableTutorial } = useTutorial();

  return (
    <>
      <div className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold uppercase text-gray-900 dark:text-gray-100">
              SpaceStager.NYC [ALPHA]
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            {/* Documentation */}
            <a
              href="/docs/"
              className="p-3 rounded-lg transition-colors bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
              title="Documentation"
              aria-label="Open documentation"
            >
              <FileText className="w-6 h-6   text-gray-700 dark:text-gray-300" />
            </a>
            {/* Examples Modal */}
            <button
              onClick={onShowExamples || (() => {})}
              className="p-3 rounded-lg transition-colors bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
              title="Examples"
              aria-label="Show examples"
            >
              <BookOpen className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
            {/* Import Plan (JSON) - always visible */}
            <button
              onClick={onImportClick || (() => {})}
              className="p-3 rounded-lg transition-colors bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
              title="Import Plan (JSON)"
              aria-label="Import plan"
            >
              <Upload className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={onToggleDarkMode}
              className="p-3 rounded-lg transition-colors bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? (
                <Sun className="w-6 h-6 text-yellow-400" />
              ) : (
                <Moon className="w-6 h-6 text-gray-700" />
              )}
            </button>
            {/* Development Tutorial Toggle */}
            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={isTutorialDisabled ? enableTutorial : disableTutorial}
                className={`p-3 rounded-lg transition-colors ${
                  isTutorialDisabled 
                    ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                    : 'bg-green-100 text-green-600 hover:bg-green-200'
                }`}
                title={isTutorialDisabled ? 'Enable Tutorial' : 'Disable Tutorial'}
              >
                <Settings className="w-6 h-6" />
              </button>
            )}
            
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Toggle Info"
            >
              <Info className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>
      </div>

    </>
  );
};

export default Header;