const { test, expect } = require('@playwright/test');

// 1x1 transparent PNG
const PNG_1x1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

test('basemap overlay switch adds and removes satellite overlay', async ({ page }) => {
  // Stub satellite tile requests
  await page.route(/https?:\/\/maps(\d+)?\.nyc\.gov\/xyz\/.*\.png(8)?/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'image/png' },
      body: Buffer.from(PNG_1x1_BASE64, 'base64')
    });
  });

  await page.goto('/?testHarness=1');
  await page.waitForFunction(() => !!window.__app && !!window.__app.map);
  await page.evaluate(() => window.__app.waitForIdle());

  // Click Satellite
  await page.getByRole('button', { name: 'Satellite' }).click();

  // Wait for overlay layer present
  await page.waitForFunction(() => {
    try { return !!window.__app.map.getLayer('nyc-satellite-layer'); } catch { return false; }
  });

  // Switch back to Carto
  await page.getByRole('button', { name: 'Carto' }).click();

  // Ensure overlay removed
  await page.waitForFunction(() => {
    try { return !window.__app.map.getLayer('nyc-satellite-layer'); } catch { return false; }
  });

  expect(true).toBe(true);
});


