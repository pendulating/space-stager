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


