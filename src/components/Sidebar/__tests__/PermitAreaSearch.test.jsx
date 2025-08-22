import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PermitAreaSearch from '../PermitAreaSearch.jsx';

describe('PermitAreaSearch', () => {
  it('renders input and highlights search terms in results', () => {
    const onSearchChange = vi.fn();
    const onSelectArea = vi.fn();
    const results = [
      { properties: { name: 'Union Square', propertyname: 'Union', subpropertyname: 'North' } }
    ];
    render(
      <PermitAreaSearch
        searchQuery="union"
        onSearchChange={onSearchChange}
        searchResults={results}
        isSearching={false}
        onSelectArea={onSelectArea}
        focusedArea={null}
      />
    );
    expect(screen.getByPlaceholderText('Search zones...')).toBeInTheDocument();
    const matches = screen.getAllByText(/Union/i);
    const result = matches[0].closest('.search-result');
    expect(result).toBeInTheDocument();
    fireEvent.click(result);
    expect(onSelectArea).toHaveBeenCalled();
  });

  it('shows loading indicator when searching', () => {
    render(
      <PermitAreaSearch
        searchQuery="u"
        onSearchChange={() => {}}
        searchResults={[]}
        isSearching={true}
        onSelectArea={() => {}}
        focusedArea={null}
      />
    );
    expect(screen.getByText('Searching...')).toBeInTheDocument();
  });
});


