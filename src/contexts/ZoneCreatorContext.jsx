// src/contexts/ZoneCreatorContext.jsx
import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

export const PRIMARY_TYPES = {
  SINGLE_BLOCK: 'single-block',
  MULTI_BLOCK: 'multi-block'
};

const ZoneCreatorContext = createContext();

export function ZoneCreatorProvider({ children }) {
  const [isActive, setIsActive] = useState(false);
  const [primaryType, setPrimaryType] = useState(PRIMARY_TYPES.SINGLE_BLOCK);
  const [curbLaneOnly, setCurbLaneOnly] = useState(false);
  const [sidewalkOnly, setSidewalkOnly] = useState(false);
  const [entireZonePdf, setEntireZonePdf] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [selectedNodes, setSelectedNodes] = useState([]); // { id, coord: [lng, lat] }
  const [widthFeet, setWidthFeet] = useState(40);
  const [previewActive, setPreviewActive] = useState(false);

  const addNodeId = useCallback((id) => {
    if (id === undefined || id === null) return;
    setSelectedNodeIds((prev) => {
      // avoid immediate duplicates
      if (prev.length > 0 && prev[prev.length - 1] === id) return prev;
      return [...prev, id];
    });
  }, []);

  const addNode = useCallback((id, coord) => {
    if (id === undefined || id === null || !Array.isArray(coord)) return;
    setSelectedNodeIds((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === id) return prev;
      return [...prev, id];
    });
    setSelectedNodes((prev) => {
      if (prev.length > 0 && prev[prev.length - 1]?.id === id) return prev;
      return [...prev, { id, coord }];
    });
  }, []);

  const undoLastNode = useCallback(() => {
    setSelectedNodeIds((prev) => prev.slice(0, -1));
    setSelectedNodes((prev) => prev.slice(0, -1));
  }, []);

  const clearNodes = useCallback(() => {
    setSelectedNodeIds([]);
    setSelectedNodes([]);
  }, []);

  // Respond to global clear events (e.g., ESC from hook)
  React.useEffect(() => {
    const handler = () => setSelectedNodeIds([]);
    window.addEventListener('zonecreator:clear', handler);
    return () => window.removeEventListener('zonecreator:clear', handler);
  }, []);

  const value = useMemo(() => ({
    isActive,
    setIsActive,
    primaryType,
    setPrimaryType,
    curbLaneOnly,
    setCurbLaneOnly,
    sidewalkOnly,
    setSidewalkOnly,
    entireZonePdf,
    setEntireZonePdf,
    selectedNodeIds,
    selectedNodes,
    addNodeId,
    addNode,
    undoLastNode,
    clearNodes,
    widthFeet,
    setWidthFeet,
    previewActive,
    setPreviewActive
  }), [isActive, primaryType, curbLaneOnly, sidewalkOnly, entireZonePdf, selectedNodeIds, selectedNodes, addNodeId, addNode, undoLastNode, clearNodes, widthFeet, previewActive]);

  return (
    <ZoneCreatorContext.Provider value={value}>
      {children}
    </ZoneCreatorContext.Provider>
  );
}

export function useZoneCreatorContext() {
  const ctx = useContext(ZoneCreatorContext);
  if (!ctx) throw new Error('useZoneCreatorContext must be used within a ZoneCreatorProvider');
  return ctx;
}


