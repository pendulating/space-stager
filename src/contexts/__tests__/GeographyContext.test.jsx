import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GeographyProvider, useGeography } from '../GeographyContext.jsx';

function Harness() {
  const { geographyType, isGeographyChosen, selectGeography, resetGeography } = useGeography();
  return (
    <div>
      <div data-testid="type">{geographyType}</div>
      <div data-testid="chosen">{String(isGeographyChosen)}</div>
      <button onClick={() => selectGeography('intersections')}>select</button>
      <button onClick={resetGeography}>reset</button>
    </div>
  );
}

describe('GeographyContext', () => {
  it('defaults to parks and can select/reset with localStorage side effects', () => {
    render(
      <GeographyProvider>
        <Harness />
      </GeographyProvider>
    );
    expect(screen.getByTestId('type').textContent).toBe('parks');
    expect(screen.getByTestId('chosen').textContent).toBe('false');
    fireEvent.click(screen.getByText('select'));
    expect(screen.getByTestId('type').textContent).toBe('intersections');
    expect(screen.getByTestId('chosen').textContent).toBe('true');
    fireEvent.click(screen.getByText('reset'));
    expect(screen.getByTestId('type').textContent).toBe('parks');
    expect(screen.getByTestId('chosen').textContent).toBe('false');
  });
});


