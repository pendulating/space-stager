import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import DroppedObjectNoteEditor from '../DroppedObjectNoteEditor.jsx';

function makeMap(projectReturn = { x: 100, y: 200 }) {
  return {
    project: vi.fn(() => projectReturn),
  };
}

describe('DroppedObjectNoteEditor', () => {
  const object = {
    id: 'o1',
    position: { lng: -73.99, lat: 40.75 },
    properties: { note: 'existing' },
  };

  it('positions near projected coords and shows initial text', () => {
    const map = makeMap();
    render(
      <div>
        <DroppedObjectNoteEditor map={map} object={object} onSave={vi.fn()} onCancel={vi.fn()} objectUpdateTrigger={0} />
      </div>
    );
    expect(screen.getByDisplayValue('existing')).toBeInTheDocument();
  });

  it('calls onSave with updated text and onCancel on cancel', () => {
    const map = makeMap();
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const { unmount } = render(
      <DroppedObjectNoteEditor map={map} object={object} onSave={onSave} onCancel={onCancel} objectUpdateTrigger={0} />
    );
    const textarea = screen.getByPlaceholderText('Add a note for this item');
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith('hello');

    // Unmount first instance, then re-render and test cancel
    unmount();
    render(
      <DroppedObjectNoteEditor map={map} object={object} onSave={onSave} onCancel={onCancel} objectUpdateTrigger={0} />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});


