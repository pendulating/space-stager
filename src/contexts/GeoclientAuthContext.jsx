import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'geoclient.v2.key';
const STORAGE_REMEMBER = 'geoclient.v2.remember';

export const GeoclientAuthContext = createContext(null);

export function GeoclientAuthProvider({ children }) {
  const [key, setKeyState] = useState('');
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    try {
      const rem = (typeof window !== 'undefined' && window.localStorage && localStorage.getItem(STORAGE_REMEMBER)) === '1';
      setRemember(rem);
      if (rem) {
        const saved = (typeof window !== 'undefined' && window.localStorage) ? localStorage.getItem(STORAGE_KEY) : '';
        if (typeof saved === 'string' && saved) setKeyState(saved);
      }
    } catch (_) {}
  }, []);

  const setKey = useCallback((next, opts = {}) => {
    const val = typeof next === 'string' ? next.trim() : '';
    const rem = typeof opts.remember === 'boolean' ? opts.remember : remember;
    setKeyState(val);
    setRemember(rem);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_REMEMBER, rem ? '1' : '0');
        if (rem && val) localStorage.setItem(STORAGE_KEY, val); else localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {}
  }, [remember]);

  const clearKey = useCallback(() => {
    setKeyState('');
    try { if (typeof window !== 'undefined' && window.localStorage) localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }, []);

  const value = useMemo(() => ({ key, setKey, clearKey, remember }), [key, setKey, clearKey, remember]);

  return (
    <GeoclientAuthContext.Provider value={value}>
      {children}
    </GeoclientAuthContext.Provider>
  );
}

export function useGeoclientAuth() {
  const ctx = React.useContext(GeoclientAuthContext);
  if (!ctx) throw new Error('useGeoclientAuth must be used within GeoclientAuthProvider');
  return ctx;
}


