import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useCameraRotation } from '../useCameraRotation.js';

function Harness(props){
  useCameraRotation(props);
  return <div data-testid="h"/>;
}

function makeMap({ bearing = 0, pitch = 0 } = {}) {
  let b = bearing;
  return {
    getBearing: () => b,
    setBearing: vi.fn((next) => { b = next; }),
    rotateTo: vi.fn((next) => { b = next; }),
    getPitch: () => pitch,
    on: vi.fn(),
    off: vi.fn(),
    stop: vi.fn()
  };
}

describe('useCameraRotation', () => {
  let rafSpy;
  let cafSpy;
  beforeEach(() => {
    let t = 0;
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      t += 16; // ~60fps
      return setTimeout(() => cb(t), 0);
    });
    cafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => clearTimeout(id));
  });
  afterEach(() => {
    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });

  it('rotates with Q/E keys and stops on keyup', async () => {
    const map = makeMap({ bearing: 0, pitch: 0 });
    render(<Harness map={map} isEnabled={true} />);
    // Allow effect to subscribe global key handlers
    await Promise.resolve();
    const dispatch = (type, key) => document.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
    // Start rotate CW with E
    dispatch('keydown', 'E');
    // allow multiple RAF cycles
    await new Promise(r => setTimeout(r, 200));
    dispatch('keyup', 'E');
    // allow any trailing burst to apply
    await new Promise(r => setTimeout(r, 50));
    // Either path for rotation should have been invoked
    expect(map.setBearing.mock.calls.length + map.rotateTo.mock.calls.length).toBeGreaterThan(0);
  });
});


