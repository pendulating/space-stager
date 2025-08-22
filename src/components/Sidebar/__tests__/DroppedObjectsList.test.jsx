import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DroppedObjectsList from '../DroppedObjectsList.jsx';

describe('DroppedObjectsList', () => {
  it('renders items and removes on click', () => {
    const onRemove = vi.fn();
    const objects = [{ id: 'o1', type: 'bench', name: 'Bench 1' }];
    const placeable = [{ id: 'bench', name: 'Bench', color: '#333', icon: 'B' }];
    render(<DroppedObjectsList objects={objects} placeableObjects={placeable} onRemove={onRemove} />);
    expect(screen.getByText('Placed Objects (1)')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Remove object'));
    expect(onRemove).toHaveBeenCalledWith('o1');
  });
});


