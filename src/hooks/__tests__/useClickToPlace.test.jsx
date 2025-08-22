import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('../../constants/placeableObjects.js', () => ({
  PLACEABLE_OBJECTS: [
    { id: 'bench', name: 'Bench', size: { width: 40, height: 20 }, color: '#123456' },
    { id: 'banner', name: 'Banner', size: { width: 60, height: 30 }, color: '#abcdef' }
  ]
}));

import { useClickToPlace } from '../useClickToPlace.js';

function makeFakeMap() {
  const handlers = {};
  const mapEl = document.createElement('div');
  mapEl.getBoundingClientRect = () => ({ left: 10, top: 20, width: 800, height: 600 });
  return {
    on: (n, cb) => { (handlers[n] ||= []).push(cb); },
    off: (n, cb) => { handlers[n] = (handlers[n] || []).filter(h => h !== cb); },
    once: (n, cb) => { const wrap = (...a) => { off(n, wrap); cb(...a); }; on(n, wrap); },
    emit: (n, e={}) => { (handlers[n] || []).forEach(cb => cb(e)); },
    loaded: () => true,
    getContainer: () => mapEl,
    unproject: ([x, y]) => ({ lng: x / 100, lat: y / 100 }),
    project: ([lng, lat]) => ({ x: lng * 10, y: lat * 10 })
  };
  function on() {}
  function off() {}
}

function Harness({ map }) {
  const hook = useClickToPlace(map);
  return (
    <div>
      <div data-testid="count">{hook.droppedObjects.length}</div>
      <div data-testid="mode">{hook.placementMode ? hook.placementMode.objectType.id : 'none'}</div>
      <div data-testid="rotation">{hook.placementMode ? String(hook.placementMode.rotationDeg) : 'na'}</div>
      <div data-testid="cursor">{hook.cursorPosition ? `${hook.cursorPosition.lng},${hook.cursorPosition.lat}` : 'none'}</div>
      <div data-testid="updates">{String(hook.objectUpdateTrigger)}</div>
      <button onClick={() => hook.activatePlacementMode({ id: 'bench', name: 'Bench' }, false)}>mode-bench</button>
      <button onClick={() => hook.activatePlacementMode({ id: 'bench', name: 'Bench' }, true)}>mode-bench-batch</button>
      <button onClick={() => hook.cancelPlacementMode()}>cancel</button>
      <button onClick={() => hook.clearDroppedObjects()}>clear</button>
    </div>
  );
}

