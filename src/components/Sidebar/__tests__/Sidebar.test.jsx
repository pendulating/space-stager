import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../Sidebar.jsx';
import { ZoneCreatorProvider } from '../../../contexts/ZoneCreatorContext.jsx';

describe('Sidebar (left)', () => {
  function makeProps(overrides = {}) {
    return {
      layers: {},
      focusedArea: null,
      onClearFocus: vi.fn(),
      onToggleLayer: vi.fn(),
      permitAreas: {
        searchQuery: '',
        setSearchQuery: vi.fn(),
        searchResults: [],
        isSearching: false,
        focusOnPermitArea: vi.fn(),
        clearFocus: vi.fn(),
      },
      infrastructure: {},
      map: { easeTo: vi.fn(), isStyleLoaded: () => true, on: vi.fn(), off: vi.fn() },
      onStyleChange: vi.fn(),
      isSitePlanMode: false,
      geographyType: 'parks',
      onCollapse: vi.fn(),
      ...overrides,
    };
  }

  it('renders and collapses via button', () => {
    const props = makeProps();
    render(<ZoneCreatorProvider><Sidebar {...props} /></ZoneCreatorProvider>);
    const collapse = screen.getByTitle('Hide sidebar');
    fireEvent.click(collapse);
    expect(props.onCollapse).toHaveBeenCalled();
  });

  it('hides search panel in site plan mode (collapsed container present)', () => {
    const props = makeProps({ isSitePlanMode: true });
    render(<ZoneCreatorProvider><Sidebar {...props} /></ZoneCreatorProvider>);
    // Container should have collapse classes (max-h-0, opacity-0)
    const collapsed = document.querySelector('.max-h-0.opacity-0');
    expect(collapsed).toBeTruthy();
  });

  it('shows ZoneCreatorPanel in intersections mode and customizes search', () => {
    const props = makeProps({ geographyType: 'intersections' });
    render(<ZoneCreatorProvider><Sidebar {...props} /></ZoneCreatorProvider>);
    // Search title customized
    expect(screen.getByText('Search Intersections')).toBeInTheDocument();
    // Zone Creator header present
    expect(screen.getByText('Zone Creator')).toBeInTheDocument();
  });
});


