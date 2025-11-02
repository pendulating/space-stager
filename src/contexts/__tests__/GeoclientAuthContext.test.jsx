import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GeoclientAuthProvider, useGeoclientAuth } from '../GeoclientAuthContext.jsx';

function Harness() {
  const { key, setKey, clearKey, remember } = useGeoclientAuth();
  return (
    <div>
      <div data-testid="key">{key}</div>
      <div data-testid="remember">{String(remember)}</div>
      <button onClick={() => setKey('abc', { remember: true })}>save</button>
      <button onClick={() => clearKey()}>clear</button>
    </div>
  );
}

describe('GeoclientAuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists and clears key from localStorage when remember is set', () => {
    render(
      <GeoclientAuthProvider>
        <Harness />
      </GeoclientAuthProvider>
    );
    expect(screen.getByTestId('key').textContent).toBe('');
    fireEvent.click(screen.getByText('save'));
    expect(localStorage.getItem('geoclient.v2.key')).toBe('abc');
    expect(localStorage.getItem('geoclient.v2.remember')).toBe('1');

    fireEvent.click(screen.getByText('clear'));
    expect(localStorage.getItem('geoclient.v2.key')).toBe(null);
  });

  it('throws when hook used outside provider', () => {
    function Broken() { useGeoclientAuth(); return null; }
    expect(() => render(<Broken />)).toThrow(/within GeoclientAuthProvider/);
  });
});
