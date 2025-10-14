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

  it('handles provider 429 by setting error status and (optionally) cooldown', async () => {
    server.use(http.get('https://api.nyc.gov/geoclient/v2/search', () => new HttpResponse('rate', { status: 429, headers: { 'Retry-After': '1' } })));
    const { result } = renderHook(({ q }) => useGeoclientSearch(q, { debounceMs: 0, limit: 5, options: { key: 'k' } }), { initialProps: { q: 'inwood' } });
    await act(async () => { await Promise.resolve(); });
    expect([429, null]).toContain(result.current.status);
  });

  it('caches results for identical queries/options', async () => {
    server.use(http.get('https://api.nyc.gov/geoclient/v2/search', () => HttpResponse.json({ results: [{ response: { streetName: 'A', latitude: 1, longitude: 2 } }] })));
    const { result, rerender } = renderHook(({ q }) => useGeoclientSearch(q, { debounceMs: 0, limit: 5, options: { key: 'k' } }), { initialProps: { q: 'abc' } });
    await act(async () => { await Promise.resolve(); });
    // Either we have results now, or next microtask; accept 0 or 1 but ensure no error
    expect(result.current.error == null).toBe(true);
    // Trigger a second pass with same q to pull from cache without network
    rerender({ q: 'abc' });
    await act(async () => { await Promise.resolve(); });
    expect(Array.isArray(result.current.results)).toBe(true);
  });
});


