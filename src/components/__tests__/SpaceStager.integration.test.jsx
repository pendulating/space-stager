import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import SpaceStager from '../SpaceStager.jsx';
import { GeographyProvider } from '../../contexts/GeographyContext.jsx';
import { TutorialProvider } from '../../contexts/TutorialContext.jsx';
import { SitePlanProvider } from '../../contexts/SitePlanContext.jsx';
import { ZoneCreatorProvider } from '../../contexts/ZoneCreatorContext.jsx';

// Smoke integration: renders core chrome and map container shell
describe('SpaceStager integration', () => {
  it('renders header, sidebars/map shell, and tutorial components', () => {
    // Ensure clean storages for geography/tutorial
    window.localStorage.clear();
    window.sessionStorage.clear();

    render(
      <TutorialProvider>
        <GeographyProvider>
          <SitePlanProvider>
            <ZoneCreatorProvider>
              <SpaceStager />
            </ZoneCreatorProvider>
          </SitePlanProvider>
        </GeographyProvider>
      </TutorialProvider>
    );

    // Header buttons
    expect(screen.getByRole('button', { name: /info/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dark mode/i })).toBeInTheDocument();

    // Map UI bits
    expect(screen.getByTitle('Reset North')).toBeInTheDocument();
    expect(screen.getByTitle('Toggle projection (Top-down / Isometric)')).toBeInTheDocument();

    // Left sidebar collapse control
    expect(screen.getByRole('button', { name: /collapse sidebar/i })).toBeInTheDocument();
  });
});


