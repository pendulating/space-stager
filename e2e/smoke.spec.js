// Basic smoke test using harness helpers
const { test, expect } = require('@playwright/test');

test('app loads and map initializes (harness)', async ({ page }) => {
	await page.goto('/?testHarness=1');

	// Fail on console error
	page.on('console', msg => {
		if (msg.type() === 'error') throw new Error(`Console error: ${msg.text()}`);
	});

	await page.waitForFunction(() => !!window.__app && !!window.__app.map, null, { timeout: 30000 });
	await page.evaluate(() => window.__app.waitForIdle());

	const vis = await page.evaluate(() => (window.__app.getLayerVisibility ? 'ok' : 'missing'));
	expect(vis).toBe('ok');
});


