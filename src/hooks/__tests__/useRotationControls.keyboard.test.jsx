import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useRotationControls } from '../useRotationControls.js';

function Harness(props){
  useRotationControls(props);
  return <div data-testid="h"/>;
}

describe('useRotationControls keyboard controls', () => {
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

  it('steps placement rotation by 45° with bracket/comma/period', async () => {
    const rotatePlacementStep = vi.fn();
    render(<Harness isPlacementActive={true} rotatePlacementStep={rotatePlacementStep} />);
    const dispatch = (key, code) => window.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true }));
    dispatch('[', 'BracketLeft');
    dispatch(']', 'BracketRight');
    dispatch(',', 'Comma');
    dispatch('.', 'Period');
    // Expect called with +/-45 four times
    expect(rotatePlacementStep).toHaveBeenCalledTimes(4);
    const args = rotatePlacementStep.mock.calls.map(c => c[0]).sort();
    expect(args).toContain(-45);
    expect(args).toContain(45);
  });

  it('nudges and continuously rotates selected rect while key held', async () => {
    const rotateSelectedRectBy = vi.fn();
    render(<Harness isPlacementActive={false} hasSelectedRect={true} rotateSelectedRectBy={rotateSelectedRectBy} />);
    // Press period to rotate CW
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '.', code: 'Period', bubbles: true, cancelable: true }));
    // Allow a couple RAF cycles
    await new Promise(r => setTimeout(r, 10));
    // Release key -> should stop
    window.dispatchEvent(new KeyboardEvent('keyup', { key: '.', code: 'Period', bubbles: true, cancelable: true }));
    expect(rotateSelectedRectBy).toHaveBeenCalled();
  });

  it('steps selected point rotation by 45°', () => {
    const rotateSelectedPointStep = vi.fn();
    render(<Harness hasSelectedRect={false} hasSelectedPoint={true} rotateSelectedPointStep={rotateSelectedPointStep} />);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ']', code: 'BracketRight', bubbles: true, cancelable: true }));
    expect(rotateSelectedPointStep).toHaveBeenCalledWith(45);
  });
});


