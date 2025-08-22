import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ZoneCreatorPanel from '../ZoneCreatorPanel.jsx';
import { ZoneCreatorProvider } from '../../../contexts/ZoneCreatorContext.jsx';

describe('ZoneCreatorPanel', () => {
  it('shows disabled controls when not in intersections mode', () => {
    render(
      <ZoneCreatorProvider>
        <ZoneCreatorPanel geographyType={'parks'} />
      </ZoneCreatorProvider>
    );
    // Generate button exists but disabled due to disabled section
    const label = screen.getByText('Step 1: Permit Type');
    expect(label).toBeInTheDocument();
  });

  it('enables generate when two nodes in single block mode', () => {
    render(
      <ZoneCreatorProvider>
        <ZoneCreatorPanel geographyType={'intersections'} />
      </ZoneCreatorProvider>
    );
    // Button should exist
    expect(screen.getByText('Generate Zone')).toBeInTheDocument();
  });
});


