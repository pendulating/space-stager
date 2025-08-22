import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import App from '../App.jsx';

// Mock heavy child tree to keep this as a light smoke test
vi.mock('../components/SpaceStager', () => ({ default: () => <div data-testid="space-stager-root">SpaceStager</div> }));
vi.mock('../components/MobileLanding', () => ({ default: () => <div data-testid="mobile-landing-root">Mobile</div> }));

describe('App', () => {
  const originalInnerWidth = global.innerWidth;
  let resizeListener;

  beforeEach(() => {
    resizeListener = undefined;
    vi.spyOn(window, 'addEventListener').mockImplementation((type, cb) => {
      if (type === 'resize') resizeListener = cb;
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
  });

  afterEach(() => {
    // reset spies
    vi.restoreAllMocks();
    // reset window size
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
  });

  it('renders MobileLanding on small viewports (<768px)', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 600 });
    render(<App />);
    expect(screen.getByTestId('mobile-landing-root')).toBeInTheDocument();
  });

  it('renders SpaceStager on desktop viewports (>=768px) and responds to resize', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    render(<App />);
    expect(screen.getByTestId('space-stager-root')).toBeInTheDocument();

    // Simulate resize to small
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 700 });
    if (typeof resizeListener === 'function') {
      act(() => {
        resizeListener();
      });
    }
    expect(screen.getByTestId('mobile-landing-root')).toBeInTheDocument();
  });
});


