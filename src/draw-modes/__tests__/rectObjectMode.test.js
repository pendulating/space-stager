import { describe, it, expect, vi } from 'vitest';
import RectObjectMode from '../rectObjectMode.js';

function makeCtx() {
  const features = new Map();
  let idCounter = 0;
  return {
    newFeature: (geo) => ({ id: `f${++idCounter}`, toGeoJSON: () => geo, setCoordinates: vi.fn(), changed: vi.fn() }),
    addFeature: vi.fn((f) => features.set(f.id, f)),
    deleteFeature: vi.fn((id) => features.delete(id)),
    setActionableState: vi.fn(),
    changeMode: vi.fn(),
    map: { fire: vi.fn() }
  };
}

describe('rectObjectMode', () => {
  it('two-click flow creates polygon with dimensions and rotation; escape cancels', () => {
    const ctx = makeCtx();
    const onSetup = RectObjectMode.onSetup.bind(ctx);
    const onClick = RectObjectMode.onClick.bind(ctx);
    const onKeyDown = RectObjectMode.onKeyDown.bind(ctx);
    const state = onSetup({ objectTypeId: 'stage' });
    // first click sets start
    onClick(state, { lngLat: { lng: -74.0, lat: 40.7 } });
    // rotate by +45
    onKeyDown(state, { key: ']' , preventDefault: () => {} });
    expect(state.rotationDeg).toBe(45);
    // second click finalizes
    onClick(state, { lngLat: { lng: -73.99, lat: 40.71 } });
    expect(ctx.map.fire).toHaveBeenCalledWith('draw.create', expect.any(Object));
    // pressing escape after finalize should switch mode
    onKeyDown(state, { key: 'Escape' });
    expect(ctx.changeMode).toHaveBeenCalledWith('simple_select');
  });
});


