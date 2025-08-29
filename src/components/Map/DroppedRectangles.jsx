import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useMapViewState } from '../../hooks/useMapViewState';

const DroppedRectangles = ({ objects = [], placeableObjects = [], map, objectUpdateTrigger, selectedId, onSelectRect, onResizeRect }) => {
  const view = useMapViewState(map);
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(null);

  const rects = useMemo(() => {
    const out = [];
    if (!map || typeof map.project !== 'function') return out;
    for (const obj of objects) {
      const type = placeableObjects.find(p => p.id === obj.type);
      if (!type || type.geometryType !== 'rect') continue;
      const coords = obj?.geometry?.coordinates?.[0];
      if (!Array.isArray(coords) || coords.length < 4) continue;
      try {
        const points = coords.slice(0, 4).map(([lng, lat]) => map.project([lng, lat]));
        out.push({ id: obj.id, type, obj, points });
      } catch (_) {}
    }
    return out;
  }, [objects, placeableObjects, map, objectUpdateTrigger, view?.renderTick]);

  // Helper: build resize geometry given screen-space target for a corner
  const buildResizedGeometry = useCallback((r, handleIndex, mouse) => {
    try {
      const pts = r.points; // screen-space corner points in ring order
      const c = { x: (pts[0].x + pts[2].x) / 2, y: (pts[0].y + pts[2].y) / 2 };
      // Basis from current rectangle: u along edge p0->p1, v along edge p3->p0
      const e01 = { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y };
      const e30 = { x: pts[0].x - pts[3].x, y: pts[0].y - pts[3].y };
      const len = (v) => Math.hypot(v.x, v.y) || 1;
      const nu = len(e01);
      const nv = len(e30);
      const u = { x: e01.x / nu, y: e01.y / nu };
      const v = { x: e30.x / nv, y: e30.y / nv };
      const halfW = nu / 2;
      const halfH = nv / 2;
      // Original sign per corner to preserve ring orientation
      const sign = (p) => {
        const dx = p.x - c.x, dy = p.y - c.y;
        const du = dx * u.x + dy * u.y;
        const dv = dx * v.x + dy * v.y;
        return { su: Math.sign(du) || 1, sv: Math.sign(dv) || 1 };
      };
      const s0 = sign(pts[0]);
      const s1 = sign(pts[1]);
      const s2 = sign(pts[2]);
      const s3 = sign(pts[3]);
      // New half extents from mouse projected onto axes
      const md = { x: mouse.x - c.x, y: mouse.y - c.y };
      let du = md.x * u.x + md.y * u.y;
      let dv = md.x * v.x + md.y * v.y;
      const nHalfW = Math.max(6, Math.abs(du));
      const nHalfH = Math.max(6, Math.abs(dv));
      const corner = (sgn) => [
        c.x + sgn.su * nHalfW * u.x + sgn.sv * nHalfH * v.x,
        c.y + sgn.su * nHalfW * u.y + sgn.sv * nHalfH * v.y
      ];
      const p0 = corner(s0);
      const p1 = corner(s1);
      const p2 = corner(s2);
      const p3 = corner(s3);
      // Unproject back to lng/lat and form polygon
      const toLL = (p) => {
        const ll = map.unproject([p[0], p[1]]);
        return [ll.lng, ll.lat];
      };
      const ring = [toLL(p0), toLL(p1), toLL(p2), toLL(p3), toLL(p0)];
      return { type: 'Polygon', coordinates: [ring] };
    } catch (_) { return r.obj?.geometry; }
  }, [map]);

  // Global mouse listeners during drag
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      try {
        if (!dragging) return;
        const { rect, handleIndex, offset } = dragging;
        const x = e.clientX - (offset?.left || 0);
        const y = e.clientY - (offset?.top || 0);
        const mouse = { x, y };
        const newGeom = buildResizedGeometry(rect, handleIndex, mouse);
        if (typeof onResizeRect === 'function') onResizeRect(rect.id, newGeom);
      } catch (_) {}
    };
    const onUp = (e) => { e && e.preventDefault && e.preventDefault(); setDragging(null); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, buildResizedGeometry, onResizeRect]);

  if (!rects.length) return null;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1500 }}>
      <svg className="w-full h-full">
        <defs>
          {rects.map((r) => (
            <pattern
              key={`pat-${r.id}`}
              id={`pat-${r.id}`}
              patternUnits="userSpaceOnUse"
              width={r.type?.texture?.size || 32}
              height={r.type?.texture?.size || 32}
              // Rotate the pattern around the rectangle center to respect object rotation
              patternTransform={(() => {
                try {
                  const rot = Number(r?.obj?.properties?.rotationDeg || 0);
                  if (!rot) return undefined;
                  const cx = (r.points[0].x + r.points[2].x) / 2;
                  const cy = (r.points[0].y + r.points[2].y) / 2;
                  return `rotate(${rot} ${cx} ${cy})`;
                } catch (_) {
                  return undefined;
                }
              })()}
            >
              {r.type?.texture?.url ? (
                <image
                  xlinkHref={r.type.texture.url}
                  x="0"
                  y="0"
                  width={r.type.texture.size || 32}
                  height={r.type.texture.size || 32}
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : null}
            </pattern>
          ))}
        </defs>
        {rects.map(({ id, type, obj, points }) => {
          const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
          const dims = obj?.properties?.dimensions || obj?.properties?.user_dimensions_m;
          const label = (() => {
            try {
              const wM = dims?.width || 0;
              const hM = dims?.height || 0;
              if (type.units === 'ft') {
                const wFt = Math.round(wM * 3.28084);
                const hFt = Math.round(hM * 3.28084);
                return `${type.name} ${wFt} ft × ${hFt} ft`;
              }
              return `${type.name} ${wM.toFixed(1)} m × ${hM.toFixed(1)} m`;
            } catch (_) {
              return type.name;
            }
          })();
          const cx = (points[0].x + points[2].x) / 2;
          const cy = (points[0].y + points[2].y) / 2;
          const fillId = `url(#pat-${id})`;
          const isSelected = selectedId && id === selectedId;
          const selected = selectedId && id === selectedId;
          return (
            <g key={id}>
              <path
                d={d}
                fill={type?.texture?.url ? fillId : 'rgba(16,185,129,0.15)'}
                stroke={selected ? '#2563eb' : '#111827'}
                strokeWidth={selected ? 3 : 2}
                opacity={0.95}
                style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); if (typeof onSelectRect === 'function') onSelectRect(id); }}
              />
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="#111827" stroke="#ffffff" strokeWidth="2" paintOrder="stroke">
                {label}
              </text>
              {selected && points.map((p, idx) => (
                <circle
                  key={`h-${id}-${idx}`}
                  cx={p.x}
                  cy={p.y}
                  r={6}
                  fill="#ffffff"
                  stroke="#2563eb"
                  strokeWidth={2}
                  style={{ pointerEvents: 'auto', cursor: 'nwse-resize' }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Mouse coords must be relative to map container for project/unproject consistency
                    const container = map && map.getContainer ? map.getContainer() : null;
                    const offset = container && container.getBoundingClientRect ? container.getBoundingClientRect() : { left: 0, top: 0 };
                    setDragging({ rect: { id, type, obj, points }, handleIndex: idx, offset });
                  }}
                />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default DroppedRectangles;


