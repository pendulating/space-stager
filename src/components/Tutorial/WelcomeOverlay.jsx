import React from 'react';
import { useTutorial, TUTORIAL_STEPS } from '../../contexts/TutorialContext';

const WelcomeOverlay = () => {
  const { showWelcome, startTutorial, hideWelcome } = useTutorial();

  if (!showWelcome) return null;

  const handleStartTutorial = () => {
    startTutorial();
  };

  const handleSkip = () => {
    hideWelcome();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md mx-4 p-6 animate-fadeIn border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          {/* Icon */}
          <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
            </svg>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Welcome to Space Stager!
          </h2>

          {/* Description */}
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Design site plans for NYC parks and public spaces. Create professional layouts for permits and planning.
          </p>

          {/* Quick Start Steps */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Quick Start:</h3>
            <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">1</span>
                <span>Search for a permit area</span>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">2</span>
                <span>Focus on the area to start designing</span>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">3</span>
                <span>Add infrastructure layers</span>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">4</span>
                <span>Draw event fixtures and equipment</span>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">5</span>
                <span>Export your site plan</span>
              </li>
            </ol>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleStartTutorial}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Start Tutorial
            </button>
            <button
              onClick={handleSkip}
              className="flex-1 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Skip for Now
            </button>
          </div>

          {/* Help text */}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            You can always access the tutorial from the settings menu
          </p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeOverlay; 