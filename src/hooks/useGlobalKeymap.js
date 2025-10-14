import { useEffect, useMemo } from 'react';
import { subscribeKey, makeKeyBinding } from '../services/keymap';

/**
 * useGlobalKeymap
 * Provide one or more key bindings with cleanup and stable descriptor.
 * bindings: Array<{
 *   type?: 'keydown'|'keyup',
 *   key?: string|string[],
 *   code?: string|string[],
 *   ctrl?: boolean, alt?: boolean, shift?: boolean, meta?: boolean,
 *   onEvent: (KeyboardEvent) => void,
 *   priority?: number, // higher number wins
 *   stop?: boolean, // stop after handling
 *   preventDefault?: boolean,
 *   enabled?: boolean|() => boolean
 * }>
 */
export function useGlobalKeymap(bindings) {
  const normalized = useMemo(() => {
    if (!Array.isArray(bindings)) return [];
    return bindings.filter(Boolean).map((b) => makeKeyBinding(b));
  }, [bindings]);

  useEffect(() => {
    if (!normalized.length) return undefined;
    const unsubs = normalized.map((b) => subscribeKey(b));
    return () => {
      unsubs.forEach((u) => { try { u(); } catch (_) {} });
    };
  }, [normalized]);
}


