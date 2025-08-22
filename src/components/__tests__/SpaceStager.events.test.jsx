import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SpaceStager from '../SpaceStager.jsx';
import { GeographyProvider } from '../../contexts/GeographyContext.jsx';
import { TutorialProvider } from '../../contexts/TutorialContext.jsx';
import { SitePlanProvider } from '../../contexts/SitePlanContext.jsx';
import { ZoneCreatorProvider } from '../../contexts/ZoneCreatorContext.jsx';

function Providers({ children }){
  return (
    <GeographyProvider>
      <TutorialProvider>
        <SitePlanProvider>
          <ZoneCreatorProvider>{children}</ZoneCreatorProvider>
        </SitePlanProvider>
      </TutorialProvider>
    </GeographyProvider>
  );
}

describe('SpaceStager UI events', () => {
  it('opens EventInfoModal when ui:show-event-info is dispatched', async () => {
    render(<Providers><SpaceStager /></Providers>);
    window.dispatchEvent(new CustomEvent('ui:show-event-info'));
    expect(await screen.findByText('Event Information')).toBeInTheDocument();
  });

  it('opens ExportOptionsModal when ui:show-export-options is dispatched', async () => {
    render(<Providers><SpaceStager /></Providers>);
    window.dispatchEvent(new CustomEvent('ui:show-export-options'));
    expect(await screen.findByText('Export Options')).toBeInTheDocument();
  });
});