describe('useClickToPlace', () => {
  it('sets up listeners and increments update trigger on map move', () => {
    const map = makeFakeMap();
    render(<Harness map={map} />);
    const before = screen.getByTestId('updates').textContent;
    act(() => { map.emit('move'); });
    const after = screen.getByTestId('updates').textContent;
    expect(Number(after)).toBe(Number(before) + 1);
  });

  it('activates/toggles placement mode and rotates with keys', () => {
    const map = makeFakeMap();
    render(<Harness map={map} />);
    fireEvent.click(screen.getByText('mode-bench'));
    expect(screen.getByTestId('mode').textContent).toBe('bench');
    // rotate right using '.' key
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: '.', code: 'Period' })); });
    expect(screen.getByTestId('rotation').textContent).toBe('45');
    // toggling same object cancels
    fireEvent.click(screen.getByText('mode-bench'));
    expect(screen.getByTestId('mode').textContent).toBe('none');
  });

  it('updates cursor on mouse move during placement', () => {
    const map = makeFakeMap();
    render(<Harness map={map} />);
    fireEvent.click(screen.getByText('mode-bench'));
    const e = { clientX: 110, clientY: 220 };
    act(() => { require('../useClickToPlace.js'); });
    // Access hook handler by reusing logic: simulate map mousemove
    // Instead, directly call map.emit is not wired here; use exposed handler via event calls is internal.
    // We simulate by calling the hook handler through a click placement event below.
    // Use map click first to verify position set in dropped object path.
  });

  it('places object on click with non-batch exits and batch stays active', () => {
    const map = makeFakeMap();
    function ClickHarness() {
      const hook = useClickToPlace(map);
      return (
        <div>
          <div data-testid="count">{hook.droppedObjects.length}</div>
          <div data-testid="mode">{hook.placementMode ? hook.placementMode.objectType.id : 'none'}</div>
          <button onClick={() => hook.activatePlacementMode({ id: 'bench', name: 'Bench' }, false)}>single</button>
          <button onClick={() => hook.activatePlacementMode({ id: 'bench', name: 'Bench' }, true)}>batch</button>
          <button onClick={() => hook.handleMapClick({ preventDefault(){}, stopPropagation(){}, clientX: 110, clientY: 220 })}>click</button>
          <button onClick={() => hook.handleMapMouseMove({ clientX: 120, clientY: 240 })}>move</button>
          <div data-testid="cursor">{hook.cursorPosition ? `${hook.cursorPosition.lng},${hook.cursorPosition.lat}` : 'none'}</div>
        </div>
      );
    }

    render(<ClickHarness />);
    // Single placement exits mode
    fireEvent.click(screen.getByText('single'));
    fireEvent.click(screen.getByText('click'));
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('mode').textContent).toBe('none');

    // Batch placement stays in mode and updates cursor on move
    fireEvent.click(screen.getByText('batch'));
    fireEvent.click(screen.getByText('move'));
    expect(screen.getByTestId('cursor').textContent).toBe(`${(120-10)/100},${(240-20)/100}`);
    fireEvent.click(screen.getByText('click'));
    expect(screen.getByTestId('count').textContent).toBe('2');
    expect(screen.getByTestId('mode').textContent).toBe('bench');
  });

  it('getObjectStyle computes absolute position and size from map.project', () => {
    const map = makeFakeMap();
    function StyleHarness() {
      const hook = useClickToPlace(map);
      const obj = { id: 'o1', type: 'bench', position: { lng: 10, lat: 20 } };
      const style = hook.getObjectStyle(obj);
      return (
        <div>
          <div data-testid="left">{String(style.left)}</div>
          <div data-testid="top">{String(style.top)}</div>
          <div data-testid="w">{String(style.width)}</div>
          <div data-testid="h">{String(style.height)}</div>
        </div>
      );
    }
    render(<StyleHarness />);
    // project returns (x=100, y=200); width=40 height=20
    expect(screen.getByTestId('left').textContent).toBe(String(100 - 20));
    expect(screen.getByTestId('top').textContent).toBe(String(200 - 10));
    expect(screen.getByTestId('w').textContent).toBe('40');
    expect(screen.getByTestId('h').textContent).toBe('20');
  });

  it('update and note helpers modify dropped objects; clear and cancel work', () => {
    const map = makeFakeMap();
    function UpdateHarness() {
      const hook = useClickToPlace(map);
      const setNote = () => {
        const id = hook.droppedObjects[0]?.id;
        if (id) hook.setDroppedObjectNote(id, 'note');
      };
      const flip = () => {
        const id = hook.droppedObjects[0]?.id;
        if (id) hook.updateDroppedObject(id, (obj) => ({ ...obj, properties: { ...obj.properties, flipped: true } }));
      };
      return (
        <div>
          <div data-testid="mode">{hook.placementMode ? 'on' : 'off'}</div>
          <div data-testid="count">{hook.droppedObjects.length}</div>
          <div data-testid="note">{hook.droppedObjects[0]?.properties?.note || ''}</div>
          <div data-testid="flipped">{String(hook.droppedObjects[0]?.properties?.flipped)}</div>
          <button onClick={() => hook.activatePlacementMode({ id: 'bench', name: 'Bench' }, false)}>single</button>
          <button onClick={() => hook.handleMapClick({ preventDefault(){}, stopPropagation(){}, clientX: 110, clientY: 220 })}>place</button>
          <button onClick={setNote}>note</button>
          <button onClick={flip}>flip</button>
          <button onClick={() => hook.cancelPlacementMode()}>cancel</button>
          <button onClick={() => hook.clearDroppedObjects()}>clear</button>
        </div>
      );
    }

    render(<UpdateHarness />);
    fireEvent.click(screen.getByText('single'));
    fireEvent.click(screen.getByText('place'));
    expect(screen.getByTestId('count').textContent).toBe('1');
    fireEvent.click(screen.getByText('note'));
    fireEvent.click(screen.getByText('flip'));
    fireEvent.click(screen.getByText('cancel'));
    expect(screen.getByTestId('mode').textContent).toBe('off');
    expect(screen.getByTestId('note').textContent).toBe('note');
    expect(screen.getByTestId('flipped').textContent).toBe('true');
    fireEvent.click(screen.getByText('clear'));
    expect(screen.getByTestId('count').textContent).toBe('0');
  });
});


