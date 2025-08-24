import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadCSS, loadScript } from '../mapUtils.js';

describe('mapUtils DOM helpers', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('loadCSS appends missing stylesheet links once', () => {
    loadCSS();
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    expect(links.length).toBeGreaterThanOrEqual(2);
    // Calling again should not duplicate for same ids
    loadCSS();
    const links2 = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    expect(links2.length).toBe(links.length);
  });

  it('loadScript resolves immediately if checkFn passes', async () => {
    const spy = vi.fn();
    await loadScript('about:blank', () => true).then(spy);
    expect(spy).toHaveBeenCalled();
  });

  it('loadScript injects script and resolves on onload', async () => {
    const p = loadScript('about:blank');
    // Simulate load for the last script
    const s = document.querySelector('script[src="about:blank"]');
    expect(s).toBeTruthy();
    // Trigger onload
    s.onload?.();
    await expect(p).resolves.toBeUndefined();
  });

  it('loadScript rejects on script error', async () => {
    const p = loadScript('about:error');
    const s = document.querySelector('script[src="about:error"]');
    expect(s).toBeTruthy();
    s.onerror?.(new Event('error'));
    await expect(p).rejects.toBeTruthy();
  });
});


