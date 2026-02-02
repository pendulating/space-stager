import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'spaceStagerGeography';

const DEFAULT_TYPE = 'intersections';

const GeographyContext = createContext();

export function GeographyProvider({ children }) {
  const [geographyType, setGeographyType] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.type) return parsed.type;
      }
    } catch (_) {}
    // Force intersections as the absolute default if no valid saved state
    return 'intersections';
  });

  const [isGeographyChosen, setIsGeographyChosen] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ type: 'intersections' }));
      }
    } catch (_) {}
  }, []);

  const selectGeography = (type) => {
    setGeographyType(type);
    setIsGeographyChosen(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ type }));
    } catch (_) {}
  };

  const resetGeography = () => {
    setIsGeographyChosen(false);
    setGeographyType('intersections');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  };

  const value = useMemo(() => ({
    geographyType,
    isGeographyChosen,
    selectGeography,
    resetGeography
  }), [geographyType, isGeographyChosen]);

  return (
    <GeographyContext.Provider value={value}>
      {children}
    </GeographyContext.Provider>
  );
}

export function useGeography() {
  const ctx = useContext(GeographyContext);
  if (!ctx) throw new Error('useGeography must be used within a GeographyProvider');
  return ctx;
}
