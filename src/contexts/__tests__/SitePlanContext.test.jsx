import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SitePlanProvider, useSitePlan } from '../SitePlanContext.jsx';

function Harness() {
  const { isSitePlanMode, zoomLevel, updateSitePlanMode, shouldBeInSitePlanMode } = useSitePlan();
  return (
    <div>
      <div data-testid="mode">{String(isSitePlanMode)}</div>
      <div data-testid="zoom">{String(zoomLevel)}</div>
      <button onClick={() => updateSitePlanMode({ id: 'a1' }, 15)}>on</button>
      <button onClick={() => updateSitePlanMode(null, 13)}>off</button>
      <div data-testid="should">{String(shouldBeInSitePlanMode({ id: 'a1' }, 15))}</div>
    </div>
  );
}

describe('SitePlanContext', () => {
  it('computes site plan mode and updates state based on inputs', () => {
    render(
      <SitePlanProvider>
        <Harness />
      </SitePlanProvider>
    );
    expect(screen.getByTestId('mode').textContent).toBe('false');
    expect(screen.getByTestId('should').textContent).toBe('true');
    fireEvent.click(screen.getByText('on'));
    expect(screen.getByTestId('mode').textContent).toBe('true');
    expect(screen.getByTestId('zoom').textContent).toBe('15');
    fireEvent.click(screen.getByText('off'));
    expect(screen.getByTestId('mode').textContent).toBe('false');
  });
});


