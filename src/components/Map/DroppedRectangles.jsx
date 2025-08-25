import React, { useMemo } from 'react';

const DroppedRectangles = ({ objects = [], placeableObjects = [], map, objectUpdateTrigger, selectedId }) => {
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
  }, [objects, placeableObjects, map, objectUpdateTrigger]);

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
          return (
            <g key={id}>
              <path d={d} fill={type?.texture?.url ? fillId : 'rgba(16,185,129,0.15)'} stroke={isSelected ? '#2563eb' : '#111827'} strokeWidth={isSelected ? 3 : 2} opacity={0.95} />
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="#111827" stroke="#ffffff" strokeWidth="2" paintOrder="stroke">
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default DroppedRectangles;


