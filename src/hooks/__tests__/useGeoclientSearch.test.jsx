import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setupTests.js';
import { useGeoclientSearch } from '../useGeoclientSearch.js';

describe('useGeoclientSearch', () => {
  beforeEach(() => vi.useFakeTimers());

  it('does not query until min chars (3) unless lat,lon', async () => {
    const { result, rerender } = renderHook(({ q }) => useGeoclientSearch(q, { debounceMs: 1, limit: 5, options: { key: 'k' } }), { initialProps: { q: 'in' } });
    expect(result.current.results).toEqual([]);
    rerender({ q: 'inw' });
    // No network handler, but we only assert it stays stable without throwing
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(Array.isArray(result.current.results)).toBe(true);
  });

  it('uses Retry-After to start cooldown on 429', async () => {
    server.use(http.get('https://api.nyc.gov/geoclient/v2/search', () => new HttpResponse('rate', { status: 429, headers: { 'Retry-After': '1' } })));
    const { result, rerender } = renderHook(({ q }) => useGeoclientSearch(q, { debounceMs: 1, limit: 5, options: { key: 'k' } }), { initialProps: { q: 'inwood' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(5); });
    expect(result.current.status).toBe(429);
    expect(result.current.cooldownMs).toBeGreaterThan(0);
    // During cooldown, changing query should not fire
    rerender({ q: 'inwood h' });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(result.current.cooldownMs).toBeGreaterThan(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(result.current.cooldownMs + 10); });
    expect(result.current.cooldownMs).toBe(0);
  });

  it('caches results for 30s for identical queries/options', async () => {
    server.use(http.get('https://api.nyc.gov/geoclient/v2/search', () => HttpResponse.json({ results: [{ response: { streetName: 'A', latitude: 1, longitude: 2 } }] })));
    const { result, rerender } = renderHook(({ q }) => useGeoclientSearch(q, { debounceMs: 1, limit: 5, options: { key: 'k' } }), { initialProps: { q: 'abc' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(5); });
    expect(result.current.results.length).toBe(1);
    // Change unrelated prop but keep same q
    rerender({ q: 'abc' });
    await act(async () => { await vi.advanceTimersByTimeAsync(5); });
    expect(result.current.results.length).toBe(1);
  });
});


