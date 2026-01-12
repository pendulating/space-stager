import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ZoneCreatorProvider, useZoneCreatorContext } from '../ZoneCreatorContext.jsx';

function Harness() {
  const ctx = useZoneCreatorContext();
  const { isActive, setIsActive, selectedNodeIds, selectedNodes, addNodeId, addNode, undoLastNode, clearNodes } = ctx;
  return (
    <div>
      <div data-testid="active">{String(isActive)}</div>
      <div data-testid="ids">{selectedNodeIds.join(',')}</div>
      <div data-testid="nodes">{selectedNodes.map(n => n.id).join(',')}</div>
      <button onClick={() => setIsActive(true)}>on</button>
      <button onClick={() => addNodeId('n1')}>id1</button>
      <button onClick={() => addNode('n2', [-74,40.7])}>node2</button>
      <button onClick={() => undoLastNode()}>undo</button>
      <button onClick={() => clearNodes()}>clear</button>
    </div>
  );
}

describe('ZoneCreatorContext', () => {
  it('tracks activation and node stacks with undo/clear', () => {
    render(
      <ZoneCreatorProvider>
        <Harness />
      </ZoneCreatorProvider>
    );
    expect(screen.getByTestId('active').textContent).toBe('false');
    fireEvent.click(screen.getByText('on'));
    expect(screen.getByTestId('active').textContent).toBe('true');
    fireEvent.click(screen.getByText('id1'));
    fireEvent.click(screen.getByText('node2'));
    expect(screen.getByTestId('ids').textContent).toBe('n1,n2');
    expect(screen.getByTestId('nodes').textContent).toBe('n2');
    fireEvent.click(screen.getByText('undo'));
    expect(screen.getByTestId('ids').textContent).toBe('n1');
    fireEvent.click(screen.getByText('clear'));
    expect(screen.getByTestId('ids').textContent).toBe('');
  });
});


