import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { subscribeKey, clearAllKeySubscribers, makeKeyBinding } from '../keymap.js';

describe('keymap global service', () => {
  beforeEach(() => {
    clearAllKeySubscribers();
  });

  afterEach(() => {
    clearAllKeySubscribers();
  });

  it('honors priority and stop propagation', () => {
    const calls = [];
    // Low priority should not be called if high priority handles and stop=true
    subscribeKey(makeKeyBinding({ key: 'X', priority: 1, onEvent: () => calls.push('low') }));
    subscribeKey(makeKeyBinding({ key: 'X', priority: 100, stop: true, onEvent: () => calls.push('high') }));
    const ev = new KeyboardEvent('keydown', { key: 'X', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    expect(calls).toEqual(['high']);
  });

  it('applies preventDefault when configured', () => {
    subscribeKey(makeKeyBinding({ key: 'P', preventDefault: true, onEvent: () => {} }));
    const ev = new KeyboardEvent('keydown', { key: 'P', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('respects enabled predicate', () => {
    const fn = vi.fn();
    subscribeKey(makeKeyBinding({ key: 'E', enabled: () => false, onEvent: fn }));
    const ev = new KeyboardEvent('keydown', { key: 'E', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    expect(fn).not.toHaveBeenCalled();
  });

  it('unsubscribes handlers', () => {
    const fn = vi.fn();
    const unsub = subscribeKey(makeKeyBinding({ key: 'U', onEvent: fn }));
    unsub();
    const ev = new KeyboardEvent('keydown', { key: 'U', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    expect(fn).not.toHaveBeenCalled();
  });
});


