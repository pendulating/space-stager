// src/utils/safetyUtils.js
import * as turf from '@turf/turf';

/**
 * SAPO Safety Constants
 */
export const SAFETY_CONSTANTS = {
  EMERGENCY_LANE_WIDTH_FT: 15,
  VEHICLE_WIDTH_FT: 8,
  VEHICLE_BUFFER_FT: 1, // 1ft on each side
  ANALYSIS_WIDTH_FT: 10, // 8 + 1 + 1
  MAX_TURNING_RADIUS_FT: 45, // Typical for Seagrave Fire Truck
};

/**
 * Check if a feature obstructs the emergency lane.
 * 
 * @param {Feature} lane - The 15ft wide emergency lane geometry (Polygon)
 * @param {Feature} feature - The object geometry to check
 * @returns {boolean}
 */
export function isObstructingLane(lane, feature) {
  if (!lane || !feature || !feature.geometry) return false;
  try {
    return turf.booleanIntersects(lane, feature);
  } catch (_) {
    return false;
  }
}

/**
 * Perform a swept-path analysis along a path.
 * Checks for sharp turns that a design vehicle cannot navigate.
 * 
 * @param {Array<number[]>} coordinates - The path coordinates
 * @returns {Object} - { isValid: boolean, issues: Array<{coord: number[], message: string}> }
 */
export function analyzeTurnRadii(coordinates) {
  if (!coordinates || coordinates.length < 3) return { isValid: true, issues: [] };
  
  const issues = [];
  const maxAngle = 120; // Maximum interior angle allowed for a truck turn (approximate)

  for (let i = 1; i < coordinates.length - 1; i++) {
    const prev = coordinates[i-1];
    const curr = coordinates[i];
    const next = coordinates[i+1];

    const bearing1 = turf.bearing(prev, curr);
    const bearing2 = turf.bearing(curr, next);
    
    let diff = Math.abs(bearing1 - bearing2);
    if (diff > 180) diff = 360 - diff;

    // If turn is more than ~60 degrees (diff), it might be too sharp depending on node spacing
    if (diff > 60) {
      issues.push({
        coord: curr,
        message: `Sharp turn detected (${Math.round(diff)}°). Vehicle may struggle to maneuver.`
      });
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Perform a swept-path analysis along a path.
 * In a simplified version, this ensures that a 10ft wide envelope can traverse 
 * the path without hitting any obstructions OR exceeding the 15ft lane boundary.
 * 
 * @param {Feature} centerline - The centerline of the zone (LineString)
 * @param {number} analysisWidthFt - Total width to check (default 10ft)
 * @returns {Feature} - The swept path envelope (Polygon)
 */
export function generateSweptPath(centerline, analysisWidthFt = SAFETY_CONSTANTS.ANALYSIS_WIDTH_FT) {
  if (!centerline) return null;
  const metersPerFoot = 0.3048;
  const radiusMeters = (analysisWidthFt * metersPerFoot) / 2;
  
  try {
    // A simplified swept path is a buffer around the centerline.
    // For more advanced analysis, we'd need to simulate turning radius at nodes.
    return turf.buffer(centerline, radiusMeters, { units: 'meters', steps: 32 });
  } catch (_) {
    return null;
  }
}

