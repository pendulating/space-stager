import { useEffect, useRef } from 'react';
import { useTutorial } from '../contexts/TutorialContext';
import { useGeography } from '../contexts/GeographyContext';

/**
 * Hook to monitor user actions and validate tutorial steps.
 * This acts as the 'interactivity engine' for the tutorial.
 */
export function useTutorialProgress(map, { permitAreas, openStreets, clickToPlace, layers, complianceStatus, selectedNodes, previewActive }) {
  const { 
    isTutorialActive, 
    currentStep, 
    completeStep, 
    TUTORIAL_STEPS,
    TUTORIAL_CONTENT,
    lastClickedOpenStreetId,
    setLastClickedOpenStreetId,
    zoneGenerated,
    setZoneGenerated
  } = useTutorial();

  const { geographyType } = useGeography();

  // Track last completed step to prevent duplicate completions
  const lastCompletedStepRef = useRef(null);

  // Sync transient interaction flags from events
  useEffect(() => {
    const clickHandler = (e) => {
      const id = e.detail?.id;
      console.log('[useTutorialProgress] Received openstreet:click event for ID:', id);
      setLastClickedOpenStreetId(id);
    };
    const generateHandler = () => {
      console.log('[useTutorialProgress] Received tutorial:zone-generated event');
      setZoneGenerated(true);
    };
    window.addEventListener('openstreet:click', clickHandler);
    window.addEventListener('tutorial:zone-generated', generateHandler);
    return () => {
      window.removeEventListener('openstreet:click', clickHandler);
      window.removeEventListener('tutorial:zone-generated', generateHandler);
    };
  }, [setLastClickedOpenStreetId, setZoneGenerated]);

  // Reset tracking when step changes
  useEffect(() => {
    // When currentStep changes, reset our completion tracker
    // This allows the new step to be validated and completed
    lastCompletedStepRef.current = null;
  }, [currentStep]);

  // Main validation effect - runs on every relevant state change
  useEffect(() => {
    // Guard clauses
    if (!isTutorialActive || !currentStep) return;
    if (lastCompletedStepRef.current === currentStep) return; // Already completed this step

    const stepConfig = TUTORIAL_CONTENT[currentStep];
    if (!stepConfig?.validation) return;

    // Build application state for validation
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
        'hydrants': { visible: !!layers?.hydrants?.visible, requested: !!layers?.hydrants?.requested },
        'busStops': { visible: !!layers?.busStops?.visible, requested: !!layers?.busStops?.requested },
        'benches': { visible: !!layers?.benches?.visible, requested: !!layers?.benches?.requested },
        'trees': { visible: !!layers?.trees?.visible, requested: !!layers?.trees?.requested }
      },
      droppedObjects: clickToPlace.droppedObjects || [],
      isComplianceValid: !!complianceStatus.isLaneClear
    };

    // Check validation
    const isValid = stepConfig.validation(appState);
    
    if (isValid) {
      console.log(`[Tutorial] Step ${currentStep} validated! Completing immediately.`);
      
      // Mark as completed BEFORE calling completeStep to prevent re-entry
      lastCompletedStepRef.current = currentStep;
      
      // Calculate next step
      const stepOrder = [
        TUTORIAL_STEPS.LAYERS_INIT,
        TUTORIAL_STEPS.SEARCH,
        TUTORIAL_STEPS.FOCUS_AREA,
        TUTORIAL_STEPS.LAYERS,
        TUTORIAL_STEPS.INFRASTRUCTURE,
        TUTORIAL_STEPS.DRAWING,
        TUTORIAL_STEPS.EXPORT
      ];
      const currentIndex = stepOrder.indexOf(currentStep);
      const nextStep = currentIndex !== -1 && currentIndex < stepOrder.length - 1 
        ? stepOrder[currentIndex + 1] 
        : null;

      // Pan to St. Marks Place when entering SEARCH step
      if (nextStep === TUTORIAL_STEPS.SEARCH && map) {
        map.easeTo({
          center: [-73.985, 40.728],
          zoom: 17.5,
          duration: 2500,
          essential: true
        });
      }

      // Complete the step immediately - no setTimeout!
      // The reducer handles duplicate prevention via completedSteps
      completeStep(currentStep, nextStep);
    }
  }, [
    isTutorialActive,
    currentStep,
    geographyType,
    permitAreas.searchQuery,
    permitAreas.focusedArea,
    openStreets.isVisible,
    clickToPlace.droppedObjects,
    complianceStatus.isLaneClear,
    selectedNodes,
    previewActive,
    lastClickedOpenStreetId,
    zoneGenerated,
    completeStep,
    TUTORIAL_STEPS,
    TUTORIAL_CONTENT,
    map,
    layers
  ]);

  return null;
}
