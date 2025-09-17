#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const OUT_DIR = path.join(ROOT, 'docs-site', 'docs', 'api');

fs.mkdirSync(OUT_DIR, { recursive: true });

// Generate markdown from JSDoc using documentation.js
const outFile = path.join(OUT_DIR, 'js-api.md');
const args = [
  'build',
  'src/**/*.js',
  '-f', 'md',
  '--shallow',
  '-o', outFile,
];

const res = spawnSync('npx', ['-y', 'documentation', ...args], { stdio: 'inherit', shell: true });
if (res.status !== 0) {
  process.exit(res.status);
}

// Post-process to escape MDX-sensitive braces in table cells and text blocks
try {
  let s = fs.readFileSync(outFile, 'utf8');
  // Escape braces first
  s = s.replace(/\{\{/g, '{&#123;').replace(/\}\}/g, '&#125;}');
  s = s.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
  // Escape angle-bracket expressions outside of code fences to avoid MDX JSX parsing
  const lines = s.split(/\r?\n/);
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) {
      // Replace tokens like <Point>, <Object>, <Feature<Point>> etc
      lines[i] = line
        .replace(/<([A-Za-z][^>]*?)>/g, (m, inner) => `&lt;${inner}&gt;`);
    }
  }
  s = lines.join('\n');
  fs.writeFileSync(outFile, s);
} catch (e) {
  // best-effort escape
}

console.log('Generated JS API docs.');


