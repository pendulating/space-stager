const { test, expect } = require('@playwright/test');

test('permit areas overlap selector appears and can select', async ({ page }) => {
  // Route the permit areas source to our small fixture
  await page.route(/\/data\/permit-areas\/.*\.geojson$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      path: 'public/test-data/permit-areas-fixture.geojson'
    });
  });

  await page.goto('/?testHarness=1');
  await page.waitForFunction(() => !!window.__app && !!window.__app.map);
  await page.evaluate(() => window.__app.waitForIdle());

  // Click the center-ish point to overlap
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('Map canvas not found');
  const clickX = Math.floor(box.x + box.width / 2);
  const clickY = Math.floor(box.y + box.height / 2);
  await page.mouse.click(clickX, clickY);

  // Expect the overlap selector heading
  await expect(page.getByText('Multiple Areas Found')).toBeVisible();

  // Select the first area in the list
  const firstOption = page.locator('.min-w-80 .text-sm.font-medium').first();
  await firstOption.click();

  // Selector closes
  await expect(page.getByText('Multiple Areas Found')).toHaveCount(0);
});


