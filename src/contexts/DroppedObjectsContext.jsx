import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react';

const DroppedObjectsContext = createContext(null);

const initialState = {
  droppedObjects: [],
  selectedObjectId: null,
  selectedKind: null, // 'rect' | 'point' | null
  hoveredObjectId: null,
  hoveredKind: null // 'rect' | 'point' | null
};

function reducer(state, action) {
  switch (action.type) {
    case 'hydrate':
    case 'setAll':
      return { ...state, droppedObjects: Array.isArray(action.objects) ? action.objects : [], selectedObjectId: null, selectedKind: null };
    case 'add':
      return { ...state, droppedObjects: [...state.droppedObjects, action.object] };
    case 'addMany':
      return { ...state, droppedObjects: [...state.droppedObjects, ...(action.objects || [])] };
    case 'removeById':
      return { ...state, droppedObjects: state.droppedObjects.filter(o => o.id !== action.id), selectedObjectId: state.selectedObjectId === action.id ? null : state.selectedObjectId, selectedKind: state.selectedObjectId === action.id ? null : state.selectedKind };
    case 'updateById': {
      const { id, updater } = action;
      const next = state.droppedObjects.map((obj) => {
        if (obj.id !== id) return obj;
        if (typeof updater === 'function') return updater(obj);
        if (updater && typeof updater === 'object') return { ...obj, ...updater };
        return obj;
      });
      return { ...state, droppedObjects: next };
    }
    case 'setNote': {
      const { id, note } = action;
      const next = state.droppedObjects.map((obj) => obj.id === id ? ({ ...obj, properties: { ...(obj.properties || {}), note: note || '' } }) : obj);
      return { ...state, droppedObjects: next };
    }
    case 'clearAll':
      return { ...state, droppedObjects: [], selectedObjectId: null, selectedKind: null, hoveredObjectId: null, hoveredKind: null };
    case 'select':
      return { ...state, selectedObjectId: action.id || null, selectedKind: action.kind || null };
    case 'clearSelection':
      return { ...state, selectedObjectId: null, selectedKind: null };
    case 'hover':
      return { ...state, hoveredObjectId: action.id || null, hoveredKind: action.kind || null };
    case 'clearHover':
      return { ...state, hoveredObjectId: null, hoveredKind: null };
    default:
      return state;
  }
}

export const DroppedObjectsProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const addObject = useCallback((object) => dispatch({ type: 'add', object }), []);
  const addObjects = useCallback((objects) => dispatch({ type: 'addMany', objects }), []);
  const setAll = useCallback((objects) => dispatch({ type: 'setAll', objects }), []);
  const hydrate = useCallback((objects) => dispatch({ type: 'hydrate', objects }), []);
  const removeObject = useCallback((id) => dispatch({ type: 'removeById', id }), []);
  const updateObject = useCallback((id, updater) => dispatch({ type: 'updateById', id, updater }), []);
  const setNote = useCallback((id, note) => dispatch({ type: 'setNote', id, note }), []);
  const clearAll = useCallback(() => dispatch({ type: 'clearAll' }), []);
  const select = useCallback((id, kind) => dispatch({ type: 'select', id, kind }), []);
  const clearSelection = useCallback(() => dispatch({ type: 'clearSelection' }), []);
  const hover = useCallback((id, kind) => dispatch({ type: 'hover', id, kind }), []);
  const clearHover = useCallback(() => dispatch({ type: 'clearHover' }), []);

  const value = useMemo(() => ({
    droppedObjects: state.droppedObjects,
    selectedObjectId: state.selectedObjectId,
    selectedKind: state.selectedKind,
    hoveredObjectId: state.hoveredObjectId,
    hoveredKind: state.hoveredKind,
    addObject,
    addObjects,
    setAll,
    hydrate,
    removeObject,
    updateObject,
    setNote,
    clearAll,
    select,
    clearSelection,
    hover,
    clearHover
  }), [state.droppedObjects, state.selectedObjectId, state.selectedKind, state.hoveredObjectId, state.hoveredKind, addObject, addObjects, setAll, hydrate, removeObject, updateObject, setNote, clearAll, select, clearSelection, hover, clearHover]);

  return (
    <DroppedObjectsContext.Provider value={value}>
      {children}
    </DroppedObjectsContext.Provider>
  );
};

export const useDroppedObjects = () => {
  const ctx = useContext(DroppedObjectsContext);
  if (!ctx) throw new Error('useDroppedObjects must be used within DroppedObjectsProvider');
  return ctx;
};


