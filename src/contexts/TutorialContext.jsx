import React, { createContext, useContext, useReducer, useEffect } from 'react';

// Tutorial step definitions
export const TUTORIAL_STEPS = {
  WELCOME: 'welcome',
  LAYERS_INIT: 'layers_init',
  SEARCH: 'search',
  FOCUS_AREA: 'focus_area',
  LAYERS: 'layers',
  INFRASTRUCTURE: 'infrastructure',
  DRAWING: 'drawing',
  EXPORT: 'export'
};

// Tutorial step content
export const TUTORIAL_CONTENT = {
  [TUTORIAL_STEPS.WELCOME]: {
    title: 'Mission: St. Marks Place',
    content: 'Welcome! Your mission is to design a site plan for the St. Marks Place Open Street event. Let\'s get started.',
    position: 'center',
    showOverlay: true
  },
  [TUTORIAL_STEPS.LAYERS_INIT]: {
    title: 'Enable Open Streets Layer',
    content: 'First, expand the "Open Streets Events" panel in the sidebar and click "Show on Map" to see where active events are happening.',
    position: 'right',
    target: '.open-streets-panel',
    validation: (state) => {
      // Check if open-streets layer is visible in the state
      const visible = !!state.layers?.['open-streets']?.visible;
      console.log('[Tutorial] LAYERS_INIT validation - Open Streets visible:', visible);
      return visible;
    }
  },
  [TUTORIAL_STEPS.SEARCH]: {
    title: 'Find St. Marks Open Street',
    content: 'Great! The map now shows Open Street locations. Expand the "Nearby Segments" list in the sidebar and click on any segment to select it (or click directly on an orange line on the map).',
    position: 'left',
    target: '.open-streets-panel',
    validation: (state) => {
      // Register complete when ANY Open Street is clicked
      const clickedId = state.lastClickedOpenStreetId;
      console.log('[Tutorial] SEARCH validation - clickedId:', clickedId);
      // Accept any clicked Open Street ID to make tutorial more flexible
      return clickedId !== null && clickedId !== undefined;
    }
  },
  [TUTORIAL_STEPS.FOCUS_AREA]: {
    title: 'Start Building Your Zone',
    content: 'You\'ve found an Open Street! Now let\'s build a zone for your site plan. First, turn OFF the Open Streets layer by clicking "On" in the panel. Then click on two orange intersection points on the map to define your zone boundaries.',
    position: 'right',
    target: '.open-streets-panel',
    validation: (state) => {
      // Part 1: Layer must be off
      const layerOff = !state.layers?.['open-streets']?.visible;
      // Part 2: At least one node selected to start the zone
      const hasNodes = state.selectedNodes?.length >= 1;
      console.log('[Tutorial] FOCUS_AREA validation - layerOff:', layerOff, 'hasNodes:', hasNodes, 'nodeCount:', state.selectedNodes?.length);
      // Easier validation: just need layer off and at least one node selected
      return layerOff && hasNodes;
    }
  },
  [TUTORIAL_STEPS.LAYERS]: {
    title: 'Extend and Generate Zone',
    content: 'Click on additional intersection points (blue pills) to extend your zone. When you have at least 2 points, click "Finish & Generate Zone" to create your design area.',
    position: 'right',
    target: '.zone-creator-panel',
    validation: (state) => {
      // Check for zone generation via multiple signals
      const isGenerated = state.zoneGenerated === true || 
                          state.focusedArea?.id === 'zonecreator-preview' || 
                          state.focusedArea?.properties?.name === 'Custom Street Zone' ||
                          state.previewActive === true;
      console.log('[Tutorial] LAYERS validation - zoneGenerated:', state.zoneGenerated, 'previewActive:', state.previewActive, 'isGenerated:', isGenerated);
      return isGenerated;
    }
  },
  [TUTORIAL_STEPS.INFRASTRUCTURE]: {
    title: 'Load Infrastructure Layers',
    content: 'Your zone is ready! Now let\'s see what infrastructure is on the street. In the Infrastructure Layers section, click "All Recommended" to load hydrants, bus stops, and other important constraints.',
    position: 'right',
    target: '.layers-panel',
    validation: (state) => {
      // Check if at least some recommended layers are toggled on
      const recommendedLayerIds = ['hydrants', 'busStops', 'benches', 'trees'];
      const activeCount = recommendedLayerIds.filter(id => 
        state.layers?.[id]?.requested || state.layers?.[id]?.visible
      ).length;
      console.log('[Tutorial] INFRASTRUCTURE validation - activeCount:', activeCount);
      return activeCount >= 2; 
    }
  },
  [TUTORIAL_STEPS.DRAWING]: {
    title: 'Design Your Site Plan',
    content: 'Excellent! Now it\'s time to design. Use the tools on the right sidebar to place objects like tables, barriers, or seating. Place at least 3 items and make sure they don\'t block hydrants or the emergency lane.',
    position: 'left',
    target: '.maplibregl-canvas',
    validation: (state) => {
      const objectCount = state.droppedObjects?.length || 0;
      const isSafe = state.isComplianceValid !== false; // Default to true if undefined
      console.log('[Tutorial] DRAWING validation - objectCount:', objectCount, 'isSafe:', isSafe);
      return objectCount >= 3 && isSafe;
    }
  },
  [TUTORIAL_STEPS.EXPORT]: {
    title: 'Mission Complete!',
    content: 'Congratulations! Your site plan is complete and safety-compliant. You can now export your plan as a PDF or image using the export button in the right sidebar.',
    position: 'center',
    showOverlay: true
  }
};

