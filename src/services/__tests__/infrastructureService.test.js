import { describe, it, expect } from 'vitest';
import { filterFeaturesByType } from '../infrastructureService';

describe('infrastructureService.filterFeaturesByType', () => {
	it('returns input when layer unrecognized', () => {
		const features = [{ properties: {} }];
		expect(filterFeaturesByType(features, 'unknown')).toEqual(features);
	});
});

