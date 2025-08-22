import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useMap } from '../useMap.js';

vi.mock('../../utils/mapUtils.js', () => ({
  loadMapLibraries: vi.fn(async () => {}),
  initializeMap: vi.fn(async () => ({
    loaded: () => true,
    isStyleLoaded: () => true,
    on: vi.fn(),
    remove: vi.fn()
  }))
}));

function Harness() {
  const ref = React.useRef({});
  const { mapLoaded, styleLoaded } = useMap(ref);
  return <div data-testid="flags">{String(mapLoaded)}|{String(styleLoaded)}</div>;
}

describe('useMap branches', () => {
  it('short-circuits when map is already loaded', async () => {
    const { findByTestId } = render(<Harness />);
    const flags = await findByTestId('flags');
    expect(flags.textContent).toBe('true|true');
  });
});