// Development flag to disable tutorial
const DISABLE_TUTORIAL = process.env.NODE_ENV === 'development' && 
  (localStorage.getItem('DISABLE_TUTORIAL') === 'true' || 
   window.location.search.includes('disable-tutorial'));

// Initial state
const initialState = {
  isFirstVisit: true,
  isTutorialActive: false,
  currentStep: null,
  completedSteps: [],
  dismissed: false,
  showWelcome: !DISABLE_TUTORIAL,
  // Transient interaction flags
  lastClickedOpenStreetId: null,
  zoneGenerated: false
};

// Action types
const TUTORIAL_ACTIONS = {
  START_TUTORIAL: 'START_TUTORIAL',
  COMPLETE_STEP: 'COMPLETE_STEP',
  RESTORE_COMPLETED_STEPS: 'RESTORE_COMPLETED_STEPS', // For localStorage restoration only
  NEXT_STEP: 'NEXT_STEP',
  PREV_STEP: 'PREV_STEP',
  DISMISS_TUTORIAL: 'DISMISS_TUTORIAL',
  HIDE_WELCOME: 'HIDE_WELCOME',
  RESET_TUTORIAL: 'RESET_TUTORIAL',
  SET_CLICKED_ID: 'SET_CLICKED_ID',
  SET_ZONE_GENERATED: 'SET_ZONE_GENERATED'
};

// Reducer
function tutorialReducer(state, action) {
  switch (action.type) {
    case TUTORIAL_ACTIONS.START_TUTORIAL:
      return {
        ...state,
        isTutorialActive: true,
        currentStep: TUTORIAL_STEPS.LAYERS_INIT,
        showWelcome: false,
        // Clear all progress for a fresh tutorial start
        completedSteps: [],
        lastClickedOpenStreetId: null,
        zoneGenerated: false
      };
    
    case TUTORIAL_ACTIONS.COMPLETE_STEP:
      console.log(`[Tutorial Reducer] Completing step ${action.step}, moving to ${action.nextStep}`);
      
      // Prevent completing the same step multiple times
      if (state.completedSteps.includes(action.step)) {
        return state;
      }

      return {
        ...state,
        completedSteps: [...state.completedSteps, action.step],
        currentStep: action.nextStep || null,
        isTutorialActive: !!action.nextStep,
        // Reset transient flags on step completion
        lastClickedOpenStreetId: null,
        zoneGenerated: false
      };
    
    case TUTORIAL_ACTIONS.SET_CLICKED_ID:
      return { ...state, lastClickedOpenStreetId: action.id };
    
    case TUTORIAL_ACTIONS.SET_ZONE_GENERATED:
      return { ...state, zoneGenerated: action.value };
    
    case TUTORIAL_ACTIONS.RESTORE_COMPLETED_STEPS:
      // Only restore completedSteps, don't change currentStep or isTutorialActive
      // This is used for localStorage restoration to avoid overwriting active state
      return {
        ...state,
        completedSteps: action.steps || []
      };
    
    case TUTORIAL_ACTIONS.NEXT_STEP:
      return {
        ...state,
        currentStep: action.step
      };
    
    case TUTORIAL_ACTIONS.DISMISS_TUTORIAL:
      return {
        ...state,
        isTutorialActive: false,
        currentStep: null,
        dismissed: true
      };
    
    case TUTORIAL_ACTIONS.HIDE_WELCOME:
      return {
        ...state,
        showWelcome: false
      };
    
    case TUTORIAL_ACTIONS.RESET_TUTORIAL:
      return {
        ...initialState,
        isFirstVisit: false
      };
    
    default:
      return state;
  }
}

