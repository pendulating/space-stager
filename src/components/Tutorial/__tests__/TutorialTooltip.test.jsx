import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TutorialProvider, useTutorial } from '../../../contexts/TutorialContext.jsx';
import TutorialTooltip from '../TutorialTooltip.jsx';

function StartHarness() {
  const { startTutorial, nextStep, TUTORIAL_STEPS } = useTutorial();
  React.useEffect(() => {
    startTutorial();
    nextStep(TUTORIAL_STEPS.SEARCH);
    // Add a dummy target element for positioning
    const el = document.createElement('div');
    el.className = 'permit-area-search';
    document.body.appendChild(el);
    return () => { document.body.removeChild(el); };
  }, []);
  return <TutorialTooltip />;
}

describe('TutorialTooltip', () => {
  it('renders for current step and advances on Next', async () => {
    render(
      <TutorialProvider>
        <StartHarness />
      </TutorialProvider>
    );
    // Title from SEARCH step
    expect(await screen.findByText('Find a Permit Area')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Next'));
  });
});


