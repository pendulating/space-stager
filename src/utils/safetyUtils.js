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
  HYDRANT_CLEARANCE_FT: 5,
  BIKE_LANE_CLEARANCE_FT: 8,
  MIN_SIDEWALK_CLEAR_PATH_FT: 5,
  CORRIDOR_CLEARANCE: {
    GLOBAL: 12,
    REGIONAL: 10,
    NEIGHBORHOOD: 5
  },
  REVOCABLE_CONSENT_MIN_FT: 8
};

/**
 * Check if a feature obstructs a clear path on a sidewalk.
 * 
 * @param {Feature} sidewalkFeature - The sidewalk polygon
 * @param {Feature} objectFeature - The user-placed object
 * @param {number} requiredClearPathFt - Required clear path width in feet
 * @returns {Object} - { isObstructed: boolean, remainingWidthFt: number }
 */
export function analyzeSidewalkClearPath(sidewalkFeature, objectFeature, requiredClearPathFt) {
  if (!sidewalkFeature || !objectFeature || !objectFeature.geometry) return { isObstructed: false };
  
  try {
    // Basic intersection check first
    if (!turf.booleanIntersects(sidewalkFeature, objectFeature)) return { isObstructed: false };

    // In a full implementation, we would calculate the remaining width of the sidewalk
    // after subtracting the object's footprint. 
    // For now, we flag any intersection as a potential obstruction if it's on a sidewalk.
    return { 
      isObstructed: true,
      message: `Equipment on sidewalk may obstruct the required ${requiredClearPathFt}ft clear path.`
    };
  } catch (_) {
    return { isObstructed: false };
  }
}

/**
 * Check if a feature obstructs a buffer around a point (e.g. hydrant).
 * 
 * @param {Feature} pointFeature - The infrastructure point (e.g. hydrant)
 * @param {Feature} objectFeature - The user-placed object
 * @param {number} clearanceFt - Required clearance in feet
 * @returns {boolean}
 */
export function isObstructingPointClearance(pointFeature, objectFeature, clearanceFt) {
  if (!pointFeature || !objectFeature || !objectFeature.geometry) return false;
  const metersPerFoot = 0.3048;
  try {
    const buffer = turf.buffer(pointFeature, clearanceFt * metersPerFoot, { units: 'meters' });
    return turf.booleanIntersects(buffer, objectFeature);
  } catch (_) {
    return false;
  }
}

/**
 * Check if a feature obstructs a lane (e.g. bike lane).
 * 
 * @param {Feature} laneFeature - The infrastructure line/polygon (e.g. bike lane)
 * @param {Feature} objectFeature - The user-placed object
 * @param {number} requiredWidthFt - Required clear path width in feet
 * @returns {boolean}
 */
export function isObstructingLanePath(laneFeature, objectFeature, requiredWidthFt) {
  if (!laneFeature || !objectFeature || !objectFeature.geometry) return false;
  // For simplicity, we check if the object intersects the lane at all.
  // A more advanced check would ensure a remaining 8ft clear path.
  try {
    return turf.booleanIntersects(laneFeature, objectFeature);
  } catch (_) {
    return false;
  }
}

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

/**
 * Check if a feature obstructs an Open Street segment.
 * 
 * @param {Feature} openStreetFeature - The Open Street line segment
 * @param {Feature} objectFeature - The user-placed object
 * @returns {boolean}
 */
export function isObstructingOpenStreet(openStreetFeature, objectFeature) {
  if (!openStreetFeature || !objectFeature || !objectFeature.geometry) return false;
  try {
    return turf.booleanIntersects(openStreetFeature, objectFeature);
  } catch (_) {
    return false;
  }
}

