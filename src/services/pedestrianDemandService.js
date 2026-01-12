// src/services/pedestrianDemandService.js
import * as turf from '@turf/turf';
import { INFRASTRUCTURE_ENDPOINTS } from '../constants/endpoints';

/**
 * Fetch and analyze pedestrian demand for a set of coordinates.
 * @param {Array<Array<number>>} coords - Array of [lng, lat] coordinates.
 * @returns {Promise<{category: string, rank: number, clearPathFt: number}>}
 */
export async function autoDetectPedestrianDemand(coords) {
  if (!coords || coords.length < 2) return null;

  try {
    const line = turf.lineString(coords);
    const bbox = turf.bbox(line);
    
    // Construct Socrata query for the PMP Pedestrian Demand Map
    // We want segments that intersect our zone's bounding box
    const endpoint = INFRASTRUCTURE_ENDPOINTS.pedestrianDemand;
    const url = new URL(endpoint.baseUrl);
    
    // Simple bbox filter for Socrata (within_box)
    // Socrata's within_box(field, n, w, s, e)
    const [w, s, e, n] = bbox;
    url.searchParams.set('$where', `within_box(${endpoint.geoField}, ${n}, ${w}, ${s}, ${e})`);
    url.searchParams.set('$limit', '50');

    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch pedestrian demand data');
    
    const data = await response.json();
    if (!data.features || data.features.length === 0) return null;

    // Find the highest demand segment (lowest rank number)
    let topSegment = null;
    let minRank = 999;

    data.features.forEach(f => {
      const rank = parseInt(f.properties?.rank);
      if (!isNaN(rank) && rank < minRank) {
        minRank = rank;
        topSegment = f.properties;
      }
    });

    if (!topSegment) return null;

    // Map rank/category to clear path requirements
    // Based on user rules: Global (12-15), Regional (10-12), Neighborhood/Community (5-8)
    let clearPathFt = 5;
    const category = (topSegment.category || '').toLowerCase();
    
    if (category.includes('global') || minRank === 1) {
      clearPathFt = 12;
    } else if (category.includes('regional') || minRank === 2) {
      clearPathFt = 10;
    } else if (category.includes('neighborhood') || category.includes('community') || minRank <= 4) {
      // User said Neighborhood/Community is 5-8ft. We'll default to 5ft as the minimum, 
      // but maybe 8ft if it's "Neighborhood" rank 3?
      clearPathFt = minRank === 3 ? 8 : 5;
    }

    return {
      category: topSegment.category,
      rank: minRank,
      clearPathFt
    };
  } catch (err) {
    console.warn('Error auto-detecting pedestrian demand:', err);
    return null;
  }
}

