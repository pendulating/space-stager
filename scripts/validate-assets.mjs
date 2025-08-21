#!/usr/bin/env node
// Asset validation: verifies that imageUrl references and enhanced sprite variants exist under public/
// Scans src/constants/placeableObjects.js and src/constants/layers.js via regex to avoid bundling/ESM issues.

import { readFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(path.join(path.dirname(new URL(import.meta.url).pathname), '..'));
const srcConstantsDir = path.join(projectRoot, 'src', 'constants');
const publicRoot = path.join(projectRoot, 'public');

/**
 * Reads a file as UTF-8 text.
 * @param {string} absPath
 */
async function readText(absPath) {
  return await readFile(absPath, 'utf8');
}

/**
 * Parses imageUrl references from placeableObjects.js
 * @param {string} fileText
 * @returns {string[]} urls
 */
function parseImageUrls(fileText) {
  const urls = [];
  const re = /imageUrl:\s*['"]([^'"\n]+)['"]/g;
  let m;
  while ((m = re.exec(fileText)) !== null) {
    urls.push(m[1]);
  }
  return urls;
}

/**
 * Parses enhancedRendering blocks with spriteBase/publicDir/angles
 * Works for both placeableObjects.js and layers.js
 * @param {string} fileText
 * @returns {Array<{spriteBase:string, publicDir:string, angles:number[]}>}
 */
function parseEnhancedBlocks(fileText) {
  const results = [];
  const blockRe = /enhancedRendering:\s*\{[\s\S]*?spriteBase:\s*['"]([^'"\n]+)['"][\s\S]*?publicDir:\s*['"]([^'"\n]+)['"][\s\S]*?angles:\s*\[([^\]]+)\][\s\S]*?\}/g;
  let m;
  while ((m = blockRe.exec(fileText)) !== null) {
    const spriteBase = m[1];
    const publicDir = m[2];
    const anglesRaw = m[3];
    const angles = anglesRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n));
    results.push({ spriteBase, publicDir, angles });
  }
  return results;
}

/**
 * Ensures a file exists and is non-empty.
 * @param {string} absPath
 * @returns {{ok:boolean, message?:string}}
 */
function validateFile(absPath) {
  try {
    const st = statSync(absPath);
    if (!st.isFile()) return { ok: false, message: 'not a regular file' };
    if (st.size <= 0) return { ok: false, message: 'empty file' };
    return { ok: true };
  } catch (err) {
    return { ok: false, message: (/** @type {Error} */(err)).message };
  }
}

function urlToFsPath(urlPath) {
  const clean = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
  return path.join(publicRoot, clean);
}

function angleToSuffix(angle) {
  const fixed = Math.round(angle);
  return String(fixed).padStart(3, '0');
}

async function main() {
  const failures = [];
  const checks = [];

  const placeablePath = path.join(srcConstantsDir, 'placeableObjects.js');
  const layersPath = path.join(srcConstantsDir, 'layers.js');

  const [placeableText, layersText] = await Promise.all([
    readText(placeablePath),
    readText(layersPath)
  ]);

  // 1) Direct imageUrl references in PLACEABLE_OBJECTS
  const imageUrls = parseImageUrls(placeableText);
  for (const url of imageUrls) {
    const fsPath = urlToFsPath(url);
    const res = validateFile(fsPath);
    checks.push({ kind: 'imageUrl', url, fsPath, ok: res.ok, message: res.message });
    if (!res.ok) failures.push({ kind: 'imageUrl', url, fsPath, message: res.message });
  }

  // 2) Enhanced sprite blocks (from both files)
  const blocks = [...parseEnhancedBlocks(placeableText), ...parseEnhancedBlocks(layersText)];
  for (const b of blocks) {
    for (const angle of b.angles) {
      const fileName = `${b.spriteBase}_${angleToSuffix(angle)}.png`;
      const rel = path.join(b.publicDir.replace(/^\//, ''), fileName);
      const fsPath = path.join(publicRoot, rel.replace(/^\//, ''));
      const res = validateFile(fsPath);
      checks.push({ kind: 'sprite', spriteBase: b.spriteBase, angle, fsPath, ok: res.ok, message: res.message });
      if (!res.ok) failures.push({ kind: 'sprite', spriteBase: b.spriteBase, angle, fsPath, message: res.message });
    }
  }

  // Summary output
  const total = checks.length;
  const failed = failures.length;
  const passed = total - failed;

  if (failed > 0) {
    console.error(`\nAsset validation FAILED (${failed}/${total} missing or invalid):`);
    for (const f of failures) {
      if (f.kind === 'imageUrl') {
        console.error(` - imageUrl missing: ${f.fsPath} (from ${f.url}) :: ${f.message}`);
      } else {
        console.error(` - sprite missing: ${f.fsPath} (${f.spriteBase} @ angle=${/** @type {any} */(f).angle}) :: ${f.message}`);
      }
    }
    process.exitCode = 1;
  } else {
    console.log(`\nAsset validation PASSED (${passed}/${total})`);
  }
}

main().catch((err) => {
  console.error('Asset validation crashed:', err);
  process.exit(1);
});


