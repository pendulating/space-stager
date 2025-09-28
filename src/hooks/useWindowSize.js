import { useState, useEffect } from 'react';

const DEFAULT_SIZE = { width: 0, height: 0 };

export function useWindowSize() {
  const [size, setSize] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_SIZE;
    return { width: window.innerWidth, height: window.innerHeight };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return size;
}


