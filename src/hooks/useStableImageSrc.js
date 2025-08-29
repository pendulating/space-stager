import { useEffect, useRef, useState } from 'react';
import { preloadChain, firstReadyInChain, preloadImage } from '../utils/spriteResolver';

/**
 * useStableImageSrc
 * Given a fallback chain, keeps the last-good src until the next candidate successfully loads,
 * then switches atomically. Prevents flicker during perspective switches.
 */
export const useStableImageSrc = (srcChain, changeKey) => {
  const [src, setSrc] = useState(() => firstReadyInChain(srcChain) || (srcChain?.[0] ?? null));
  const mountedRef = useRef(true);
  const prevRef = useRef(srcChain);
  const prevKeyRef = useRef(changeKey);

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    const prevChain = prevRef.current;
    const prevKey = prevKeyRef.current;
    const changed = srcChain !== prevChain;
    const keyChanged = changeKey !== prevKey;
    prevRef.current = srcChain;
    prevKeyRef.current = changeKey;
    if (!changed || !Array.isArray(srcChain) || srcChain.length === 0) return;
    let cancelled = false;
    const proceed = async () => {
      // Prefer the primary candidate (best for current view) and only fall back if it fails
      const primary = srcChain[0] || null;
      // On view-mode change, optimistically switch to the new primary immediately
      const prevPrimary = Array.isArray(prevChain) ? prevChain[0] : null;
      if ((keyChanged || !Array.isArray(prevChain) || (Array.isArray(prevChain) && prevChain.length === 0) || src == null || primary !== prevPrimary) && primary && primary !== src) {
        setSrc(primary);
      }
      let next = null;
      if (primary) {
        const okPrimary = await preloadImage(primary);
        if (cancelled || !mountedRef.current) return;
        if (okPrimary) {
          next = primary;
        }
      }
      if (!next) {
        // Try the rest of the chain sequentially
        await preloadChain(srcChain);
        if (cancelled || !mountedRef.current) return;
        next = firstReadyInChain(srcChain) || primary || null;
      }
      if (!cancelled && mountedRef.current && next && next !== src) setSrc(next);
    };
    proceed();
    return () => { cancelled = true; };
  }, [srcChain, changeKey, src]);

  return src;
};


