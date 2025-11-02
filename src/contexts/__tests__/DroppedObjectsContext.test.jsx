import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DroppedObjectsProvider, useDroppedObjects } from '../DroppedObjectsContext.jsx';

function Harness() {
  const ctx = useDroppedObjects();
  return (
    <div>
      <button onClick={() => ctx.setAll([{ id: 'a', properties: {} }])}>setAll</button>
      <button onClick={() => ctx.hydrate([{ id: 'b', properties: {} }])}>hydrate</button>
      <button onClick={() => ctx.addObject({ id: 'c', properties: {} })}>add</button>
      <button onClick={() => ctx.addObjects([{ id: 'd' }, { id: 'e' }])}>addMany</button>
      <button onClick={() => ctx.setNote('a', 'hello')}>setNote</button>
      <button onClick={() => ctx.updateObject('a', (o) => ({ ...o, updated: true }))}>updateFn</button>
      <button onClick={() => ctx.updateObject('a', { foo: 'bar' })}>updateObj</button>
      <button onClick={() => ctx.removeObject('a')}>removeById</button>
      <button onClick={() => ctx.select('a', 'rect')}>select</button>
      <button onClick={() => ctx.clearSelection()}>clearSelection</button>
      <button onClick={() => ctx.hover('a', 'point')}>hover</button>
      <button onClick={() => ctx.clearHover()}>clearHover</button>
      <button onClick={() => ctx.clearAll()}>clearAll</button>
      <div data-testid="count">{String(ctx.droppedObjects.length)}</div>
      <div data-testid="selected">{String(ctx.selectedObjectId || '')}</div>
      <div data-testid="selectedKind">{String(ctx.selectedKind || '')}</div>
      <div data-testid="hovered">{String(ctx.hoveredObjectId || '')}</div>
      <div data-testid="hoveredKind">{String(ctx.hoveredKind || '')}</div>
    </div>
  );
}

describe('DroppedObjectsContext', () => {
  beforeEach(() => {
    // Ensure debug disabled by default
    delete window.__DEBUG_DROPPED_CTX__;
    delete window.__doctx;
  });

  afterEach(() => {
    delete window.__DEBUG_DROPPED_CTX__;
    delete window.__doctx;
  });

  it('exercises reducer actions and state transitions', () => {
    render(
      <DroppedObjectsProvider>
        <Harness />
      </DroppedObjectsProvider>
    );

    // setAll
    fireEvent.click(screen.getByText('setAll'));
    expect(screen.getByTestId('count').textContent).toBe('1');
    // setNote + update paths
    fireEvent.click(screen.getByText('setNote'));
    fireEvent.click(screen.getByText('updateFn'));
    fireEvent.click(screen.getByText('updateObj'));
    // add and addMany
    fireEvent.click(screen.getByText('add'));
    fireEvent.click(screen.getByText('addMany'));
    expect(screen.getByTestId('count').textContent).toBe('4');
    // selection
    fireEvent.click(screen.getByText('select'));
    expect(screen.getByTestId('selected').textContent).toBe('a');
    expect(screen.getByTestId('selectedKind').textContent).toBe('rect');
    // hover
    fireEvent.click(screen.getByText('hover'));
    expect(screen.getByTestId('hovered').textContent).toBe('a');
    expect(screen.getByTestId('hoveredKind').textContent).toBe('point');
    // clear hover
    fireEvent.click(screen.getByText('clearHover'));
    expect(screen.getByTestId('hovered').textContent).toBe('');
    // removing selected item clears selection
    fireEvent.click(screen.getByText('removeById'));
    expect(screen.getByTestId('selected').textContent).toBe('');
    // clear selection explicitly
    fireEvent.click(screen.getByText('clearSelection'));
    expect(screen.getByTestId('selectedKind').textContent).toBe('');
    // clear all resets everything
    fireEvent.click(screen.getByText('clearAll'));
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('throws when hook used outside provider', () => {
    function Broken() {
      useDroppedObjects();
      return null;
    }
    expect(() => render(<Broken />)).toThrow(/within DroppedObjectsProvider/);
  });
});


