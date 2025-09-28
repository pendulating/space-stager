import { describe, it, expect, beforeEach } from 'vitest';
import { loadCSS, loadScript } from '../mapUtils.js';
import { MAP_LIBRARIES } from '../../constants/mapConfig.js';

describe('mapUtils DOM helpers', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('loadCSS appends required stylesheet links once', () => {
    loadCSS();
    // maplibre and draw are always required
    expect(document.head.querySelector(`link[href="${MAP_LIBRARIES.maplibre.css}"]`)).toBeTruthy();
    expect(document.head.querySelector(`link[href="${MAP_LIBRARIES.draw.css}"]`)).toBeTruthy();
    // optional search box should be skipped by default when flagged optional
    expect(document.head.querySelector(`link[href="${MAP_LIBRARIES.searchBox.css}"]`)).toBeNull();
    // Calling again should not duplicate
    loadCSS();
    const links = document.head.querySelectorAll('link');
    expect(links.length).toBe(2);
  });

  it('loadCSS includes search box stylesheet when explicitly required', () => {
    const originalOptional = MAP_LIBRARIES.searchBox.optional;
    MAP_LIBRARIES.searchBox.optional = false;

    loadCSS();

    expect(document.head.querySelector(`link[href="${MAP_LIBRARIES.maplibre.css}"]`)).toBeTruthy();
    expect(document.head.querySelector(`link[href="${MAP_LIBRARIES.draw.css}"]`)).toBeTruthy();
    expect(document.head.querySelector(`link[href="${MAP_LIBRARIES.searchBox.css}"]`)).toBeTruthy();

    // Ensure no duplicates on rerun
    loadCSS();
    const links = document.head.querySelectorAll('link');
    expect(links.length).toBe(3);

    MAP_LIBRARIES.searchBox.optional = originalOptional;
  });

  it('loadScript resolves immediately if checkFn true', async () => {
    await expect(loadScript('ignored.js', () => true)).resolves.toBeUndefined();
  });

  it('loadScript resolves when onload fires and rejects on error', async () => {
    const originalAppend = document.head.appendChild.bind(document.head);

    // Resolve path
    document.head.appendChild = (node) => {
      setTimeout(() => node.onload && node.onload());
      return originalAppend(node);
    };
    await expect(loadScript('ok.js')).resolves.toBeUndefined();

    // Reject path
    document.head.appendChild = (node) => {
      setTimeout(() => node.onerror && node.onerror(new Error('boom')));
      return originalAppend(node);
    };
    await expect(loadScript('bad.js')).rejects.toBeTruthy();

    // Restore
    document.head.appendChild = originalAppend;
  });
});


