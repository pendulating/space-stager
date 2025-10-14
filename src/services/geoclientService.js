// src/services/geoclientService.js
// Lightweight client for NYC Geoclient v2 `/search` endpoint

const DEFAULT_BASE_URL = (typeof __GEOCLIENT_BASE_URL__ !== 'undefined' && __GEOCLIENT_BASE_URL__) || 'https://api.nyc.gov/geoclient/v2';

function buildHeaders(key) {
  const headers = new Headers();
  if (key) headers.set('Ocp-Apim-Subscription-Key', key);
  headers.set('Accept', 'application/json');
  return headers;
}

function toQuery(params = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    usp.set(k, String(v));
  });
  return usp.toString();
}

async function fetchWithKey(url, { key, signal }) {
  const resp = await fetch(url, { headers: buildHeaders(key), signal, cache: 'no-store' });
  return resp;
}

async function fetchWithRetry(url, { signal, key }) {
  // Use only the caller-provided key; do not fallback automatically
  const BACKOFFS = [400, 900];
  for (let attempt = 0; attempt < 1; attempt++) {
    try {
      const resp = await fetchWithKey(url, { key, signal });
      return resp;
    } catch (e) {
      const delay = BACKOFFS[Math.min(attempt, BACKOFFS.length - 1)];
      await wait(delay);
    }
  }
  // Final attempt after small backoff for transient network errors
  const resp = await fetchWithKey(url, { key, signal });
  return resp;
}

export async function searchGeoclient({
  input,
  key,
  exactMatchForSingleSuccess,
  exactMatchMaxLevel,
  returnPolicy,
  returnPossiblesWithExact,
  returnRejections,
  returnTokens,
  similarNamesDistance,
  limit,
  signal,
  baseUrl = DEFAULT_BASE_URL
} = {}) {
  if (!input || typeof input !== 'string' || !input.trim()) {
    return { ok: true, results: [] };
  }
  // If no key provided, do not call the API (BYOK). Surface 401-like status to UI.
  if (!key || typeof key !== 'string' || !key.trim()) {
    return { ok: true, results: [], status: 401 };
  }

  const qp = toQuery({
    input: input.trim(),
    exactMatchForSingleSuccess,
    exactMatchMaxLevel,
    returnPolicy,
    returnPossiblesWithExact,
    returnRejections,
    returnTokens,
    similarNamesDistance,
    limit
  });
  const url = `${baseUrl.replace(/\/$/, '')}/search?${qp}`;

  const resp = await fetchWithRetry(url, { signal, key });

  // Graceful statuses
  if (resp.status === 404) {
    return { ok: true, results: [], status: 404 };
  }
  if (resp.status === 429) {
    const text = await resp.text().catch(() => '');
    const err = new Error('Rate limited by Geoclient (429). Please try again shortly.');
    err.status = 429;
    err.body = text;
    const ra = parseRetryAfter(resp.headers && resp.headers.get ? resp.headers.get('Retry-After') : null);
    if (typeof ra === 'number' && Number.isFinite(ra) && ra > 0) err.retryAfterMs = ra;
    throw err;
  }
  if (resp.status >= 500) {
    const text = await resp.text().catch(() => '');
    const err = new Error(`Geoclient service unavailable (HTTP ${resp.status}).`);
    err.status = resp.status;
    err.body = text;
    const ra = parseRetryAfter(resp.headers && resp.headers.get ? resp.headers.get('Retry-After') : null);
    if (typeof ra === 'number' && Number.isFinite(ra) && ra > 0) err.retryAfterMs = ra;
    throw err;
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    const err = new Error(`Geoclient search failed: HTTP ${resp.status}`);
    err.status = resp.status;
    err.body = text;
    throw err;
  }

  const json = await resp.json();
  return { ok: true, raw: json, results: normalizeSearchResults(json) };
}

function normalizeSearchResults(json) {
  // Normalize diverse response shapes into { id, label, coords: [lon,lat], raw }
  if (!json) return [];

  const candidates = Array.isArray(json?.results)
    ? json.results
    : Array.isArray(json?.candidates)
      ? json.candidates
      : Array.isArray(json?.response?.candidates)
        ? json.response.candidates
        : [];

  const out = [];
  for (const c of candidates) {
    const r = c?.response || c; // some shapes wrap in { response }
    const { coords, id } = extractCoordsAndId(r);
    const label = buildLabel(r) || c?.label || r?.label || 'Unknown location';
    out.push({ id: id || label, label, coords: coords || null, raw: c });
  }
  return out;
}

function extractCoordsAndId(obj) {
  if (!obj || typeof obj !== 'object') return { coords: null, id: null };
  // Common Geoclient fields
  const lon = firstNumber(obj.longitude, obj.lon, obj.x, obj.xCoordinate, obj.internalLabelX);
  const lat = firstNumber(obj.latitude, obj.lat, obj.y, obj.yCoordinate, obj.internalLabelY);
  if (isFiniteNum(lon) && isFiniteNum(lat)) return { coords: [Number(lon), Number(lat)], id: obj.id || obj.bin || obj.bbl || null };
  // Nested geometry-like
  const geom = obj.geometry || obj.point || null;
  if (geom && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
    const [x, y] = geom.coordinates;
    if (isFiniteNum(x) && isFiniteNum(y)) return { coords: [Number(x), Number(y)], id: obj.id || obj.bin || obj.bbl || null };
  }
  // Fallback: search shallow props for plausible numbers
  const keys = Object.keys(obj);
  let bestLon = null; let bestLat = null;
  for (const k of keys) {
    if (/lon(gitude)?$/i.test(k) || /x(Coordinate)?$/i.test(k)) bestLon = bestLon ?? numOrNull(obj[k]);
    if (/lat(itude)?$/i.test(k) || /y(Coordinate)?$/i.test(k)) bestLat = bestLat ?? numOrNull(obj[k]);
  }
  if (isFiniteNum(bestLon) && isFiniteNum(bestLat)) return { coords: [bestLon, bestLat], id: obj.id || obj.bin || obj.bbl || null };
  return { coords: null, id: obj.id || obj.bin || obj.bbl || null };
}

function buildLabel(r) {
  const parts = [];
  const hn = r.houseNumber || r.housenumber;
  const sn = r.streetName || r.street || r.firstStreetNameNormalized || r.mainStreetName || r.roadwayName;
  if (hn && sn) parts.push(`${hn} ${sn}`);
  else if (sn) parts.push(sn);
  const place = r.placeName || r.name;
  if (!parts.length && place) parts.push(place);
  const boro = r.firstBoroughName || r.boroughName || r.borough || r.city;
  if (boro) parts.push(boro);
  return parts.length ? parts.join(', ') : null;
}

function firstNumber(...vals) {
  for (const v of vals) {
    const n = numOrNull(v);
    if (isFiniteNum(n)) return n;
  }
  return null;
}

function numOrNull(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isFiniteNum(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function parseRetryAfter(value) {
  if (!value) return null;
  const v = String(value).trim();
  // If it's a number, it's seconds
  if (/^\d+$/.test(v)) {
    const sec = Number(v);
    if (Number.isFinite(sec) && sec >= 0) return sec * 1000;
  }
  // Otherwise try HTTP-date
  const d = Date.parse(v);
  if (!Number.isNaN(d)) {
    const ms = d - Date.now();
    if (ms > 0) return ms;
  }
  return null;
}

export const __geoclientInternals = { normalizeSearchResults, extractCoordsAndId, buildLabel };


