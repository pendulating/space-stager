import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../../contexts/GeoclientAuthContext.jsx', () => {
  const state = { key: 'abc', remember: true };
  const mockedFns = {
    setKey: vi.fn((k, { remember }) => { state.key = k; state.remember = remember; }),
    clearKey: vi.fn(() => { state.key = ''; })
  };
  return {
    __esModule: true,
    useGeoclientAuth: () => ({
      key: state.key,
      remember: state.remember,
      setKey: mockedFns.setKey,
      clearKey: mockedFns.clearKey
    }),
    mockedFns
  };
});

// Import mocked exports from the mocked module (Vitest will resolve to the mock)
import { mockedFns } from '../../../contexts/GeoclientAuthContext.jsx';
import GeoclientSettingsModal from '../GeoclientSettingsModal.jsx';

describe('GeoclientSettingsModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when not open', () => {
    const { container } = render(<GeoclientSettingsModal isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('reflects context values and supports Save, Clear and Close', () => {
    const onClose = vi.fn();

    render(<GeoclientSettingsModal isOpen={true} onClose={onClose} />);

    const pwd = screen.getByPlaceholderText(/paste your key/i);
    const remember = screen.getByRole('checkbox');
    expect(pwd).toHaveValue('abc');
    expect(remember).toBeChecked();

    // Clear wipes key
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(mockedFns.clearKey).toHaveBeenCalled();

    // Enter a new key and uncheck remember; Save writes and closes
    fireEvent.change(pwd, { target: { value: 'NEW_KEY' } });
    fireEvent.click(remember); // uncheck
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(mockedFns.setKey).toHaveBeenCalledWith('NEW_KEY', { remember: false });
    expect(onClose).toHaveBeenCalled();

    // Close button
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});


