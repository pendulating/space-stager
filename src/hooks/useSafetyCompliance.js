// src/hooks/useSafetyCompliance.js
import { useState, useEffect, useMemo } from 'react';
import { useZoneCreatorContext } from '../contexts/ZoneCreatorContext';
import { isObstructingLane, isObstructingPointClearance, analyzeSidewalkClearPath, isObstructingOpenStreet, SAFETY_CONSTANTS } from '../utils/safetyUtils';
import * as turf from '@turf/turf';

export function useSafetyCompliance(drawInstance, droppedObjects = [], customShapes = [], infrastructureData = {}, openStreetsData = null) {
  const { emergencyLaneGeometry, sidewalkClearPathFt } = useZoneCreatorContext();
  const [obstructions, setObstructions] = useState([]);
  
  // Compliance logic
  useEffect(() => {
    const currentObstructions = [];

    // Helper to check a feature against multiple potential obstructions
    const checkCompliance = (feature, name, id, type) => {
      // 1. Emergency Lane
      if (emergencyLaneGeometry && isObstructingLane(emergencyLaneGeometry, feature)) {
        currentObstructions.push({ id, type, name, violation: 'emergency-lane' });
      }

      // 2. Fire Hydrants (5ft clearance)
      const hydrants = infrastructureData?.hydrants?.features || [];
      hydrants.forEach(h => {
        if (isObstructingPointClearance(h, feature, SAFETY_CONSTANTS.HYDRANT_CLEARANCE_FT)) {
          currentObstructions.push({ id, type, name, violation: 'hydrant', infraId: h.id });
        }
      });

      // 3. Bike Lanes (8ft clear path)
      const bikeLanes = infrastructureData?.bikeLanes?.features || [];
      bikeLanes.forEach(bl => {
        if (turf.booleanIntersects(bl, feature)) {
          currentObstructions.push({ id, type, name, violation: 'bike-lane', infraId: bl.id });
        }
      });

      // 4. Transit Access (Subway Entrances & Bus Stops)
      const transitPoints = [
        ...(infrastructureData?.subwayEntrances?.features || []),
        ...(infrastructureData?.busStops?.features || [])
      ];
      transitPoints.forEach(tp => {
        // Use 10ft clearance for transit access as a baseline
        if (isObstructingPointClearance(tp, feature, 10)) {
          currentObstructions.push({ id, type, name, violation: 'transit-access', infraId: tp.id });
        }
      });

      // 5. Sidewalk Clear Path (PAR)
      const sidewalks = infrastructureData?.sidewalks?.features || [];
      sidewalks.forEach(sw => {
        const analysis = analyzeSidewalkClearPath(sw, feature, sidewalkClearPathFt || 5);
        if (analysis.isObstructed) {
          currentObstructions.push({ 
            id, 
            type, 
            name, 
            violation: 'sidewalk-clear-path', 
            infraId: sw.id,
            message: analysis.message 
          });
        }
      });

      // 6. Open Streets Activation (Non-bookable overlap)
      const openStreets = openStreetsData?.features || [];
      openStreets.forEach(os => {
        if (isObstructingOpenStreet(os, feature)) {
          currentObstructions.push({ 
            id, 
            type, 
            name, 
            violation: 'open-streets-overlap', 
            infraId: os.id,
            message: `Overlaps with Open Street: ${os.properties.appronstre}. Segment may be non-bookable.`
          });
        }
      });
    };

    // Evaluate Dropped Objects
    droppedObjects.forEach(obj => {
      let feature;
      if (obj.geometry) {
        feature = { type: 'Feature', geometry: obj.geometry, properties: obj.properties };
      } else if (obj.position) {
        const point = turf.point([obj.position.lng, obj.position.lat]);
        feature = turf.buffer(point, 1.0, { units: 'meters' });
      }
      if (feature) checkCompliance(feature, obj.name, obj.id, 'object');
    });

    // Evaluate Custom Shapes
    (customShapes || []).forEach(f => {
      if (f.properties?.meta) return;
      checkCompliance(f, f.properties?.label || 'Custom Shape', f.id, 'shape');
    });

    setObstructions(prev => {
      if (prev.length !== currentObstructions.length) return currentObstructions;
      const isSame = prev.every((o, i) => 
        o.id === currentObstructions[i].id && 
        o.type === currentObstructions[i].type &&
        o.violation === currentObstructions[i].violation
      );
      return isSame ? prev : currentObstructions;
    });
  }, [emergencyLaneGeometry, droppedObjects, customShapes, infrastructureData, openStreetsData, drawInstance]);

  const isComplianceValid = obstructions.length === 0;

  return useMemo(() => ({
    obstructions,
    isComplianceValid
  }), [obstructions, isComplianceValid]);
}

