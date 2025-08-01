import React, { useState, useEffect, useRef } from 'react';
import { useTutorial, TUTORIAL_STEPS } from '../../contexts/TutorialContext';

const TutorialTooltip = () => {
  const { 
    isTutorialActive, 
    currentStep, 
    getCurrentStepContent, 
    completeStep, 
    dismissTutorial,
    nextStep,
    TUTORIAL_STEPS 
  } = useTutorial();

  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef(null);

  const currentContent = getCurrentStepContent();

  useEffect(() => {
    if (!isTutorialActive || !currentStep || !currentContent) {
      setIsVisible(false);
      return;
    }

    // Find the target element
    const targetElement = document.querySelector(currentContent.target);
    if (!targetElement) {
      // If target not found, wait a bit and try again
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 500);
      return () => clearTimeout(timer);
    }

    // Calculate position
    const rect = targetElement.getBoundingClientRect();
    const tooltipRect = tooltipRef.current?.getBoundingClientRect();
    
    let top = 0;
    let left = 0;

    switch (currentContent.position) {
      case 'top':
        top = rect.top - (tooltipRect?.height || 0) - 10;
        left = rect.left + rect.width / 2;
        break;
      case 'bottom':
        top = rect.bottom + 10;
        left = rect.left + rect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - (tooltipRect?.width || 0) - 10;
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + 10;
        break;
      default:
        top = rect.bottom + 10;
        left = rect.left + rect.width / 2;
    }

    // Ensure tooltip stays within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipWidth = tooltipRect?.width || 300;
    const tooltipHeight = tooltipRect?.height || 150;

    if (left + tooltipWidth > viewportWidth) {
      left = viewportWidth - tooltipWidth - 20;
    }
    if (left < 20) {
      left = 20;
    }
    if (top + tooltipHeight > viewportHeight) {
      top = viewportHeight - tooltipHeight - 20;
    }
    if (top < 20) {
      top = 20;
    }

    setPosition({ top, left });
    setIsVisible(true);

    // Highlight target element
    targetElement.style.outline = '2px solid #3b82f6';
    targetElement.style.outlineOffset = '2px';
    targetElement.style.borderRadius = '4px';

    return () => {
      targetElement.style.outline = '';
      targetElement.style.outlineOffset = '';
      targetElement.style.borderRadius = '';
    };
  }, [isTutorialActive, currentStep, currentContent]);

  if (!isVisible || !currentContent) return null;

  const handleNext = () => {
    const stepOrder = [
      TUTORIAL_STEPS.SEARCH,
      TUTORIAL_STEPS.FOCUS_AREA,
      TUTORIAL_STEPS.LAYERS,
      TUTORIAL_STEPS.DRAWING,
      TUTORIAL_STEPS.EXPORT
    ];

    const currentIndex = stepOrder.indexOf(currentStep);
    const nextStepIndex = currentIndex + 1;

    if (nextStepIndex < stepOrder.length) {
      completeStep(currentStep, stepOrder[nextStepIndex]);
    } else {
      completeStep(currentStep);
    }
  };

  const handleSkip = () => {
    dismissTutorial();
  };

  const getStepNumber = () => {
    const stepOrder = [
      TUTORIAL_STEPS.SEARCH,
      TUTORIAL_STEPS.FOCUS_AREA,
      TUTORIAL_STEPS.LAYERS,
      TUTORIAL_STEPS.DRAWING,
      TUTORIAL_STEPS.EXPORT
    ];
    return stepOrder.indexOf(currentStep) + 1;
  };

  return (
    <div
      ref={tooltipRef}
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 max-w-sm animate-fadeIn"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)'
      }}
    >
      {/* Arrow */}
      <div className="absolute w-3 h-3 bg-white border-l border-t border-gray-200 transform rotate-45" 
           style={{
             top: currentContent.position === 'bottom' ? '-6px' : 'auto',
             bottom: currentContent.position === 'top' ? '-6px' : 'auto',
             left: '50%',
             transform: 'translateX(-50%) rotate(45deg)'
           }} />

      {/* Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <span className="bg-blue-100 text-blue-600 text-xs font-medium px-2 py-1 rounded-full mr-2">
              Step {getStepNumber()} of 5
            </span>
          </div>
          <button
            onClick={handleSkip}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Skip tutorial"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-gray-900 mb-2">
          {currentContent.title}
        </h3>

        {/* Content */}
        <p className="text-gray-600 text-sm mb-4">
          {currentContent.content}
        </p>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <button
            onClick={handleSkip}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Skip tutorial
          </button>
          <button
            onClick={handleNext}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {currentStep === TUTORIAL_STEPS.EXPORT ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialTooltip; 