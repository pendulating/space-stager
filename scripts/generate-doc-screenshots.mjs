#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'data', 'guides');

async function ensureDir(p) { await fs.promises.mkdir(p, { recursive: true }); }

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return;
    } catch (_) {
      // ignore and retry
    }
    await sleep(500);
  }
  throw new Error(`Preview server not reachable at ${url}`);
}

async function resolveBaseUrl() {
  const candidates = [];
  if (process.env.DOCS_PREVIEW_URL) candidates.push(process.env.DOCS_PREVIEW_URL);
  candidates.push('http://127.0.0.1:4173', 'http://localhost:4173');
  for (const url of candidates) {
    try {
      await waitForServer(url);
      return url;
    } catch {
      // try next
    }
  }
  throw new Error(`Could not find a reachable preview server. Tried: ${candidates.join(', ')}`);
}

async function run() {
  await ensureDir(OUT_DIR);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    // Determine a reachable preview base URL and wait for readiness
    const base = await resolveBaseUrl();

    // Map basics
    await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
    try {
      await page.waitForSelector('canvas.maplibregl-canvas, .maplibregl-canvas', { timeout: 15000 });
    } catch {}
    // Dismiss tutorial overlays if present to show full UI
    try {
      const skipNow = await page.$('text=Skip for Now');
      if (skipNow) {
        await skipNow.click({ timeout: 2000 });
        await page.waitForTimeout(300);
      }
      const skipTutorial = await page.$('text=Skip tutorial');
      if (skipTutorial) {
        await skipTutorial.click({ timeout: 2000 });
        await page.waitForTimeout(300);
      }
      // If geography selector is open, choose Parks and continue so full UI is visible
      const geoModalOpen = await page.$('text=Choose your geography');
      if (geoModalOpen) {
        const parksCard = await page.$('text=Parks Permit Areas');
        if (parksCard) {
          await parksCard.click({ timeout: 2000 });
          await page.waitForTimeout(200);
          const continueBtn = await page.$('text=Continue');
          if (continueBtn) {
            await continueBtn.click({ timeout: 2000 });
            // Wait for permit areas GeoJSON to load and render
            try {
              await Promise.race([
                page.waitForResponse((res) => res.url().includes('/data/permit-areas/') && res.ok(), { timeout: 16000 }),
                page.waitForTimeout(2500)
              ]);
            } catch {}
            // Wait for UI loading banner to disappear if present
            try { await page.waitForSelector('text=Loading zone geometry...', { state: 'detached', timeout: 12000 }); } catch {}
            await page.waitForTimeout(800);
          }
        }
      }
    } catch {}
    await page.screenshot({ path: path.join(OUT_DIR, 'map_basics.png') });

    // Permit Areas: dismiss tutorial and open Geography selector modal
    try {
      // Dismiss welcome overlay if present
      const skipNow = await page.$('text=Skip for Now');
      if (skipNow) {
        await skipNow.click({ timeout: 2000 });
        await page.waitForTimeout(300);
      }
      // Also dismiss tooltip-based tutorial if visible
      const skipTutorial = await page.$('text=Skip tutorial');
      if (skipTutorial) {
        await skipTutorial.click({ timeout: 2000 });
        await page.waitForTimeout(300);
      }
      // Open the Geography selector
      await page.click('text=Wrong mode selected? Click here to switch.', { timeout: 5000 });
      await page.waitForSelector('text=Choose your geography', { timeout: 5000 });
    } catch {}
    await page.screenshot({ path: path.join(OUT_DIR, 'permit_search.png') });

    // Parks zoom-in screenshot: search Father Duffy and wait for focus
    try {
      // Ensure geography modal is closed by choosing Parks and continuing if open
      const geoModalOpen2 = await page.$('text=Choose your geography');
      if (geoModalOpen2) {
        const parksCard2 = await page.$('text=Parks Permit Areas');
        if (parksCard2) {
          await parksCard2.click({ timeout: 2000 });
          await page.waitForTimeout(200);
          const continueBtn2 = await page.$('text=Continue');
          if (continueBtn2) {
            await continueBtn2.click({ timeout: 2000 });
          }
        }
      }
      // Wait for dataset to be ready
      try {
        await Promise.race([
          page.waitForResponse((res) => res.url().includes('/data/permit-areas/') && res.ok(), { timeout: 16000 }),
          page.waitForTimeout(2500)
        ]);
      } catch {}
      try { await page.waitForSelector('text=Loading zone geometry...', { state: 'detached', timeout: 12000 }); } catch {}
      await page.waitForTimeout(600);

      // Search for Father Duffy and click first result
      const searchInput2 = await page.$('input[placeholder*="Search" i], input[type="search"]');
      if (searchInput2) {
        await searchInput2.fill('Father Duffy');
        await page.waitForSelector('.search-results .search-result', { timeout: 10000 });
        // Listen for focus-ready event
        await page.evaluate(() => {
          try {
            window.__ssFocusReady = false;
            const handler = () => { window.__ssFocusReady = true; };
            window.addEventListener('permit:focus-ready', handler, { once: true });
          } catch (_) { window.__ssFocusReady = false; }
        });
        await page.click('.search-results .search-result');
        // Wait for focus ready or fallback to a move completion delay
        try {
          await page.waitForFunction(() => window.__ssFocusReady === true, { timeout: 15000 });
        } catch {}
        await page.waitForTimeout(1000);
      }
    } catch {}
    await page.screenshot({ path: path.join(OUT_DIR, 'parks_zoomin.png') });

    // Parks zoom-in with all recommended layers ON
    try {
      // Ensure the layers panel and All Recommended toggle are visible
      await page.waitForSelector('.layers-panel', { timeout: 12000 });
      await page.evaluate(() => { try { document.querySelector('.layers-panel')?.scrollIntoView({ block: 'start', behavior: 'instant' }); } catch (_) {} });
      await page.waitForSelector('.layers-panel :text("All Recommended")', { timeout: 12000 });
      // Close any modal that might have opened (e.g., Examples) via Escape
      try { await page.keyboard.press('Escape'); await page.waitForTimeout(200); } catch {}
      // Target the All Recommended toggle button inside the layers panel using its title attribute
      const arButton = page.locator('.layers-panel button[title*="all layers" i]').first();
      // If label shows OFF, click to turn ON
      try {
        const labelText = (await arButton.locator('span').last().textContent())?.trim() || '';
        if (labelText.toUpperCase() === 'OFF') {
          await arButton.click({ timeout: 3000 });
        }
      } catch {
        await arButton.click({ timeout: 3000 });
      }
      // Wait until all layer items finish loading (no "Loading…" badges)
      try {
        await page.waitForFunction(() => {
          const root = document.querySelector('.layers-panel');
          if (!root) return false;
          const spans = Array.from(root.querySelectorAll('span'));
          const anyLoading = spans.some((s) => (s.textContent || '').trim().startsWith('Loading'));
          return !anyLoading;
        }, { timeout: 45000 });
      } catch {}
      // Allow network to go idle and extra time for map to render canvases
      try { await page.waitForLoadState('networkidle', { timeout: 20000 }); } catch {}
      await page.waitForTimeout(3000);
    } catch {}
    await page.screenshot({ path: path.join(OUT_DIR, 'parks_zoomin_alllayers.png') });
  } catch (e) {
    console.error('Screenshot generation failed:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();


