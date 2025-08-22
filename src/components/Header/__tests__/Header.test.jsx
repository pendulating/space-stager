import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Helper to dynamically import Header with a mocked TutorialContext
async function renderHeaderWithTutorialMock(mockValues, props = {}) {
  vi.resetModules();
  vi.doMock('../../../contexts/TutorialContext', () => ({
    useTutorial: () => ({
      isTutorialDisabled: false,
      disableTutorial: vi.fn(),
      enableTutorial: vi.fn(),
      ...mockValues,
    }),
  }));
  const Header = (await import('../Header.jsx')).default;
  const defaultProps = {
    showInfo: false,
    setShowInfo: vi.fn(),
    isDarkMode: false,
    onToggleDarkMode: vi.fn(),
    onImportClick: vi.fn(),
  };
  const utils = render(<Header {...defaultProps} {...props} />);
  return { Header, ...utils, ...defaultProps, ...props };
}

describe('Header', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Restore environment between tests
    process.env.NODE_ENV = originalEnv;
  });

  it('renders title and buttons; import click triggers callback', async () => {
    const { onImportClick } = await renderHeaderWithTutorialMock({});
    expect(screen.getByText('SpaceStager NYC')).toBeInTheDocument();
    const importBtn = screen.getByLabelText('Import plan');
    fireEvent.click(importBtn);
    expect(onImportClick).toHaveBeenCalledTimes(1);
  });

  it('toggles info via setShowInfo(!showInfo)', async () => {
    const setShowInfo = vi.fn();
    await renderHeaderWithTutorialMock({}, { showInfo: false, setShowInfo });
    const infoBtn = screen.getByTitle('Toggle Info');
    fireEvent.click(infoBtn);
    expect(setShowInfo).toHaveBeenCalledWith(true);
  });

  it('dark mode button calls onToggleDarkMode and reflects icon/title', async () => {
    const onToggleDarkMode = vi.fn();
    // Light mode view
    await renderHeaderWithTutorialMock({}, { isDarkMode: false, onToggleDarkMode });
    const darkBtn = screen.getByTitle('Switch to Dark Mode');
    fireEvent.click(darkBtn);
    expect(onToggleDarkMode).toHaveBeenCalledTimes(1);

    // Re-render in dark mode to validate alt title
    const { rerender } = await renderHeaderWithTutorialMock({}, { isDarkMode: true, onToggleDarkMode });
    expect(screen.getByTitle('Switch to Light Mode')).toBeInTheDocument();
  });

  it('does not show dev tutorial toggle when not in development', async () => {
    process.env.NODE_ENV = 'test';
    await renderHeaderWithTutorialMock({});
    // The dev toggle is the button with Settings icon; absence is sufficient
    expect(screen.queryByTitle(/Disable Tutorial|Enable Tutorial/i)).not.toBeInTheDocument();
  });

  it('shows dev tutorial toggle in development and calls disableTutorial', async () => {
    process.env.NODE_ENV = 'development';
    const handlers = { disableTutorial: vi.fn(), enableTutorial: vi.fn(), isTutorialDisabled: false };
    await renderHeaderWithTutorialMock(handlers);
    const btn = screen.getByTitle('Disable Tutorial');
    fireEvent.click(btn);
    expect(handlers.disableTutorial).toHaveBeenCalledTimes(1);
  });

  it('shows dev tutorial toggle in development and calls enableTutorial when disabled', async () => {
    process.env.NODE_ENV = 'development';
    const handlers = { disableTutorial: vi.fn(), enableTutorial: vi.fn(), isTutorialDisabled: true };
    await renderHeaderWithTutorialMock(handlers);
    const btn = screen.getByTitle('Enable Tutorial');
    fireEvent.click(btn);
    expect(handlers.enableTutorial).toHaveBeenCalledTimes(1);
  });
});