// Context
const TutorialContext = createContext();

// Provider component
export function TutorialProvider({ children }) {
  const [state, dispatch] = useReducer(tutorialReducer, initialState);

  // Load tutorial state from localStorage on mount
  useEffect(() => {
    // Check if tutorial is disabled in development
    if (DISABLE_TUTORIAL) {
      dispatch({ type: TUTORIAL_ACTIONS.DISMISS_TUTORIAL });
      return;
    }

    const savedState = localStorage.getItem('spaceStagerTutorial');
    if (savedState) {
      const parsed = JSON.parse(savedState);
      if (parsed.dismissed) {
        dispatch({ type: TUTORIAL_ACTIONS.DISMISS_TUTORIAL });
      }
      if (parsed.completedSteps?.length > 0) {
        // Restore completed steps without affecting currentStep or isTutorialActive
        dispatch({ type: TUTORIAL_ACTIONS.RESTORE_COMPLETED_STEPS, steps: parsed.completedSteps });
      }
    }
  }, []);

  // Save tutorial state to localStorage when it changes
  useEffect(() => {
    const stateToSave = {
      dismissed: state.dismissed,
      completedSteps: state.completedSteps,
      isFirstVisit: false
    };
    localStorage.setItem('spaceStagerTutorial', JSON.stringify(stateToSave));
  }, [state.dismissed, state.completedSteps]);

  // Actions
  const startTutorial = () => {
    dispatch({ type: TUTORIAL_ACTIONS.START_TUTORIAL });
  };

  const completeStep = (step, nextStep = null) => {
    console.log(`[Tutorial Context] completeStep called for ${step} -> ${nextStep}`);
    
    // Note: We removed the stale closure check (state.currentStep !== step)
    // The reducer already prevents duplicate completions via completedSteps.includes()
    // This fixes the stale closure issue when called from setTimeout
    dispatch({ type: TUTORIAL_ACTIONS.COMPLETE_STEP, step, nextStep });
  };

  const nextStep = (step) => {
    dispatch({ type: TUTORIAL_ACTIONS.NEXT_STEP, step });
  };

  const dismissTutorial = () => {
    dispatch({ type: TUTORIAL_ACTIONS.DISMISS_TUTORIAL });
  };

  const hideWelcome = () => {
    dispatch({ type: TUTORIAL_ACTIONS.HIDE_WELCOME });
  };

  const resetTutorial = () => {
    dispatch({ type: TUTORIAL_ACTIONS.RESET_TUTORIAL });
  };

  const setLastClickedOpenStreetId = (id) => {
    dispatch({ type: TUTORIAL_ACTIONS.SET_CLICKED_ID, id });
  };

  const setZoneGenerated = (value) => {
    dispatch({ type: TUTORIAL_ACTIONS.SET_ZONE_GENERATED, value });
  };

  const isStepCompleted = (step) => {
    return state.completedSteps.includes(step);
  };

  const getCurrentStepContent = () => {
    return state.currentStep ? TUTORIAL_CONTENT[state.currentStep] : null;
  };

  // Development utilities
  const disableTutorial = () => {
    if (process.env.NODE_ENV === 'development') {
      localStorage.setItem('DISABLE_TUTORIAL', 'true');
      window.location.reload();
    }
  };

  const enableTutorial = () => {
    if (process.env.NODE_ENV === 'development') {
      localStorage.removeItem('DISABLE_TUTORIAL');
      window.location.reload();
    }
  };

  const isTutorialDisabled = DISABLE_TUTORIAL;

  const value = {
    ...state,
    startTutorial,
    completeStep,
    nextStep,
    dismissTutorial,
    hideWelcome,
    resetTutorial,
    isStepCompleted,
    getCurrentStepContent,
    setLastClickedOpenStreetId,
    setZoneGenerated,
    disableTutorial,
    enableTutorial,
    isTutorialDisabled,
    TUTORIAL_STEPS,
    TUTORIAL_CONTENT
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

// Hook to use tutorial context
export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}
