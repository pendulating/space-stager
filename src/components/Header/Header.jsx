// src/components/Header/Header.jsx
import React from 'react';
import { Info, Settings, Moon, Sun, Upload, BookOpen, FileText, HelpCircle } from 'lucide-react';
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
      <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-sm border-b border-gray-200/50 dark:border-gray-700/50 px-4 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-lg font-bold uppercase tracking-tight text-gray-900 dark:text-gray-100">
              SpaceStager.NYC <span className="text-xs font-medium text-orange-500 dark:text-orange-400 ml-1">ALPHA</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-1.5">
            {/* Documentation */}
            <a
              href="/docs/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-700/60 border border-gray-200/50 dark:border-gray-700/50 rounded-lg transition-colors"
              aria-label="Open documentation"
            >
              <FileText className="w-4 h-4" />
              <span>Docs</span>
            </a>
            
            {/* Examples Modal */}
            <button
              onClick={onShowExamples || (() => {})}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-700/60 border border-gray-200/50 dark:border-gray-700/50 rounded-lg transition-colors"
              aria-label="Show examples"
            >
              <BookOpen className="w-4 h-4" />
              <span>Examples</span>
            </button>
            
            {/* Import Plan */}
            <button
              onClick={onImportClick || (() => {})}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-700/60 border border-gray-200/50 dark:border-gray-700/50 rounded-lg transition-colors"
              aria-label="Import plan"
            >
              <Upload className="w-4 h-4" />
              <span>Import</span>
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-300/50 dark:bg-gray-600/50 mx-1" />

            {/* Dark Mode Toggle */}
            <button
              onClick={onToggleDarkMode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-700/60 border border-gray-200/50 dark:border-gray-700/50 rounded-lg transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-500" />
                  <span>Dark</span>
                </>
              )}
            </button>
            
            {/* Info Toggle */}
            <button
              onClick={() => setShowInfo(!showInfo)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border ${
                showInfo 
                  ? 'bg-blue-100/70 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/60' 
                  : 'text-gray-600 dark:text-gray-300 bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-700/60 border-gray-200/50 dark:border-gray-700/50'
              }`}
              aria-label="Toggle info panel"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Help</span>
            </button>

            {/* Development Tutorial Toggle - Only show in development */}
            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={isTutorialDisabled ? enableTutorial : disableTutorial}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border ${
                  isTutorialDisabled 
                    ? 'bg-red-100/70 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200/60 dark:border-red-800/60 hover:bg-red-100 dark:hover:bg-red-900/50' 
                    : 'bg-green-100/70 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200/60 dark:border-green-800/60 hover:bg-green-100 dark:hover:bg-green-900/50'
                }`}
                title={isTutorialDisabled ? 'Enable Tutorial' : 'Disable Tutorial'}
              >
                <Settings className="w-4 h-4" />
                <span>{isTutorialDisabled ? 'Tutorial Off' : 'Tutorial On'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Header;