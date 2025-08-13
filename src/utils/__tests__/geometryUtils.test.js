import { describe, it, expect } from 'vitest';
import { calculateGeometryBounds, expandBounds, getAreaDisplayName, getAreaDescription } from '../geometryUtils';

describe('geometryUtils', () => {
	it('calculateGeometryBounds returns null for invalid geometry', () => {
		expect(calculateGeometryBounds(null)).toBeNull();
		expect(calculateGeometryBounds({})).toBeNull();
	});

	it('calculateGeometryBounds handles Polygon', () => {
		const poly = { type: 'Polygon', coordinates: [[[0,0],[2,1],[1,3],[0,0]]] };
		expect(calculateGeometryBounds(poly)).toEqual([[0,0],[2,3]]);
	});

	it('calculateGeometryBounds handles MultiPolygon', () => {
		const mpoly = { type: 'MultiPolygon', coordinates: [
			[[[0,0],[2,1],[0,0]]],
			[[[5,5],[6,8],[5,5]]]
		] };
		expect(calculateGeometryBounds(mpoly)).toEqual([[0,0],[6,8]]);
	});

	it('expandBounds expands by factor', () => {
		const b = [[0,0],[1,1]];
		expect(expandBounds(b, 0.1)).toEqual([[-0.1,-0.1],[1.1,1.1]]);
	});

	it('area display/description helpers', () => {
		expect(getAreaDisplayName(null)).toBe('Unnamed Area');
		expect(getAreaDisplayName({ properties: { name: 'Park' } })).toBe('Park');
		expect(getAreaDescription(null)).toBe('');
		const area = { properties: { propertyname: 'Main', subpropertyname: 'North' } };
		expect(getAreaDescription(area)).toBe('Main › North');
	});
});

