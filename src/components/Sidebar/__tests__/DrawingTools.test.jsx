import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DrawingTools from '../DrawingTools.jsx';

describe('DrawingTools', () => {
  it('activates tools and delete respects disabled state', () => {
    const onToolSelect = vi.fn();
    const onDelete = vi.fn();
    render(
      <DrawingTools
        activeTool={null}
        onToolSelect={onToolSelect}
        selectedShape={null}
        onDelete={onDelete}
        drawAvailable={true}
      />
    );
    // Click a tool button (title used on button)
    const pointBtn = screen.getByTitle('Add Point');
    fireEvent.click(pointBtn);
    expect(onToolSelect).toHaveBeenCalled();

    const delBtn = screen.getByTitle('Delete Selected');
    expect(delBtn).toBeDisabled();
  });

  it('shows retry when draw unavailable', () => {
    const onRetry = vi.fn();
    render(<DrawingTools activeTool={null} onToolSelect={() => {}} selectedShape={null} onDelete={() => {}} drawAvailable={false} onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalled();
  });
});


