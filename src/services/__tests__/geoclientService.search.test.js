import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setupTests.js';
import { searchGeoclient } from '../geoclientService.js';

const BASE = 'https://example.test/geoclient/v2';

describe('geoclientService.searchGeoclient', () => {
  it('returns 401-like status without network when key is missing', async () => {
    // No handler; verify returning status:401 without throwing
    const out = await searchGeoclient({ input: 'Inwood Hill Park', baseUrl: BASE });
    expect(out.status).toBe(401);
    expect(out.results).toEqual([]);
  });

  it('sends header and normalizes results on 200', async () => {
    server.use(http.get(`${BASE}/search`, ({ request }) => {
      const hdr = request.headers.get('Ocp-Apim-Subscription-Key');
      expect(hdr).toBe('test-key');
      return HttpResponse.json({
        results: [
          { response: {
            houseNumber: '1',
            streetName: 'Main St',
            boroughName: 'Manhattan',
            latitude: 40.7128,
            longitude: -74.0060
          }}
        ]
      });
    }));
    const out = await searchGeoclient({ input: '1 Main St', key: 'test-key', baseUrl: BASE });
    expect(out.ok).toBe(true);
    expect(out.results.length).toBe(1);
    expect(out.results[0].label).toContain('1 Main St');
    expect(out.results[0].label).toContain('Manhattan');
    expect(out.results[0].coords).toEqual([-74.006, 40.7128]);
  });

  it('throws on 429 and includes retryAfterMs from Retry-After header (seconds)', async () => {
    server.use(http.get(`${BASE}/search`, () => new HttpResponse('rate', { status: 429, headers: { 'Retry-After': '2' } })));
    await expect(searchGeoclient({ input: 'x', key: 'k', baseUrl: BASE })).rejects.toMatchObject({ status: 429, retryAfterMs: 2000 });
  });

  it('returns empty results with status 404', async () => {
    server.use(http.get(`${BASE}/search`, () => new HttpResponse('not found', { status: 404 })));
    const out = await searchGeoclient({ input: 'y', key: 'k', baseUrl: BASE });
    expect(out.status).toBe(404);
    expect(out.results).toEqual([]);
  });

  it('throws on 503 and may include retryAfterMs from HTTP-date', async () => {
    const future = new Date(Date.now() + 1500).toUTCString();
    server.use(http.get(`${BASE}/search`, () => new HttpResponse('busy', { status: 503, headers: { 'Retry-After': future } })));
    try {
      await searchGeoclient({ input: 'z', key: 'k', baseUrl: BASE });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e.status).toBe(503);
      expect(typeof e.retryAfterMs === 'number' || e.retryAfterMs == null).toBe(true);
    }
  });
});


