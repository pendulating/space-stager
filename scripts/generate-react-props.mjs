#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const INPUT = path.join(ROOT, 'documentation.json');
const OUT_DIR = path.join(ROOT, 'docs-site', 'docs', 'api');
const OUT_FILE = path.join(OUT_DIR, 'components.md');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function escapePipe(str = '') {
  return String(str).replace(/\|/g, '\\|');
}

function wrapInCodeIfNeeded(str = '') {
  const s = String(str).trim();
  if (!s) return '';
  
  // For multiline values or very long values, use a placeholder
  if (s.includes('\n') || s.length > 200) {
    return '`[complex value]`';
  }
  
  // Wrap in backticks to prevent MDX from parsing as JSX
  // Escape any backticks inside the string
  const escaped = s.replace(/`/g, '\\`');
  
  // Double-check: if the result still contains unescaped braces at the start, 
  // it might cause MDX issues. Ensure proper escaping.
  return `\`${escaped}\``;
}

function renderPropsTable(propsObj) {
  const entries = Object.entries(propsObj || {});
  if (!entries.length) return '\n_No props_\n';
  const headers = ['Name', 'Required', 'Default', 'Type'];
  const sep = headers.map(() => '---').join(' | ');
  const rows = entries.map(([name, meta]) => {
    const required = meta?.required ? 'Yes' : 'No';
    const defVal = meta?.defaultValue?.value ?? '';
    const typeVal = meta?.type?.name ?? meta?.flowType?.name ?? '';
    // Only wrap non-empty values in backticks
    const def = defVal ? wrapInCodeIfNeeded(defVal) : '';
    const type = typeVal ? wrapInCodeIfNeeded(typeVal) : '';
    return `${escapePipe(name)} | ${required} | ${def} | ${type}`;
  });
  return `\n${headers.join(' | ')}\n${sep}\n${rows.join('\n')}\n`;
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.warn(`Missing ${INPUT}. Generating via react-docgen...`);
    // @react-docgen/cli v1+: path is a glob; --extensions removed; use -o/--pretty
    const glob = 'src/components/**/*.{jsx,js}';
    let res = spawnSync('pnpm', ['exec', 'react-docgen', glob, '--pretty', '-o', 'documentation.json'], { stdio: 'inherit' });
    if (res.status !== 0) {
      res = spawnSync('npx', ['-y', '@react-docgen/cli', glob, '--pretty', '-o', 'documentation.json'], { stdio: 'inherit', shell: true });
    }
    if (!fs.existsSync(INPUT)) {
      console.error(`Failed to generate ${INPUT}.`);
      process.exit(1);
    }
  }
  const raw = fs.readFileSync(INPUT, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse documentation.json');
    throw e;
  }
  ensureDir(OUT_DIR);
  const lines = [];
  lines.push('---');
  lines.push('title: React Components Reference');
  lines.push('sidebar_position: 1');
  lines.push('---');
  lines.push('');
  lines.push('Component prop reference generated from source via react-docgen.');
  lines.push('');

  const files = Object.keys(data).sort();
  for (const file of files) {
    const components = data[file] || [];
    if (!components.length) continue;
    lines.push(`## ${file}`);
    lines.push('');
    for (const comp of components) {
      const name = comp.displayName || path.basename(file);
      lines.push(`### ${name}`);
      lines.push('');
      if (comp.description) {
        lines.push(comp.description);
        lines.push('');
      }
      lines.push(renderPropsTable(comp.props));
      lines.push('');
    }
  }

  fs.writeFileSync(OUT_FILE, lines.join('\n'));
  console.log(`Wrote ${OUT_FILE}`);
}

main();


