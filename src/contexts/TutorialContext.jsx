import React, { createContext, useContext, useReducer, useEffect } from 'react';

// Tutorial step definitions
export const TUTORIAL_STEPS = {
  WELCOME: 'welcome',
  SEARCH: 'search',
  FOCUS_AREA: 'focus_area',
  LAYERS: 'layers',
  DRAWING: 'drawing',
  EXPORT: 'export'
};

// Tutorial step content
export const TUTORIAL_CONTENT = {
  [TUTORIAL_STEPS.WELCOME]: {
    title: 'Welcome to Space Stager!',
    content: 'Design site plans for NYC parks and public spaces.',
    position: 'center',
    showOverlay: true
  },
  [TUTORIAL_STEPS.SEARCH]: {
    title: 'Find a Permit Area',
    content: 'Search for a specific park or public space to start designing.',
    position: 'bottom',
    target: '.permit-area-search'
  },
  [TUTORIAL_STEPS.FOCUS_AREA]: {
    title: 'Focus on an Area',
    content: 'Click on a search result to focus and start designing.',
    position: 'bottom',
    target: '.search-result'
  },
  [TUTORIAL_STEPS.LAYERS]: {
    title: 'Add Infrastructure',
    content: 'Toggle layers to see relevant infrastructure like water fountains, bathrooms, and more.',
    position: 'left',
    target: '.layers-panel'
  },
  [TUTORIAL_STEPS.DRAWING]: {
    title: 'Draw Event Fixtures',
    content: 'Use drawing tools to mark where event fixtures will be placed.',
    position: 'left',
    target: '.drawing-tools'
  },
  [TUTORIAL_STEPS.EXPORT]: {
    title: 'Export Your Site Plan',
    content: 'Export your completed site plan for permits and planning.',
    position: 'top',
    target: '.export-button'
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
  showWelcome: !DISABLE_TUTORIAL
};

// Action types
const TUTORIAL_ACTIONS = {
  START_TUTORIAL: 'START_TUTORIAL',
  COMPLETE_STEP: 'COMPLETE_STEP',
  NEXT_STEP: 'NEXT_STEP',
  PREV_STEP: 'PREV_STEP',
  DISMISS_TUTORIAL: 'DISMISS_TUTORIAL',
  HIDE_WELCOME: 'HIDE_WELCOME',
  RESET_TUTORIAL: 'RESET_TUTORIAL'
};

// Reducer
function tutorialReducer(state, action) {
  switch (action.type) {
    case TUTORIAL_ACTIONS.START_TUTORIAL:
      return {
        ...state,
        isTutorialActive: true,
        currentStep: TUTORIAL_STEPS.SEARCH,
        showWelcome: false
      };
    
    case TUTORIAL_ACTIONS.COMPLETE_STEP:
      return {
        ...state,
        completedSteps: [...state.completedSteps, action.step],
        currentStep: action.nextStep || null,
        isTutorialActive: action.nextStep ? true : false
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
        // Mark steps as completed
        parsed.completedSteps.forEach(step => {
          dispatch({ type: TUTORIAL_ACTIONS.COMPLETE_STEP, step, nextStep: null });
        });
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