import React, { createContext, useCallback, useContext, useMemo, useReducer, useEffect } from 'react';

const DroppedObjectsContext = createContext(null);

const shouldDebug = () => {
  try {
    if (typeof window !== 'undefined') {
      if (window.__DEBUG_DROPPED_CTX__ === true) return true;
      const ls = window.localStorage;
      if (ls && ls.getItem && (ls.getItem('debug:dropped-objects') === '1' || (ls.getItem('debug') || '').includes('dropped-objects'))) return true;
    }
  } catch (_) {}
  return false;
};

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
      try { if (shouldDebug()) console.debug('[DOCTX] setAll/hydrate', { count: Array.isArray(action.objects) ? action.objects.length : 0 }); } catch (_) {}
      return { ...state, droppedObjects: Array.isArray(action.objects) ? action.objects : [], selectedObjectId: null, selectedKind: null };
    case 'add':
      try { if (shouldDebug()) console.debug('[DOCTX] add', { id: action?.object?.id, type: action?.object?.type }); } catch (_) {}
      return { ...state, droppedObjects: [...state.droppedObjects, action.object] };
    case 'addMany':
      try { if (shouldDebug()) console.debug('[DOCTX] addMany', { count: (action.objects || []).length }); } catch (_) {}
      return { ...state, droppedObjects: [...state.droppedObjects, ...(action.objects || [])] };
    case 'removeById':
      try { if (shouldDebug()) console.debug('[DOCTX] removeById', { id: action.id }); } catch (_) {}
      return { ...state, droppedObjects: state.droppedObjects.filter(o => o.id !== action.id), selectedObjectId: state.selectedObjectId === action.id ? null : state.selectedObjectId, selectedKind: state.selectedObjectId === action.id ? null : state.selectedKind };
    case 'updateById': {
      const { id, updater } = action;
      try { if (shouldDebug()) console.debug('[DOCTX] updateById', { id }); } catch (_) {}
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
      try { if (shouldDebug()) console.debug('[DOCTX] setNote', { id, hasNote: !!note }); } catch (_) {}
      const next = state.droppedObjects.map((obj) => obj.id === id ? ({ ...obj, properties: { ...(obj.properties || {}), note: note || '' } }) : obj);
      return { ...state, droppedObjects: next };
    }
    case 'clearAll':
      try { if (shouldDebug()) console.debug('[DOCTX] clearAll'); } catch (_) {}
      return { ...state, droppedObjects: [], selectedObjectId: null, selectedKind: null, hoveredObjectId: null, hoveredKind: null };
    case 'select':
      try {
        if (shouldDebug()) {
          const exists = Array.isArray(state.droppedObjects) && state.droppedObjects.some(o => o && o.id === action.id);
          console.debug('[DOCTX] select', { prev: state.selectedObjectId, next: action.id || null, kind: action.kind || null, exists });
        }
      } catch (_) {}
      return { ...state, selectedObjectId: action.id || null, selectedKind: action.kind || null };
    case 'clearSelection':
      try { if (shouldDebug()) console.debug('[DOCTX] clearSelection', { prev: state.selectedObjectId, prevKind: state.selectedKind }); } catch (_) {}
      return { ...state, selectedObjectId: null, selectedKind: null };
    case 'hover':
      try { if (shouldDebug()) console.debug('[DOCTX] hover', { id: action.id || null, kind: action.kind || null }); } catch (_) {}
      return { ...state, hoveredObjectId: action.id || null, hoveredKind: action.kind || null };
    case 'clearHover':
      try { if (shouldDebug()) console.debug('[DOCTX] clearHover'); } catch (_) {}
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

  useEffect(() => {
    try {
      if (!shouldDebug()) return;
      if (typeof window !== 'undefined') {
        window.__droppedObjects = state.droppedObjects;
        window.__selectedId = state.selectedObjectId;
        window.__selectedKind = state.selectedKind;
        window.__hoveredId = state.hoveredObjectId;
        window.__hoveredKind = state.hoveredKind;
        window.__doctx = {
          select: (id, kind) => dispatch({ type: 'select', id, kind }),
          clearSelection: () => dispatch({ type: 'clearSelection' }),
          hover: (id, kind) => dispatch({ type: 'hover', id, kind }),
          clearHover: () => dispatch({ type: 'clearHover' }),
          remove: (id) => dispatch({ type: 'removeById', id }),
          update: (id, updater) => dispatch({ type: 'updateById', id, updater })
        };
      }
    } catch (_) {}
  }, [state.droppedObjects, state.selectedObjectId, state.selectedKind, state.hoveredObjectId, state.hoveredKind]);

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


