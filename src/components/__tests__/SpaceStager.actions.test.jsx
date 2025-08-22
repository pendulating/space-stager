import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('SpaceStager header actions', () => {
  it('toggles InfoPanel via header button', async () => {
    render(<Providers><SpaceStager /></Providers>);
    // Info button is last header button with title Toggle Info
    const infoBtn = await screen.findByTitle('Toggle Info');
    fireEvent.click(infoBtn);
    expect(await screen.findByText('About NYC Public Space Event Stager')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Close'));
    expect(screen.queryByText('About NYC Public Space Event Stager')).not.toBeInTheDocument();
  });

  it('opens hidden input when Import button clicked', async () => {
    render(<Providers><SpaceStager /></Providers>);
    const importBtn = await screen.findByTitle('Import Plan (JSON)');
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');
    fireEvent.click(importBtn);
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});


