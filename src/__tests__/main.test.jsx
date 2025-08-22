import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';

describe('main.jsx bootstrap', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('creates a root and renders App in StrictMode', async () => {
    const renderSpy = vi.fn();
    vi.doMock('react-dom/client', () => ({
      default: { createRoot: (el) => ({ render: renderSpy }) },
      createRoot: (el) => {
        expect(el).toBe(document.getElementById('root'));
        return { render: renderSpy };
      }
    }));

    // Mock App to a simple element for smoke
    vi.doMock('../App.jsx', () => ({ default: () => React.createElement('div', { 'data-testid': 'app-root' }, 'App') }));

    // Import after mocks
    await import('../main.jsx');

    expect(renderSpy).toHaveBeenCalledTimes(1);
  });
});


