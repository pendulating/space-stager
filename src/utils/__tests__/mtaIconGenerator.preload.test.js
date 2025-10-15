import { describe, it, expect, vi, beforeEach } from 'vitest';
import { preloadCommonTrainLineIcons } from '../mtaIconGenerator.js';

function stubCanvas(width = 16, height = 16) {
  const data = new Uint8ClampedArray(width * height * 4);
  const ctx2d = {
    fillStyle: '#000000',
    font: 'bold 12px Arial',
    textAlign: 'center',
    textBaseline: 'middle',
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    getImageData: vi.fn(() => ({ data }))
  };
  return {
    width,
    height,
    getContext: (type) => (type === '2d' ? ctx2d : null)
  };
}

describe('mtaIconGenerator preloadCommonTrainLineIcons', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: vi.fn((tag) => (tag === 'canvas' ? stubCanvas() : {}))
    });
  });

  it('adds images when missing and skips when present', () => {
    const added = [];
    const map = {
      hasImage: vi.fn((id) => id === 'subway-generic'),
      addImage: vi.fn((id, img) => { added.push(id); })
    };
    preloadCommonTrainLineIcons(map, 16);
    // At least one addition should occur (e.g., 'subway-A') but 'subway-generic' was pre-present
    expect(added.length).toBeGreaterThan(0);
    expect(added).not.toContain('subway-generic');
  });
});


