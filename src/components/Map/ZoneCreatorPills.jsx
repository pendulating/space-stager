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

    const container = map.getContainer ? map.getContainer() : null;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const centerPoint = map.project(map.getCenter());
    const padding = 64; // Padding from edge for pills to avoid overlap with other UI

    const newPositions = availableExtensions.map(ext => {
      try {
        if (!ext || !ext.coord) return null;
        const projected = map.project(ext.coord);
        
        // Edge clamping logic to provide "edge markers" for off-screen extensions
        const dx = projected.x - centerPoint.x;
        const dy = projected.y - centerPoint.y;
        
        const halfWidth = width / 2 - padding;
        const halfHeight = height / 2 - padding;
        
        const scale = Math.max(
          Math.abs(dx) / (halfWidth || 1),
          Math.abs(dy) / (halfHeight || 1)
        );
        
        const isOffScreen = projected.x < padding || projected.y < padding || projected.x > width - padding || projected.y > height - padding;
        
        let x, y;
        if (isOffScreen) {
          x = centerPoint.x + dx / scale;
          y = centerPoint.y + dy / scale;
        } else {
          x = projected.x;
          y = projected.y;
        }

        // Calculate rotation for an optional arrow pointing toward the actual intersection
        const angleToFeature = Math.atan2(projected.y - y, projected.x - x);
        const arrowRotation = (angleToFeature * 180) / Math.PI + 90;

        return {
          ...ext,
          x,
          y,
          isOffScreen,
          arrowRotation
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
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto transition-all duration-200 animate-in fade-in fill-mode-both"
          style={{ left: pos.x, top: pos.y }}
        >
          {pos.isOffScreen && (
            <div 
              className="absolute left-1/2 top-1/2 -z-10 text-blue-600/60"
              style={{ 
                transform: `translate(-50%, -50%) rotate(${pos.arrowRotation}deg) translateY(-28px)` 
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 0l4 8H2z" />
              </svg>
            </div>
          )}
          <button
            onClick={() => addNode(pos.id, pos.coord, pos.properties)}
            className={`flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-full shadow-lg border-2 border-white transition-all hover:scale-105 active:scale-95 whitespace-nowrap ${pos.isOffScreen ? 'opacity-90 scale-95' : ''}`}
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

