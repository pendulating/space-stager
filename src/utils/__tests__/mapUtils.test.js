import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getMetersPerPixel, getSafeFilename } from '../mapUtils';

describe('mapUtils', () => {
	let map;
	beforeEach(() => {
		map = {
			getZoom: vi.fn(() => 16),
			getCenter: vi.fn(() => ({ lat: 40 }))
		};
	});

	it('getMetersPerPixel returns numeric value', () => {
		const mpp = getMetersPerPixel(map);
		expect(typeof mpp).toBe('number');
		expect(mpp).toBeGreaterThan(0);
	});

	it('getSafeFilename normalizes and appends date', () => {
		const out = getSafeFilename('My Area!');
		expect(out.startsWith('my-area-')).toBe(true);
	});
});

