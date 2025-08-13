import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'spaceStagerGeography';

const DEFAULT_TYPE = 'parks';

const GeographyContext = createContext();

export function GeographyProvider({ children }) {
  const [geographyType, setGeographyType] = useState(DEFAULT_TYPE);
  const [isGeographyChosen, setIsGeographyChosen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.type) {
          setGeographyType(parsed.type);
          setIsGeographyChosen(true);
        }
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
    setGeographyType(DEFAULT_TYPE);
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


