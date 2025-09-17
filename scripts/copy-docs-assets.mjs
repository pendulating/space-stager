#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const STATIC_DIR = path.join(ROOT, 'docs-site', 'static');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function safeCopyFile(src, dest) {
  try {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    console.log(`Copied ${src} -> ${dest}`);
  } catch (e) {
    console.warn(`Skip copy (not found): ${src}`);
  }
}

function safeCopyDir(src, dest) {
  try {
    if (!fs.existsSync(src)) {
      console.warn(`Skip copy dir (not found): ${src}`);
      return;
    }
    ensureDir(dest);
    // Node 16+: fs.cp supports recursive
    fs.cpSync(src, dest, { recursive: true });
    console.log(`Copied dir ${src} -> ${dest}`);
  } catch (e) {
    console.warn(`Skip copy dir (failed): ${src}`);
  }
}

function main() {
  ensureDir(STATIC_DIR);
  // dependency graph svg
  safeCopyFile(path.join(ROOT, 'dependency-graph.svg'), path.join(STATIC_DIR, 'dependency-graph.svg'));
  // coverage lcov-report (if present)
  safeCopyDir(path.join(ROOT, 'coverage', 'lcov-report'), path.join(STATIC_DIR, 'coverage', 'lcov-report'));
  // SAPO walkthrough gif
  safeCopyFile(path.join(ROOT, 'public', 'data', 'guides', 'sapo_walkthrough_15fps.gif'), path.join(STATIC_DIR, 'sapo_walkthrough_15fps.gif'));
  // Screenshots (add your own files to /public/data/guides)
  safeCopyFile(path.join(ROOT, 'public', 'data', 'guides', 'map_basics.png'), path.join(STATIC_DIR, 'screens', 'map_basics.png'));
  safeCopyFile(path.join(ROOT, 'public', 'data', 'guides', 'permit_search.png'), path.join(STATIC_DIR, 'screens', 'permit_search.png'));
  safeCopyFile(path.join(ROOT, 'public', 'data', 'guides', 'parks_zoomin.png'), path.join(STATIC_DIR, 'screens', 'parks_zoomin.png'));
  safeCopyFile(path.join(ROOT, 'public', 'data', 'guides', 'parks_zoomin_alllayers.png'), path.join(STATIC_DIR, 'screens', 'parks_zoomin_alllayers.png'));
}

main();


