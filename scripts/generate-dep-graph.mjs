#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const OUT_SVG = path.join(ROOT, 'dependency-graph.svg');

function runDepcruiseDOT() {
  const args = ['--config', '.dependency-cruiser.js', '--include-only', '^src', '--output-type', 'dot', 'src'];
  const res = spawnSync(path.join(ROOT, 'node_modules/.bin/dependency-cruiser'), args, {
    encoding: 'utf8'
  });
  if (res.status !== 0) {
    console.error(res.stderr || 'dependency-cruiser failed');
    process.exit(res.status || 1);
  }
  return res.stdout;
}

function tryDot(dotSrc) {
  try {
    const res = spawnSync('dot', ['-Tsvg'], { input: dotSrc, encoding: 'utf8' });
    if (res.status === 0 && res.stdout && res.stdout.length > 0) return res.stdout;
    return null;
  } catch (_) {
    return null;
  }
}

async function tryViz(dotSrc) {
  try {
    const { renderString } = await import('@aduh95/viz.js');
    const svg = await renderString(dotSrc, { format: 'svg' });
    return svg;
  } catch (e) {
    console.warn('viz.js fallback failed:', e?.message);
    return null;
  }
}

async function main() {
  const dot = runDepcruiseDOT();
  let svg = tryDot(dot);
  if (!svg) {
    console.warn("Graphviz 'dot' not found or failed. Falling back to viz.js (WASM)...");
    svg = await tryViz(dot);
  }
  if (!svg) {
    console.warn('Unable to render dependency graph; writing DOT as comment-wrapped SVG placeholder.');
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="20"><text x="0" y="15" font-size="12">Dependency graph unavailable</text></svg>`;
  }
  fs.writeFileSync(OUT_SVG, svg);
  console.log(`Wrote ${OUT_SVG}`);
}

main();


