import React, { createContext, useContext, useState, useEffect } from 'react';

const SitePlanContext = createContext();

export function SitePlanProvider({ children }) {
  const [isSitePlanMode, setIsSitePlanMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0);

  // Check if we should be in site plan mode
  const shouldBeInSitePlanMode = (focusedArea, zoom) => {
    // Enter site plan mode when:
    // 1. There's a focused area AND
    // 2. Zoom level is high enough (indicating detailed view)
    return focusedArea && zoom >= 14;
  };

  // Update site plan mode based on focused area and zoom
  const updateSitePlanMode = (focusedArea, zoom) => {
    const shouldBe = shouldBeInSitePlanMode(focusedArea, zoom);
    setIsSitePlanMode(shouldBe);
    setZoomLevel(zoom);
  };

  const value = {
    isSitePlanMode,
    zoomLevel,
    updateSitePlanMode,
    shouldBeInSitePlanMode
  };

  return (
    <SitePlanContext.Provider value={value}>
      {children}
    </SitePlanContext.Provider>
  );
}

export function useSitePlan() {
  const context = useContext(SitePlanContext);
  if (!context) {
    throw new Error('useSitePlan must be used within a SitePlanProvider');
  }
  return context;
} 