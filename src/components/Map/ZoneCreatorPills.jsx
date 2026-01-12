import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useZoneCreatorContext, WORKFLOW_STEPS } from '../../contexts/ZoneCreatorContext.jsx';
import { MapPin } from 'lucide-react';

const ZoneCreatorPills = ({ map }) => {
  const { workflowStep, availableExtensions, addNode } = useZoneCreatorContext();
  const [positions, setPositions] = useState([]);
  const frameRef = useRef(null);

  const updatePositions = useCallback(() => {
    if (!map || workflowStep !== WORKFLOW_STEPS.EXTEND_ZONE || !availableExtensions.length) {
      setPositions([]);
      return;
    }

    const newPositions = availableExtensions.map(ext => {
      try {
        if (!ext || !ext.coord) return null;
        const pos = map.project(ext.coord);
        // Basic off-screen check
        if (pos.x < -100 || pos.y < -100 || pos.x > window.innerWidth + 100 || pos.y > window.innerHeight + 100) return null;
        return {
          ...ext,
          x: pos.x,
          y: pos.y
        };
      } catch (_) {
        return null;
      }
    }).filter(Boolean);

    setPositions(newPositions);
  }, [map, workflowStep, availableExtensions]);

  useEffect(() => {
    if (!map) return;

    const onMove = () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(updatePositions);
    };

    map.on('move', onMove);
    map.on('zoom', onMove);
    map.on('resize', onMove);
    updatePositions();

    return () => {
      map.off('move', onMove);
      map.off('zoom', onMove);
      map.off('resize', onMove);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [map, updatePositions]);

  if (workflowStep !== WORKFLOW_STEPS.EXTEND_ZONE || !positions.length) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[60]">
      {positions.map((pos) => (
        <div
          key={pos.id}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto transition-opacity duration-200 animate-in fade-in fill-mode-both"
          style={{ left: pos.x, top: pos.y }}
        >
          <button
            onClick={() => addNode(pos.id, pos.coord, pos.properties)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-full shadow-lg border-2 border-white transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
          >
            <MapPin className="w-3 h-3 fill-current" />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {pos.streetName || 'Extend'}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
};

export default ZoneCreatorPills;

