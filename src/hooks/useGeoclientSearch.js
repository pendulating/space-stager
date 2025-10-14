// src/hooks/useGeoclientSearch.js
import { useEffect, useMemo, useRef, useState } from 'react';
import { searchGeoclient } from '../services/geoclientService';

export function useGeoclientSearch(query, { debounceMs = 300, limit = 10, options } = {}) {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null); // e.g., 404/429/503
  const ctrlRef = useRef(null);
  const debTimerRef = useRef(null);
  const [cooldownMs, setCooldownMs] = useState(0);
  const cooldownTimerRef = useRef(null);

  const effectiveQuery = typeof query === 'string' ? query.trim() : '';
  const enabled = effectiveQuery.length >= 2;

  // Stabilize options to avoid re-creating callbacks every render
  const stableOptionsKey = useMemo(() => {
    try { return JSON.stringify(options || {}); } catch (_) { return '{}'; }
  }, [options]);
  const stableOptions = useMemo(() => {
    try { return options ? JSON.parse(stableOptionsKey) : {}; } catch (_) { return {}; }
  }, [stableOptionsKey]);

  const run = useMemo(() => {
    return async (q, signal) => {
      try {
        const { results: r, status: st } = await searchGeoclient({ input: q, limit, signal, ...stableOptions });
        setResults(Array.isArray(r) ? r : []);
        setStatus(st || null);
        setError(null);
      } catch (e) {
        setError(e);
        setStatus(e && typeof e.status === 'number' ? e.status : null);
        setResults([]);
        if (e && e.status === 429) {
          const initial = 6000; // ms
          setCooldownMs(initial);
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          cooldownTimerRef.current = setInterval(() => {
            setCooldownMs((prev) => {
              const next = Math.max(0, prev - 250);
              if (next === 0 && cooldownTimerRef.current) {
                clearInterval(cooldownTimerRef.current);
                cooldownTimerRef.current = null;
              }
              return next;
            });
          }, 250);
        }
      } finally {
        setIsLoading(false);
      }
    };
  }, [limit, stableOptions]);

  useEffect(() => {
    if (debTimerRef.current) {
      clearTimeout(debTimerRef.current);
      debTimerRef.current = null;
    }
    if (ctrlRef.current) {
      try { ctrlRef.current.abort(); } catch (_) {}
      ctrlRef.current = null;
    }

    if (!enabled || cooldownMs > 0) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      setStatus(null);
      return;
    }

    setIsLoading(true);
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    debTimerRef.current = setTimeout(() => run(effectiveQuery, ctrl.signal), debounceMs);
    return () => {
      if (debTimerRef.current) clearTimeout(debTimerRef.current);
      try { ctrl.abort(); } catch (_) {}
    };
  }, [effectiveQuery, debounceMs, enabled, cooldownMs, run]);

  return { results, isLoading, error, status, cooldownMs };
}


