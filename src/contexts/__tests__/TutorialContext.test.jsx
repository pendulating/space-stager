import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TutorialProvider, useTutorial } from '../TutorialContext.jsx';

function Harness() {
  const { showWelcome, isTutorialActive, currentStep, startTutorial, completeStep, nextStep, dismissTutorial, resetTutorial, TUTORIAL_STEPS } = useTutorial();
  return (
    <div>
      <div data-testid="welcome">{String(showWelcome)}</div>
      <div data-testid="active">{String(isTutorialActive)}</div>
      <div data-testid="step">{String(currentStep)}</div>
      <button onClick={() => startTutorial()}>start</button>
      <button onClick={() => completeStep(TUTORIAL_STEPS.SEARCH, TUTORIAL_STEPS.FOCUS_AREA)}>complete</button>
      <button onClick={() => nextStep(TUTORIAL_STEPS.LAYERS)}>next</button>
      <button onClick={() => dismissTutorial()}>dismiss</button>
      <button onClick={() => resetTutorial()}>reset</button>
    </div>
  );
}

describe('TutorialContext', () => {
  it('progresses tutorial steps and can dismiss/reset', () => {
    render(
      <TutorialProvider>
        <Harness />
      </TutorialProvider>
    );
    // welcome shown initially
    expect(screen.getByTestId('welcome').textContent).toBe('true');
    // start
    fireEvent.click(screen.getByText('start'));
    expect(screen.getByTestId('active').textContent).toBe('true');
    // complete step advances to next
    fireEvent.click(screen.getByText('complete'));
    expect(screen.getByTestId('step').textContent).toBe('focus_area');
    // next step
    fireEvent.click(screen.getByText('next'));
    expect(screen.getByTestId('step').textContent).toBe('layers');
    // dismiss
    fireEvent.click(screen.getByText('dismiss'));
    expect(screen.getByTestId('active').textContent).toBe('false');
    // reset
    fireEvent.click(screen.getByText('reset'));
    expect(screen.getByTestId('welcome').textContent).toBe('true');
  });
});


