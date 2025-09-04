import React, { useEffect, useMemo, useState } from 'react';

const TextAnnotationEditor = ({ map, featureId, drawRef, onSave, onCancel }) => {
  const feature = useMemo(() => {
    try { return drawRef?.current?.get ? drawRef.current.get(featureId) : null; } catch (_) { return null; }
  }, [drawRef, featureId]);

  const [form, setForm] = useState({ label: '', textSize: 14, textColor: '#111827', halo: true });
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    try {
      if (!map || !feature || feature.geometry?.type !== 'Point') return;
      const [lng, lat] = feature.geometry.coordinates;
      const pt = map.project([lng, lat]);
      setPos({ x: pt.x, y: pt.y });
    } catch (_) {}
  }, [map, feature]);

  useEffect(() => {
    if (!feature) return;
    const p = feature.properties || {};
    setForm({
      label: String(p.label || ''),
      textSize: Number(p.textSize || 14),
      textColor: p.textColor || '#111827',
      halo: p.halo !== false
    });
  }, [feature]);

  // Close editor if the underlying feature is deleted or no longer exists (e.g., Backspace)
  useEffect(() => {
    if (!map || !featureId) return;
    const closeIfMissing = () => {
      try {
        const f = drawRef?.current?.get ? drawRef.current.get(featureId) : null;
        if (!f && typeof onCancel === 'function') onCancel();
      } catch (_) {}
    };
    const onDelete = () => closeIfMissing();
    const onSelectionChange = () => closeIfMissing();
    try { map.on('draw.delete', onDelete); } catch (_) {}
    try { map.on('draw.update', onDelete); } catch (_) {}
    try { map.on('draw.selectionchange', onSelectionChange); } catch (_) {}
    try { map.on('draw.render', onSelectionChange); } catch (_) {}
    return () => {
      try { map.off('draw.delete', onDelete); } catch (_) {}
      try { map.off('draw.update', onDelete); } catch (_) {}
      try { map.off('draw.selectionchange', onSelectionChange); } catch (_) {}
      try { map.off('draw.render', onSelectionChange); } catch (_) {}
    };
  }, [map, drawRef, featureId, onCancel]);

  if (!feature) return null;

  const handleSave = () => {
    try {
      const f = drawRef.current.get(featureId);
      f.properties = Object.assign({}, f.properties, {
        label: form.label,
        textSize: Number(form.textSize) || 14,
        textColor: form.textColor,
        halo: !!form.halo,
        type: 'text'
      });
      drawRef.current.add(f);
    } catch (_) {}
    if (onSave) onSave(form);
    try { if (map && map.triggerRepaint) map.triggerRepaint(); } catch (_) {}
  };

  return (
    <div className="absolute z-50" style={{ left: pos.x + 10, top: pos.y + 10 }}>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow p-3 space-y-2" style={{ width: 260 }}>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Text</label>
          <input
            autoFocus
            type="text"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            placeholder="Enter label"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel && onCancel(); }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 items-center">
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Color</label>
            <input type="color" value={form.textColor} onChange={(e) => setForm({ ...form, textColor: e.target.value })} className="w-full h-8 p-0 border border-gray-300 dark:border-gray-700 rounded" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Size</label>
            <input type="number" min={8} max={48} value={form.textSize} onChange={(e) => setForm({ ...form, textSize: e.target.value })} className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          </div>
        </div>
        <label className="flex items-center text-xs text-gray-700 dark:text-gray-200">
          <input type="checkbox" checked={!!form.halo} onChange={(e) => setForm({ ...form, halo: e.target.checked })} className="mr-2" />
          Text halo for contrast
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="px-2 py-1 text-sm rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
          <button onClick={handleSave} className="px-2 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">Save</button>
        </div>
      </div>
    </div>
  );
};

export default TextAnnotationEditor;



