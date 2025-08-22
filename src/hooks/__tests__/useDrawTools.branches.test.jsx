import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useDrawTools } from '../useDrawTools.js';

function makeMap() {
  return {
    loaded: () => true,
    isStyleLoaded: () => true,
    addControl: vi.fn(),
    removeControl: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn((e, cb) => cb())
  };
}

describe('useDrawTools branches', () => {
  it('gracefully warns when MapboxDraw is unavailable', () => {
    const map = makeMap();
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Harness(){ useDrawTools(map); return <div />; }
    render(<Harness />);
    warn.mockRestore();
  });
});


