import React, { useEffect, useRef } from 'react';

const NudgeMarkers = ({ nudges = [], map, objectUpdateTrigger = 0, onDismiss, highlightedIds = new Set() }) => {
  const containerRef = useRef(null);
  const nodeRefs = useRef(new Map());

  const registerRef = (id, el) => {
    try {
      if (el) nodeRefs.current.set(id, el); else nodeRefs.current.delete(id);
    } catch (_) {}
  };

  useEffect(() => {
    if (!map) return;
    const update = () => {
      try {
        for (let i = 0; i < nudges.length; i++) {
          const n = nudges[i];
          const pos = n?.subject?.position;
          if (!pos) continue;
          const el = nodeRefs.current.get(n.id);
          if (!el) continue;
          const p = map.project([pos.lng, pos.lat]);
          const transform = `translate(${p.x - 8}px, ${p.y - 26}px)`;
          if (el.__lastTransform !== transform) {
            el.style.transform = transform;
            el.__lastTransform = transform;
          }
        }
      } catch (_) {}
    };
    try { map.on('render', update); } catch (_) {}
    // Initialize immediately
    update();
    return () => { try { map.off('render', update); } catch (_) {} };
  }, [map, nudges, objectUpdateTrigger]);

  if (!Array.isArray(nudges) || nudges.length === 0) return null;

  return (
    <div className="pointer-events-none" ref={containerRef}>
      {nudges.map(n => (
        <div
          key={n.id}
          ref={(el) => registerRef(n.id, el)}
          className="absolute z-[1001]"
          style={{ transform: 'translate(-9999px, -9999px)' }}
        >
          <div className={`pointer-events-auto select-none flex items-center gap-1 bg-white border rounded shadow px-2 py-1 text-[11px] text-gray-700 ${highlightedIds.has(n.id) ? 'ring-2 ring-amber-400' : ''}`}>
            <span className={n.severity === 'warning' ? 'text-amber-600' : 'text-blue-600'}>
              {n.severity === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <span className="max-w-[220px] truncate" title={n.message}>{n.message}</span>
            <button
              className="ml-1 text-gray-400 hover:text-gray-600"
              title="Ignore"
              onClick={(e) => { e.stopPropagation(); onDismiss && onDismiss(n.id); }}
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