// Lightweight action pill overlay for annotations (e.g., arrows)
// Renders near the feature and provides Label / Remove actions.
export const AnnotationActionPill = ({ map, drawRef, featureId, onClose }) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const updatePos = () => {
    try {
      const f = drawRef?.current?.get ? drawRef.current.get(featureId) : null;
      if (!f || !f.geometry) return;
      const g = f.geometry;
      let anchor = null;
      if (g.type === 'LineString') {
        const coords = g.coordinates || [];
        anchor = coords[coords.length - 1] || coords[0] || null; // tip/end
      } else if (g.type === 'Point') {
        anchor = g.coordinates || null;
      } else if (g.type === 'Polygon') {
        const ring = (g.coordinates || [])[0] || [];
        anchor = ring[0] || null;
      }
      if (anchor) {
        const p = map.project(anchor);
        setPos({ x: p.x, y: p.y });
      }
    } catch (_) {}
  };

  useEffect(() => {
    updatePos();
    if (!map) return;
    const onMove = () => updatePos();
    try { map.on('move', onMove); } catch (_) {}
    try { map.on('zoom', onMove); } catch (_) {}
    try { map.on('resize', onMove); } catch (_) {}
    return () => {
      try { map.off('move', onMove); } catch (_) {}
      try { map.off('zoom', onMove); } catch (_) {}
      try { map.off('resize', onMove); } catch (_) {}
    };
  }, [map, drawRef, featureId]);

  // Auto-close when feature disappears
  useEffect(() => {
    if (!map || !featureId) return;
    const closeIfMissing = () => {
      try {
        const f = drawRef?.current?.get ? drawRef.current.get(featureId) : null;
        if (!f && typeof onClose === 'function') onClose();
      } catch (_) {}
    };
    const onDelete = () => closeIfMissing();
    const onSelectionChange = () => closeIfMissing();
    try { map.on('draw.delete', onDelete); } catch (_) {}
    try { map.on('draw.update', onDelete); } catch (_) {}
    try { map.on('draw.selectionchange', onSelectionChange); } catch (_) {}
    try { map.on('draw.render', onSelectionChange); } catch (_) {}
    // Safety: also close immediately on Delete/Backspace so repeated attempts don't linger
    const onKeyDown = (e) => {
      try {
        const isDel = e.key === 'Delete' || e.key === 'Backspace';
        if (!isDel) return;
        // Defer slightly to allow draw.delete to fire; then close if still mounted
        setTimeout(() => closeIfMissing(), 0);
      } catch (_) {}
    };
    try { window.addEventListener('keydown', onKeyDown, { passive: true }); } catch (_) {}
    return () => {
      try { map.off('draw.delete', onDelete); } catch (_) {}
      try { map.off('draw.update', onDelete); } catch (_) {}
      try { map.off('draw.selectionchange', onSelectionChange); } catch (_) {}
      try { map.off('draw.render', onSelectionChange); } catch (_) {}
      try { window.removeEventListener('keydown', onKeyDown); } catch (_) {}
    };
  }, [map, drawRef, featureId, onClose]);

  const handleLabel = () => {
    try {
      const f = drawRef?.current?.get ? drawRef.current.get(featureId) : null;
      if (!f) return;
      const val = typeof window !== 'undefined' ? window.prompt('Arrow label') : null;
      if (val != null) {
        const next = { ...f, properties: Object.assign({}, f.properties || {}, { label: String(val) }) };
        // draw.replace specific method may vary; add() will duplicate, so prefer setFeatureProperty if available
        if (drawRef?.current?.setFeatureProperty) {
          drawRef.current.setFeatureProperty(featureId, 'label', String(val));
        } else if (drawRef?.current?.add) {
          drawRef.current.add(next);
        }
        try { if (map && map.triggerRepaint) map.triggerRepaint(); } catch (_) {}
      }
    } catch (_) {}
    if (typeof onClose === 'function') onClose();
  };

  const handleRemove = () => {
    try { drawRef?.current?.delete && drawRef.current.delete(featureId); } catch (_) {}
    if (typeof onClose === 'function') onClose();
  };

  return (
    <div className="absolute" style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -100%)', zIndex: 2000, pointerEvents: 'auto' }}>
      <div className="rounded-full px-2 py-1 text-[11px] shadow-sm flex gap-1 bg-white/90 dark:bg-gray-900/80 border border-gray-200/60 dark:border-gray-700/60">
        <button
          type="button"
          title="Label"
          onClick={handleLabel}
          className="px-2 py-0.5 rounded-full border border-gray-300/70 dark:border-gray-700 text-gray-700 dark:text-gray-200 bg-white/70 dark:bg-gray-800/50 hover:bg-white/90"
        >
          Label…
        </button>
        <button
          type="button"
          title="Remove"
          onClick={handleRemove}
          className="text-white rounded-full px-2 py-0.5 bg-red-500 hover:bg-red-600"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
