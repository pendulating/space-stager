import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TutorialProvider } from '../../../contexts/TutorialContext.jsx';
import WelcomeOverlay from '../WelcomeOverlay.jsx';

describe('WelcomeOverlay', () => {
  it('renders when showWelcome is true and triggers start/skip', () => {
    render(
      <TutorialProvider>
        <WelcomeOverlay />
      </TutorialProvider>
    );
    expect(screen.getByText('Welcome to Space Stager!')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Start Tutorial'));
    // Welcome should be hidden after start (provider sets isTutorialActive)
    // Since WelcomeOverlay immediately unmounts, query should fail
    expect(screen.queryByText('Welcome to Space Stager!')).toBeNull();
  });
});


