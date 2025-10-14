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

// Post-process to wrap inline code-like content in backticks for MDX
try {
  let s = fs.readFileSync(outFile, 'utf8');
  
  // Global replacements (order matters!)
  
  // 1. Fix **[Type][num]<[InnerType][num]>** patterns (markdown links with generics)
  s = s.replace(/\*\*\[([^\]]+)\]\[(\d+)\]<([^>]+)>\*\*/g, (match, type1, link1, innerContent) => {
    return `\`[${type1}][${link1}]<${innerContent}>\``;
  });
  
  // 2. Fix inline generic type references in regular text (e.g., Feature<Point>)
  //    Do this line by line to avoid code blocks
  const lines = s.split(/\r?\n/);
  let inFence = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Track code fences
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    
    if (!inFence) {
      // List items with inline type signatures containing braces/brackets
      if (/^\s*\*\s+\w+:/.test(line)) {
        lines[i] = line.replace(/:\s+(.+)$/, (match, content) => {
          if (/[{}\[\]<>]/.test(content) && !content.trim().startsWith('`')) {
            return `: \`${content.replace(/`/g, '\\`')}\``;
          }
          return match;
        });
      }
      
      // Standalone lines with type signatures
      if (/^\w+:\s+[{<\[]/.test(line) && !line.includes('`')) {
        lines[i] = line.replace(/^(\w+):\s+(.+)$/, (match, name, content) => {
          return `${name}: \`${content.replace(/`/g, '\\`')}\``;
        });
      }
      
      // Inline Type<Generic> references in descriptions
      if (line.includes('<') && line.includes('>') && !line.includes('`')) {
        lines[i] = line.replace(/\b([A-Z]\w+)<([A-Z]\w+)>/g, (match, outerType, innerType) => {
          return `\`${outerType}<${innerType}>\``;
        });
      }
      
      // Object literals in descriptions (e.g., { zoom, bearing, pitch })
      // Only match simple object literals with just property names (no colons, no nested structures)
      // Skip lines that already have backticks or are list items
      if (line.includes('{') && line.includes('}') && !line.startsWith('*   ') && !line.includes('`') && !line.includes(':')) {
        lines[i] = line.replace(/\{([^}]+)\}/g, (match, content) => {
          // Only replace if it's a simple comma-separated list of identifiers
          if (/^[\w\s,]+$/.test(content.trim())) {
            return `\`{${content}}\``;
          }
          return match;
        });
      }
      
      // Path templates in list items (e.g., /static/{base}/{file}.png)
      // Match paths with {placeholder} syntax
      if (line.startsWith('*   ') && line.includes('{') && line.includes('}') && line.includes('/')) {
        // Wrap path segments with curly braces in backticks
        lines[i] = line.replace(/(\([^\)]*\{[^)]+\))/g, (match) => {
          // If the whole path isn't already in backticks, wrap it
          if (!match.includes('`')) {
            // Extract the content between parentheses
            const pathContent = match.slice(1, -1); // Remove ( and )
            return `(\`${pathContent}\`)`;
          }
          return match;
        });
      }

      // Final fallback: if a line still has unformatted curly braces and no backticks,
      // replace braces with HTML entities to avoid MDX expression parsing errors.
      if (line.includes('{') && line.includes('}') && !line.includes('`')) {
        lines[i] = line.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
      }

      // Additionally, escape braces inside inline code spans to be extra-safe for MDX
      // e.g., handlers: `{ [eventName: string]: Function | { handler: Function } }`
      // becomes handlers: ``{ [eventName: string]: Function | &#123; handler: Function &#125; }``
      lines[i] = lines[i].replace(/`([^`]+)`/g, (match, inner) => {
        const escaped = inner.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
        return '`' + escaped + '`';
      });
    }
  }
  
  s = lines.join('\n');
  fs.writeFileSync(outFile, s);
  console.log('Post-processed JS API docs for MDX compatibility.');
} catch (e) {
  console.warn('Warning: Could not post-process JS API docs:', e.message);
  console.error(e);
}

console.log('Generated JS API docs.');


