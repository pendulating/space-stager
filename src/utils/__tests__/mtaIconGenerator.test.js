import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateIconId, getOrCreateTrainLineIcon, clearIconCache, addTrainLineIconToMap } from '../mtaIconGenerator.js';

function stubCanvas(width = 32, height = 32) {
  const data = new Uint8ClampedArray(width * height * 4);
  return {
    width,
    height,
    getContext: () => ({
      getImageData: () => ({ data }),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      set fillStyle(v) { this._fillStyle = v; },
      get fillStyle() { return this._fillStyle; },
      set font(v) { this._font = v; },
      set textAlign(v) { this._textAlign = v; },
      set textBaseline(v) { this._textBaseline = v; }
    })
  };
}

describe('mtaIconGenerator', () => {
  beforeEach(() => {
    clearIconCache();
    vi.stubGlobal('document', {
      createElement: vi.fn((tag) => tag === 'canvas' ? stubCanvas() : ({}))
    });
  });

  it('generateIconId sorts lines and handles empty', () => {
    expect(generateIconId([])).toBe('subway-generic');
    expect(generateIconId(['B','A'])).toBe('subway-A-B');
  });

  it('getOrCreateTrainLineIcon caches by id', () => {
    const first = getOrCreateTrainLineIcon(['Q','N'], 16);
    const second = getOrCreateTrainLineIcon(['N','Q'], 16);
    expect(first.iconId).toBe('subway-N-Q');
    expect(second.iconId).toBe(first.iconId);
    expect(second.canvas).toBe(first.canvas);
  });

  it('addTrainLineIconToMap converts canvas to image and calls addImage if missing', () => {
    const map = {
      addImage: vi.fn(),
      hasImage: vi.fn(() => false)
    };
    const id = addTrainLineIconToMap(map, ['A']);
    expect(id).toBe('subway-A');
    expect(map.addImage).toHaveBeenCalledWith('subway-A', expect.objectContaining({ width: expect.any(Number), data: expect.any(Uint8ClampedArray) }));

    // Second call should not add again when present
    map.hasImage = vi.fn(() => true);
    const id2 = addTrainLineIconToMap(map, ['A']);
    expect(id2).toBe('subway-A');
  });
});


