// src/contexts/OpenStreetsContext.jsx
import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { loadOpenStreetsData } from '../services/openStreetsService';
import { calculateGeometryBounds } from '../utils/geometryUtils';

const OpenStreetsContext = createContext();

export const OpenStreetsProvider = ({ children }) => {
  const [openStreetsData, setOpenStreetsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const lastBoundsRef = useRef(null);
  const fetchAbortRef = useRef(null);

  // Fetch based on focused area (original behavior)
  const fetchOpenStreets = useCallback(async (focusedArea) => {
    if (!focusedArea) {
      setOpenStreetsData(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const bounds = calculateGeometryBounds(focusedArea.geometry);
      if (!bounds) throw new Error('Invalid focused area geometry');
      
      const data = await loadOpenStreetsData(bounds);
      setOpenStreetsData(data);
    } catch (err) {
      console.error('[OpenStreetsContext] Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch based on map viewport bounds (for citywide view)
  const fetchOpenStreetsForBounds = useCallback(async (bounds) => {
    if (!bounds || !Array.isArray(bounds) || bounds.length !== 2) {
      return;
    }

    // Check if bounds have changed significantly (avoid refetching on tiny moves)
    const boundsKey = bounds.map(b => b.map(v => v.toFixed(4)).join(',')).join('|');
    if (lastBoundsRef.current === boundsKey) {
      return;
    }
    lastBoundsRef.current = boundsKey;

    // Cancel any in-flight request
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }
    fetchAbortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    try {
      const data = await loadOpenStreetsData(bounds);
      setOpenStreetsData(data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[OpenStreetsContext] Error fetching data for bounds:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleVisibility = useCallback(() => {
    setIsVisible(prev => !prev);
  }, []);

  const value = useMemo(() => ({
    openStreetsData,
    loading,
    error,
    isVisible,
    fetchOpenStreets,
    fetchOpenStreetsForBounds,
    toggleVisibility,
    setIsVisible
  }), [openStreetsData, loading, error, isVisible, fetchOpenStreets, fetchOpenStreetsForBounds, toggleVisibility]);

  return (
    <OpenStreetsContext.Provider value={value}>
      {children}
    </OpenStreetsContext.Provider>
  );
};

export const useOpenStreetsContext = () => {
  const context = useContext(OpenStreetsContext);
  if (!context) {
    throw new Error('useOpenStreetsContext must be used within an OpenStreetsProvider');
  }
  return context;
};

