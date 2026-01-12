// src/contexts/ZoneCreatorContext.jsx
import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

export const WORKFLOW_STEPS = {
  IDLE: 'IDLE',
  PICK_START: 'PICK_START',
  EXTEND_ZONE: 'EXTEND_ZONE',
  PREVIEW: 'PREVIEW'
};

const ZoneCreatorContext = createContext();

export function ZoneCreatorProvider({ children }) {
  const [isActive, setIsActive] = useState(false);
  const [workflowStep, setWorkflowStepState] = useState(WORKFLOW_STEPS.IDLE);
  
  const setWorkflowStep = useCallback((step) => {
    setWorkflowStepState(step);
  }, []);
  const [availableExtensions, setAvailableExtensions] = useState([]);
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

  const addNode = useCallback((id, coord, properties = {}) => {
    if (id === undefined || id === null || !Array.isArray(coord)) return;
    setSelectedNodeIds((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === id) return prev;
      return [...prev, id];
    });
    setSelectedNodes((prev) => {
      if (prev.length > 0 && prev[prev.length - 1]?.id === id) return prev;
      return [...prev, { id, coord, properties }];
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
    workflowStep,
    setWorkflowStep,
    availableExtensions,
    setAvailableExtensions,
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
  }), [isActive, workflowStep, availableExtensions, entireZonePdf, selectedNodeIds, selectedNodes, addNode, undoLastNode, clearNodes, widthFeet, previewActive]);

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


