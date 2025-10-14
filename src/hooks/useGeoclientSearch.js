// src/hooks/useGeoclientSearch.js
import { useEffect, useMemo, useRef, useState } from 'react';
import { searchGeoclient } from '../services/geoclientService';

export function useGeoclientSearch(query, { debounceMs = 300, limit = 10, options = {} } = {}) {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const ctrlRef = useRef(null);
  const debTimerRef = useRef(null);

  const effectiveQuery = typeof query === 'string' ? query.trim() : '';
  const enabled = effectiveQuery.length >= 2;

  const run = useMemo(() => {
    return async (q, signal) => {
      try {
        const { results: r } = await searchGeoclient({ input: q, limit, signal, ...options });
        setResults(Array.isArray(r) ? r : []);
        setError(null);
      } catch (e) {
        setError(e);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };
  }, [limit, options]);

  useEffect(() => {
    if (debTimerRef.current) {
      clearTimeout(debTimerRef.current);
      debTimerRef.current = null;
    }
    if (ctrlRef.current) {
      try { ctrlRef.current.abort(); } catch (_) {}
      ctrlRef.current = null;
    }

    if (!enabled) {
      setResults([]);
      setIsLoading(false);
      setError(null);
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
  }, [effectiveQuery, debounceMs, enabled, run]);

  return { results, isLoading, error };
}


