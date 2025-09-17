#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const OUT_DIR = path.join(ROOT, 'docs-site', 'docs', 'reference');

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function readModule(file) {
  const full = path.join(ROOT, 'src', 'constants', file);
  return fs.readFileSync(full, 'utf8');
}

function mdEscape(s = '') {
  return String(s)
    .replace(/\|/g, '\\|')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}

function write(file, content) {
  ensureDir(OUT_DIR);
  fs.writeFileSync(path.join(OUT_DIR, file), content);
}

function extractObjectLiteral(code, exportName, context = undefined) {
  const re = new RegExp(`export\\s+const\\s+${exportName}\\s*=\\s*([\\s\\S]*?);\\s*$`, 'm');
  const m = code.match(re);
  if (!m) return null;
  // Use Function to eval as ESM-less: wrap in parentheses to get value
  try {
    // eslint-disable-next-line no-new-func
    if (context && typeof context === 'object') {
      // Provide referenced constants (e.g., GEOGRAPHY_ENDPOINTS) during evaluation
      return Function('context', `with (context) { return (${m[1]}) }`)(context);
    }
    return Function(`return (${m[1]})`)();
  } catch {
    return null;
  }
}

function generateEndpoints() {
  const code = readModule('endpoints.js');
  const infra = extractObjectLiteral(code, 'INFRASTRUCTURE_ENDPOINTS') || {};
  const geo = extractObjectLiteral(code, 'GEOGRAPHY_ENDPOINTS') || {};
  const exportEp = extractObjectLiteral(code, 'EXPORT_ENDPOINTS') || {};
  const lines = ['---','title: Endpoints','sidebar_position: 1','---','', '## Infrastructure Endpoints','', 'Name | URL | Local | Geo Field | Notes','--- | --- | --- | --- | ---'];
  for (const [k, v] of Object.entries(infra)) {
    lines.push(`${k} | ${mdEscape(v.baseUrl||'')} | ${v.isLocal? 'Yes':'No'} | ${mdEscape(v.geoField||'')} | ${mdEscape((v.selectFields? 'selectFields':'') || '')}`);
  }
  lines.push('', '## Geography Endpoints','', 'Name | URL','--- | ---');
  for (const [k, url] of Object.entries(geo)) lines.push(`${k} | ${mdEscape(url)}`);
  lines.push('', '## Export Endpoints','', 'Name | URL | Geo Field','--- | --- | ---');
  for (const [k, v] of Object.entries(exportEp)) lines.push(`${k} | ${mdEscape(v.baseUrl||'')} | ${mdEscape(v.geoField||'')}`);
  write('endpoints.md', lines.join('\n'));
}

function generateLayers() {
  const code = readModule('layers.js');
  const groups = extractObjectLiteral(code, 'LAYER_GROUPS') || {};
  const initial = extractObjectLiteral(code, 'INITIAL_LAYERS') || {};
  const disabledSet = (() => {
    const m = code.match(/export\s+const\s+DISABLED_INFRASTRUCTURE_LAYERS\s*=\s*new\s+Set\((\[[^\]]*\])\)/);
    if (!m) return [];
    try { return Function(`return (${m[1]})`)(); } catch { return []; }
  })();
  const lines = ['---','title: Layers','sidebar_position: 2','---','', '## Layer Groups','', 'Key | Name | Icon | Layers','--- | --- | --- | ---'];
  for (const [k, v] of Object.entries(groups)) lines.push(`${k} | ${mdEscape(v.name)} | ${mdEscape(v.icon)} | ${mdEscape((v.layers||[]).join(', '))}`);
  lines.push('', '## Initial Layers','', 'Id | Name | Visible | Color | Endpoint | Disabled | Enhanced');
  lines.push('--- | --- | --- | --- | --- | --- | ---');
  for (const [k, v] of Object.entries(initial)) {
    lines.push(`${k} | ${mdEscape(v.name||'')} | ${v.visible?'Yes':'No'} | ${mdEscape(v.color||'')} | ${mdEscape(v.endpoint||'')} | ${disabledSet.includes?.(k)?'Yes':(v.disabled?'Yes':'No')} | ${v.enhancedRendering?.enabled?'Yes':'No'}`);
  }
  write('layers.md', lines.join('\n'));
}

function generateGeographies() {
  const code = readModule('geographies.js');
  // Resolve GEOGRAPHY_ENDPOINTS to allow inline references inside GEOGRAPHIES
  const endpointsCode = readModule('endpoints.js');
  const geographyEndpoints = extractObjectLiteral(endpointsCode, 'GEOGRAPHY_ENDPOINTS') || {};
  const geos = extractObjectLiteral(code, 'GEOGRAPHIES', { GEOGRAPHY_ENDPOINTS: geographyEndpoints }) || {};
  const lines = ['---','title: Geographies','sidebar_position: 3','---','', 'Name | Type | Display Name | Search Keys | Focus Filter','--- | --- | --- | --- | ---'];
  for (const [k, v] of Object.entries(geos)) {
    const search = (v.searchKeys||[]).join(', ');
    const focus = v.focusFilter ? JSON.stringify(v.focusFilter) : '';
    lines.push(`${k} | ${mdEscape(v.type||'')} | ${mdEscape(v.displayName||'')} | ${mdEscape(search)} | ${mdEscape(focus)}`);
  }
  write('geographies.md', lines.join('\n'));
}

function generatePlaceable() {
  const code = readModule('placeableObjects.js');
  const arr = (()=>{ const m=code.match(/export\s+const\s+PLACEABLE_OBJECTS\s*=\s*(\[[\s\S]*?\])\s*;/); if(!m) return []; try { return Function(`return (${m[1]})`)(); } catch { return []; } })();
  const lines = ['---','title: Placeable Objects','sidebar_position: 4','---','', 'Id | Name | Category | Size (w×h) | Enhanced','--- | --- | --- | --- | ---'];
  for (const o of arr) {
    const size = o.size? `${o.size.width}×${o.size.height}`: '';
    const enhanced = o.enhancedRendering?.enabled ? 'Yes' : 'No';
    lines.push(`${o.id} | ${mdEscape(o.name)} | ${mdEscape(o.category)} | ${size} | ${enhanced}`);
  }
  write('placeable-objects.md', lines.join('\n'));
}

function generateMapConfig() {
  const code = readModule('mapConfig.js');
  const cfg = extractObjectLiteral(code, 'MAP_CONFIG') || {};
  const lines = ['---','title: Map Config','sidebar_position: 5','---','', 'Key | Value','--- | ---'];
  for (const [k, v] of Object.entries(cfg)) lines.push(`${k} | ${mdEscape(typeof v==='object'? JSON.stringify(v): String(v))}`);
  write('map-config.md', lines.join('\n'));
}

function main() {
  ensureDir(OUT_DIR);
  generateEndpoints();
  generateLayers();
  generateGeographies();
  generatePlaceable();
  generateMapConfig();
  console.log(`Wrote tables under ${OUT_DIR}`);
}

main();


