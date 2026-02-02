import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useWindowSize } from '../../hooks/useWindowSize';
import { useTutorial, TUTORIAL_STEPS } from '../../contexts/TutorialContext';
import { useGeography } from '../../contexts/GeographyContext';
import { useZoneCreatorContext } from '../../contexts/ZoneCreatorContext';
import { CheckCircle2, AlertCircle, Trophy } from 'lucide-react';

const TutorialTooltip = ({ map, permitAreas, openStreets, clickToPlace, layers, complianceStatus }) => {
  const { 
    isTutorialActive, 
    currentStep, 
    getCurrentStepContent, 
    completeStep, 
    dismissTutorial,
    TUTORIAL_STEPS,
    TUTORIAL_CONTENT,
    lastClickedOpenStreetId,
    zoneGenerated
  } = useTutorial();

  const { geographyType } = useGeography();
  const { selectedNodes, previewActive } = useZoneCreatorContext();

  const { width, height } = useWindowSize();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef(null);
  const retryTimerRef = useRef(null);

  const currentContent = getCurrentStepContent();

  // Progress tracking for the current step
  const isStepValid = useMemo(() => {
    if (!isTutorialActive || !currentStep || !currentContent?.validation) {
      return false;
    }

    const appState = {
      geographyType,
      searchQuery: permitAreas.searchQuery,
      focusedArea: permitAreas.focusedArea,
      lastClickedOpenStreetId,
      zoneGenerated,
      selectedNodes: selectedNodes || [],
      previewActive: !!previewActive,
      layers: {
        'open-streets': { visible: !!openStreets.isVisible },
        'hydrants': { 
          visible: !!layers?.hydrants?.visible,
          requested: !!layers?.hydrants?.requested 
        },
        'busStops': { 
          visible: !!layers?.busStops?.visible,
          requested: !!layers?.busStops?.requested 
        },
        'benches': { 
          visible: !!layers?.benches?.visible,
          requested: !!layers?.benches?.requested 
        },
        'trees': { 
          visible: !!layers?.trees?.visible,
          requested: !!layers?.trees?.requested 
        }
      },
      droppedObjects: clickToPlace.droppedObjects || [],
      isComplianceValid: !!complianceStatus.isLaneClear
    };

    const valid = !!currentContent.validation(appState);
    return valid;
  }, [
    isTutorialActive, 
    currentStep, 
    currentContent, 
    geographyType, 
    permitAreas.searchQuery, 
    permitAreas.focusedArea, 
    selectedNodes,
    previewActive,
    openStreets.isVisible, 
    clickToPlace.droppedObjects, 
    complianceStatus.isLaneClear,
    lastClickedOpenStreetId,
    zoneGenerated,
    layers,
    map
  ]);

  useEffect(() => {
    if (!isTutorialActive || !currentStep || !currentContent) {
      setIsVisible(false);
      return;
    }

    let cleanupTarget = null;
    let attempts = 0;

    const computePosition = () => {
      if (currentContent.position === 'center') {
        setPosition({ top: window.innerHeight / 2, left: window.innerWidth / 2 });
        setIsVisible(true);
        return;
      }

      const targetSelector = currentContent.target;
      if (!targetSelector) {
        // Fallback to center if no target specified
        setPosition({ top: window.innerHeight / 2, left: window.innerWidth / 2 });
        setIsVisible(true);
        return;
      }

      const targetElement = document.querySelector(targetSelector);
      if (!targetElement) {
        attempts += 1;
        if (attempts <= 20) {
          retryTimerRef.current = setTimeout(computePosition, 250);
        } else {
          // Fallback to center if target still not found
          setPosition({ top: window.innerHeight / 2, left: window.innerWidth / 2 });
          setIsVisible(true);
        }
        return;
      }

      console.log('[TutorialTooltip] Target found, computing position...');
      // Ensure the element is visible in the viewport
      try {
        targetElement.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
      } catch (_) {}

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
      const tooltipWidth = tooltipRect?.width || 320;
      const tooltipHeight = tooltipRect?.height || 180;

      // Robust viewport clamping
      if (left + tooltipWidth / 2 > viewportWidth - 20) {
        left = viewportWidth - tooltipWidth / 2 - 20;
      }
      if (left - tooltipWidth / 2 < 20) {
        left = tooltipWidth / 2 + 20;
      }
      if (top + tooltipHeight > viewportHeight - 20) {
        top = viewportHeight - tooltipHeight - 20;
      }
      if (top < 20) {
        top = 20;
      }

      setPosition({ top, left });
      setIsVisible(true);

      // Highlight target element with a subtle glow effect
      // We no longer apply the giant box-shadow overlay as it blocks clicks within the target
      cleanupTarget = targetElement;
      targetElement.style.outline = '3px solid #3b82f6';
      targetElement.style.outlineOffset = '4px';
      targetElement.style.zIndex = '50';
      targetElement.style.position = 'relative';
      // Add a subtle glow for emphasis without blocking interactions
      targetElement.style.boxShadow = '0 0 20px 4px rgba(59, 130, 246, 0.4)';
    };

    // Initial compute and wire up listeners for reflow
    computePosition();
    const handleReflow = () => computePosition();
    window.addEventListener('scroll', handleReflow, true);
    window.addEventListener('resize', handleReflow);

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      window.removeEventListener('scroll', handleReflow, true);
      window.removeEventListener('resize', handleReflow);
      if (cleanupTarget) {
        cleanupTarget.style.outline = '';
        cleanupTarget.style.outlineOffset = '';
        cleanupTarget.style.boxShadow = '';
        cleanupTarget.style.zIndex = '';
        cleanupTarget.style.position = '';
      }
    };
  }, [isTutorialActive, currentStep, currentContent, width, height]);

  if (!isVisible || !currentContent) return null;

  // Actionable steps only (WELCOME is handled by WelcomeOverlay, not counted in progress)
  const stepOrder = [
    TUTORIAL_STEPS.LAYERS_INIT,
    TUTORIAL_STEPS.SEARCH,
    TUTORIAL_STEPS.FOCUS_AREA,
    TUTORIAL_STEPS.LAYERS,
    TUTORIAL_STEPS.INFRASTRUCTURE,
    TUTORIAL_STEPS.DRAWING,
    TUTORIAL_STEPS.EXPORT
  ];

  const handleNext = () => {
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
    return stepOrder.indexOf(currentStep) + 1;
  };

  const totalSteps = stepOrder.length;
  const progressPercentage = (getStepNumber() / totalSteps) * 100;

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[100] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border-2 border-blue-500 w-[320px] overflow-hidden animate-in fade-in zoom-in duration-300"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: currentContent.position === 'center' 
          ? 'translate(-50%, -50%)' 
          : (currentContent.position === 'top' || currentContent.position === 'bottom'
            ? 'translateX(-50%)'
            : currentContent.position === 'left' || currentContent.position === 'right'
              ? 'translateY(-50%)'
              : 'translateX(-50%)')
      }}
    >
      {/* Progress Bar */}
      <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700">
        <div 
          className="h-full bg-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Mission
            </div>
            <span className="text-gray-400 dark:text-gray-500 text-xs font-medium">
              Step {getStepNumber()} of {totalSteps}
            </span>
          </div>
          <button
            onClick={handleSkip}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Title & Icon */}
        <div className="flex items-start gap-3 mb-3">
          <div className="mt-1">
            {currentStep === TUTORIAL_STEPS.EXPORT ? (
              <Trophy className="w-6 h-6 text-yellow-500 animate-bounce" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                {getStepNumber()}
              </div>
            )}
          </div>
          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg leading-tight">
            {currentContent.title}
          </h3>
        </div>

        {/* Description */}
        <p className="text-gray-600 dark:text-gray-300 text-sm mb-5 leading-relaxed">
          {currentContent.content}
        </p>

        {/* Safety Score / Gamified Elements */}
        {currentStep === TUTORIAL_STEPS.DRAWING && (
          <div className="mb-5 space-y-3">
            <div className="flex justify-between text-xs font-bold uppercase tracking-tighter">
              <span className="text-gray-500">Objects Placed</span>
              <span className="text-blue-600">{Math.min(3, clickToPlace.droppedObjects?.length || 0)}/3</span>
            </div>
            <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${Math.min(100, ((clickToPlace.droppedObjects?.length || 0) / 3) * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-tighter text-gray-500">Safety Status</span>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                complianceStatus.isLaneClear 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {complianceStatus.isLaneClear ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    Safe
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3" />
                    Violation
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Interactivity Indicator */}
        {currentContent.validation && (
          <div className={`flex items-center gap-2 p-3 rounded-lg mb-5 border transition-colors ${
            isStepValid 
              ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' 
              : 'bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-800'
          }`}>
            {isStepValid ? (
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
            )}
            <span className={`text-xs font-medium ${isStepValid ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300'}`}>
              {isStepValid ? 'Task complete! Advancing...' : 'Waiting for your action...'}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={handleSkip}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Skip Mission
          </button>
          
          {!currentContent.validation && (
            <button
              onClick={handleNext}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              {currentStep === TUTORIAL_STEPS.EXPORT ? 'Finish Mission' : 'Got it!'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TutorialTooltip; 