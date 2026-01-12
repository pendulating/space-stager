// src/hooks/useSafetyCompliance.js
import { useState, useEffect, useMemo } from 'react';
import { useZoneCreatorContext } from '../contexts/ZoneCreatorContext';
import { isObstructingLane } from '../utils/safetyUtils';
import * as turf from '@turf/turf';

export function useSafetyCompliance(drawInstance, droppedObjects = [], customShapes = []) {
  const { emergencyLaneGeometry } = useZoneCreatorContext();
  const [obstructions, setObstructions] = useState([]);
  
  // Compliance logic
  useEffect(() => {
    if (!emergencyLaneGeometry) {
      setObstructions([]);
      return;
    }

    const currentObstructions = [];

    // 1. Check dropped objects
    droppedObjects.forEach(obj => {
      let feature;
      if (obj.geometry) {
        feature = { type: 'Feature', geometry: obj.geometry, properties: obj.properties };
      } else if (obj.position) {
        // Point object: treat as a small circle/buffer for collision
        const point = turf.point([obj.position.lng, obj.position.lat]);
        // Estimate size from pixels to meters (approximate)
        const sizeMeters = 1.0; 
        feature = turf.buffer(point, sizeMeters, { units: 'meters' });
      }

      if (feature && isObstructingLane(emergencyLaneGeometry, feature)) {
        currentObstructions.push({ id: obj.id, type: 'object', name: obj.name });
      }
    });

    // 2. Check custom shapes from Draw (passed as prop)
    (customShapes || []).forEach(f => {
      // Skip metadata/internal features
      if (f.properties?.meta) return;
      
      if (isObstructingLane(emergencyLaneGeometry, f)) {
        currentObstructions.push({ id: f.id, type: 'shape', name: f.properties?.label || 'Custom Shape' });
      }
    });

    setObstructions(prev => {
      if (prev.length !== currentObstructions.length) return currentObstructions;
      const isSame = prev.every((o, i) => o.id === currentObstructions[i].id && o.type === currentObstructions[i].type);
      return isSame ? prev : currentObstructions;
    });
  }, [emergencyLaneGeometry, droppedObjects, customShapes, drawInstance]);

  const isComplianceValid = obstructions.length === 0;

  return useMemo(() => ({
    obstructions,
    isComplianceValid
  }), [obstructions, isComplianceValid]);
}

