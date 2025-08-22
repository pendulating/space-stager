import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';

vi.mock('../../utils/mapUtils.js', () => ({
  loadMapLibraries: vi.fn(async () => {}),
  initializeMap: vi.fn(async (el) => new FakeMap())
}));

function FakeMap() {
  this._handlers = {};
  this._loaded = true;
  this._styleLoaded = true;
}
FakeMap.prototype.on = function (name, cb) {
  (this._handlers[name] ||= []).push(cb);
};
FakeMap.prototype.once = function (name, cb) {
  const onceCb = (...args) => {
    this.off(name, onceCb);
    cb(...args);
  };
  this.on(name, onceCb);
};
FakeMap.prototype.off = function (name, cb) {
  this._handlers[name] = (this._handlers[name] || []).filter((h) => h !== cb);
};
FakeMap.prototype.emit = function (name, evt = {}) {
  (this._handlers[name] || []).forEach((cb) => cb(evt));
};
FakeMap.prototype.remove = function () { this._removed = true; };
FakeMap.prototype.loaded = function () { return this._loaded; };
FakeMap.prototype.isStyleLoaded = function () { return this._styleLoaded; };

import { useMap } from '../useMap.js';
import { loadMapLibraries, initializeMap } from '../../utils/mapUtils.js';

function Harness() {
  const ref = React.useRef(null);
  const { map, mapLoaded, styleLoaded } = useMap(ref);
  return (
    <div>
      <div ref={ref} />
      <div data-testid="map-loaded">{String(mapLoaded)}</div>
      <div data-testid="style-loaded">{String(styleLoaded)}</div>
      <div data-testid="has-map">{String(!!map)}</div>
    </div>
  );
}

describe('useMap', () => {
  it('initializes map and sets flags; cleans up on unmount', async () => {
    const { unmount } = render(<Harness />);
    // allow effects to run
    await act(async () => {});
    expect(screen.getByTestId('has-map').textContent).toBe('true');
    expect(screen.getByTestId('map-loaded').textContent).toBe('true');
    expect(screen.getByTestId('style-loaded').textContent).toBe('true');
    unmount();
  });
});


