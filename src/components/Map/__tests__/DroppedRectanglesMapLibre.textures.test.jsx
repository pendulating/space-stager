import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import DroppedRectanglesMapLibre from '../DroppedRectanglesMapLibre.jsx';

function makeMap() {
  const listeners = {};
  return {
    on: vi.fn((evt, cb) => { listeners[evt] = cb; }),
    off: vi.fn((evt) => { delete listeners[evt]; }),
    hasImage: vi.fn(() => false),
    addImage: vi.fn(),
    isStyleLoaded: () => true,
    getStyle: () => ({ layers: [] }),
    getSource: () => ({})
  };
}

describe('DroppedRectanglesMapLibre textures', () => {
  beforeEach(() => {
    // Stub Image to synchronously call onload
    class FakeImage {
      set src(_) { setTimeout(() => { this.onload && this.onload(); }, 0); }
      set crossOrigin(_) {}
    }
    vi.stubGlobal('Image', FakeImage);
  });

  it('handles styleimagemissing and calls addImage for non-SVG texture ids', async () => {
    const map = makeMap();
    const placeable = [
      { id: 'A', geometryType: 'rect', texture: { url: '/textures/a.png' } },
      { id: 'B', geometryType: 'rect', texture: { url: '/textures/b.svg' } }
    ];
    render(<DroppedRectanglesMapLibre map={map} objects={[]} placeableObjects={placeable} />);
    // simulate missing image for A (png) and B (svg). B should be skipped.
    const listener = map.on.mock.calls.find(c => c[0] === 'styleimagemissing')?.[1];
    expect(listener).toBeTruthy();
    listener && listener({ id: 'A' });
    // wait a tick for FakeImage onload to fire
    await new Promise(r => setTimeout(r, 5));
    expect(map.addImage).toHaveBeenCalledWith('A', expect.any(Image), expect.any(Object));
    listener && listener({ id: 'B' });
    // ensure addImage not called for svg id
    const calls = map.addImage.mock.calls.map(c => c[0]);
    expect(calls).not.toContain('B');
  });
});


