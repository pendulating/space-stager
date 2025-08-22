import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useNudges } from '../useNudges.js';

vi.mock('../../constants/nudgeRules', () => ({
  NUDGE_RULES: [
    { id: 'r1', type: 'object', subject: { where: { type: 'chair' } }, message: 'Place ${objectName}', severity: 'info' }
  ]
}));

function Harness({ map, droppedObjects }) {
  const { nudges, dismiss, zoomTo, highlight, highlightedIds } = useNudges({
    map,
    droppedObjects,
    customShapes: [],
    infrastructureData: {},
    layers: {},
    labelScan: false
  });
  return (
    <div>
      <div data-testid="count">{nudges.length}</div>
      <button onClick={() => nudges[0] && dismiss(nudges[0].id)}>dismiss</button>
      <button onClick={() => nudges[0] && zoomTo(nudges[0])}>zoom</button>
      <button onClick={() => nudges[0] && highlight(nudges[0])}>hl</button>
      <div data-testid="hl">{highlightedIds.size}</div>
    </div>
  );
}

describe('useNudges', () => {
  it('debounces, emits object nudges, supports dismiss/zoom/highlight', async () => {
    vi.useFakeTimers();
    const map = { easeTo: vi.fn() };
    const droppedObjects = [{ id: 'd1', type: 'chair', name: 'Chair', position: { lng: -74, lat: 40.7 } }];
    render(<Harness map={map} droppedObjects={droppedObjects} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(120); });
    expect(screen.getByTestId('count').textContent).toBe('1');
    // zoom
    await act(async () => { screen.getByText('zoom').click(); });
    expect(map.easeTo).toHaveBeenCalled();
    // highlight
    await act(async () => { screen.getByText('hl').click(); });
    expect(Number(screen.getByTestId('hl').textContent)).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(Number(screen.getByTestId('hl').textContent)).toBe(0);
    // dismiss
    await act(async () => { screen.getByText('dismiss').click(); });
    expect(screen.getByTestId('count').textContent).toBe('0');
    vi.useRealTimers();
  });
});


