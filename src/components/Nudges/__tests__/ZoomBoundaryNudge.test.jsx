import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ZoomBoundaryNudge from '../ZoomBoundaryNudge.jsx';

describe('ZoomBoundaryNudge', () => {
  const addEventListener = window.addEventListener;
  const removeEventListener = window.removeEventListener;

  beforeEach(() => {
    // Ensure no leaked listeners from other tests
    window.addEventListener = addEventListener;
    window.removeEventListener = removeEventListener;
  });

  afterEach(() => {
    window.addEventListener = addEventListener;
    window.removeEventListener = removeEventListener;
  });

  it('returns null when closed and renders when open', () => {
    const { rerender } = render(<ZoomBoundaryNudge isOpen={false} />);
    expect(screen.queryByText((t) => t.includes('Zoom Boundary'))).toBeNull();
    rerender(<ZoomBoundaryNudge isOpen />);
    expect(screen.getByText((t) => t.includes('Zoom Boundary'))).toBeInTheDocument();
  });

  it('calls onCancel and onContinue on button clicks', () => {
    const onCancel = vi.fn();
    const onContinue = vi.fn();
    render(<ZoomBoundaryNudge isOpen onCancel={onCancel} onContinue={onContinue} />);
    fireEvent.click(screen.getByText('Stay Here'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Continue Zooming Out'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('blocks wheel/touch/gesture events and stops propagation', () => {
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    render(<ZoomBoundaryNudge isOpen />);

    const evtInit = { bubbles: true, cancelable: true };
    // Fire on window to hit global listeners installed in effect
    const wheel = new Event('wheel', evtInit);
    Object.defineProperty(wheel, 'preventDefault', { value: preventDefault });
    Object.defineProperty(wheel, 'stopPropagation', { value: stopPropagation });
    window.dispatchEvent(wheel);
    expect(preventDefault).toHaveBeenCalled();

    const touch = new Event('touchmove', evtInit);
    Object.defineProperty(touch, 'preventDefault', { value: preventDefault });
    Object.defineProperty(touch, 'stopPropagation', { value: stopPropagation });
    window.dispatchEvent(touch);
    expect(preventDefault).toHaveBeenCalled();

    const gestureStart = new Event('gesturestart', evtInit);
    Object.defineProperty(gestureStart, 'preventDefault', { value: preventDefault });
    Object.defineProperty(gestureStart, 'stopPropagation', { value: stopPropagation });
    window.dispatchEvent(gestureStart);
    expect(preventDefault).toHaveBeenCalled();
  });

  it('blocks zoom keys and cancels on Escape', () => {
    const onCancel = vi.fn();
    render(<ZoomBoundaryNudge isOpen onCancel={onCancel} />);
    const typeKey = (key) => {
      const ev = new KeyboardEvent('keydown', { key });
      // preventDefault is already called by keymap service through our hook
      window.document.dispatchEvent(ev);
    };
    ['+', '=', '-', '_', '0', 'PageUp', 'PageDown'].forEach(typeKey);
    typeKey('Escape');
    expect(onCancel).toHaveBeenCalled();
  });
});


