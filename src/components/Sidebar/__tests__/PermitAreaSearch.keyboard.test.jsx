import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PermitAreaSearch from '../../Sidebar/PermitAreaSearch.jsx';

describe('PermitAreaSearch keyboard navigation for addresses', () => {
  function renderWithProps(extra = {}) {
    const base = {
      searchQuery: 'inwood',
      onSearchChange: () => {},
      searchResults: [],
      isSearching: false,
      onSelectArea: () => {},
      focusedArea: null,
      permitAreasLayer: { requested: true, loaded: true, empty: false, loading: false, error: false, color: '#f97316' },
      geographyType: 'parks',
      geoclientResults: [
        { id: 'a', label: 'Inwood Hill Park A', coords: [-74, 40.87] },
        { id: 'b', label: 'Inwood Hill Park B', coords: [-74.1, 40.88] }
      ],
      geoclientLoading: false,
      geoclientStatus: null,
      geoclientError: null,
      geoclientCooldownMs: 0,
      onSelectGeoclientResult: () => {}
    };
    return render(<PermitAreaSearch {...base} {...extra} />);
  }

  it('ArrowDown/Up moves active selection; Enter triggers selection', () => {
    const onSelect = vi.fn();
    renderWithProps({ onSelectGeoclientResult: onSelect });
    const input = screen.getByPlaceholderText('Search zones...');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].label).toContain('Inwood Hill Park A');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect.mock.calls[1][0].label).toContain('Inwood Hill Park B');
  });
});


