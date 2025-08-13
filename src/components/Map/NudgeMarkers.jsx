import React, { useMemo } from 'react';

const NudgeMarkers = ({ nudges = [], map, objectUpdateTrigger = 0, onDismiss, highlightedIds = new Set() }) => {
  const markers = useMemo(() => {
    if (!Array.isArray(nudges) || !map || typeof map.project !== 'function') return [];
    return nudges.map(n => {
      const pos = n?.subject?.position;
      if (!pos) return null;
      try {
        const px = map.project([pos.lng, pos.lat]);
        return { id: n.id, nudge: n, x: px.x, y: px.y };
      } catch {
        return null;
      }
    }).filter(Boolean);
  }, [nudges, map, objectUpdateTrigger]);

  if (!markers.length) return null;

  return (
    <div className="pointer-events-none">
      {markers.map(m => (
        <div
          key={m.id}
          className="absolute z-[1001]" // above objects
          style={{ left: m.x - 8, top: m.y - 26 }}
        >
          <div className={`pointer-events-auto select-none flex items-center gap-1 bg-white border rounded shadow px-2 py-1 text-[11px] text-gray-700 ${highlightedIds.has(m.id) ? 'ring-2 ring-amber-400' : ''}`}>
            <span className={m.nudge.severity === 'warning' ? 'text-amber-600' : 'text-blue-600'}>
              {m.nudge.severity === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <span className="max-w-[220px] truncate" title={m.nudge.message}>{m.nudge.message}</span>
            <button
              className="ml-1 text-gray-400 hover:text-gray-600"
              title="Ignore"
              onClick={(e) => { e.stopPropagation(); onDismiss && onDismiss(m.id); }}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NudgeMarkers;


