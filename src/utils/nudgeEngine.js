// src/utils/nudgeEngine.js
// Purpose: Evaluate contextual nudge rules against current map/app state.
// Linked files:
// - Consumes `src/constants/nudgeRules.js`
// - May use spatial index helpers from `src/utils/nudgeSpatialIndex.js`
// - May use text index helpers from `src/utils/nudgeTextIndex.js`
// - Optionally offload heavy work to `src/workers/nudgeWorker.js` via Comlink
// - Used by `src/hooks/useNudges.js`

// Implementation outline (no logic yet):
// - Public API: evaluateNudges(input) -> { nudges: Nudge[], perf: metrics }
// - Input: { map, droppedObjects, customShapes, infrastructureData, focusedArea, rules, options }
// - Apply best practices:
//   * Index Once, Query Often: build spatial indexes per layer once and update incrementally
//   * Debounce: caller/hook will debounce invocations
//   * Memoize: cache per-object results to avoid recomputation
//   * Lazy-Load: evaluate only rules relevant to available data/zoom/layers
//   * Web Workers: offer async worker-backed evaluation when enabled

// Types (for reference only):
// - Nudge = {
//     id, ruleId, severity, message, subject, target?, meta, actions?
//   }

import * as turf from '@turf/turf';

// Helper to format rule messages with simple template vars
const formatMessage = (template, vars) =>
  template.replace(/\$\{([^}]+)\}/g, (_, k) => (vars?.[k] ?? '').toString());

// Build a stable nudge id
const nudgeId = (ruleId, subjectKey, targetKey) => `${ruleId}::${subjectKey}${targetKey ? `::${targetKey}` : ''}`;

// Compute feet distance between two lng/lat points
const distanceFeet = (aLng, aLat, bLng, bLat) => {
  try {
    return turf.distance([aLng, aLat], [bLng, bLat], { units: 'feet' });
  } catch {
    return Infinity;
  }
};

// Representative point for a shape (centroid fallback)
const getShapePoint = (feature) => {
  try {
    if (feature?.geometry?.type === 'Point') {
      const [lng, lat] = feature.geometry.coordinates;
      return { lng, lat };
    }
    const c = turf.centroid(feature);
    const [lng, lat] = c.geometry.coordinates;
    return { lng, lat };
  } catch {
    return null;
  }
};

export function evaluateNudges(input) {
  const t0 = performance.now?.() ?? Date.now();
  const {
    rules = [],
    droppedObjects = [],
    customShapes = [],
    infrastructureData = {},
    layers = {},
    focusedArea,
    options = {}
  } = input || {};

  const activeNudges = [];

  // Quick lookups
  const droppedByType = droppedObjects.reduce((acc, o) => {
    (acc[o.type] = acc[o.type] || []).push(o);
    return acc;
  }, {});

  // Iterate rules
  for (const rule of rules) {
    if (rule.type === 'object') {
      // Trigger nudges for specific object types regardless of location
      const subjects = droppedByType[rule.subject?.where?.type] || [];
      if (subjects.length === 0) {
        continue;
      }
      for (const subj of subjects) {
        const s = subj?.position;
        const id = nudgeId(rule.id, subj.id || `${subj.type}-${s?.lng?.toFixed?.(6)}-${s?.lat?.toFixed?.(6)}`);
        const message = formatMessage(rule.message || '', { objectName: subj.name || subj.type });
        activeNudges.push({
          id,
          ruleId: rule.id,
          severity: rule.severity || 'info',
          message,
          type: 'object',
          subject: { kind: 'droppedObject', id: subj.id, type: subj.type, position: s },
          actions: rule.actions || [],
          citation: rule.citation,
          meta: {}
        });
      }
      continue;
    }
    if (rule.type === 'proximity') {
      // Prerequisite: target layer must be visible and data present
      const layerId = rule.target?.layerId;
      if (!layerId || !layers?.[layerId]?.visible) continue;
      const targetData = infrastructureData?.[layerId]?.features;
      if (!Array.isArray(targetData) || targetData.length === 0) continue;

      const subjects = droppedByType[rule.subject?.where?.type] || [];
      if (subjects.length === 0) continue;

      const thresholdFt = rule.thresholdFt ?? 10;
      for (const subj of subjects) {
        const s = subj?.position;
        if (!s) continue;
        let best = { distFt: Infinity, target: null };
        for (const feat of targetData) {
          if (!feat?.geometry || feat.geometry.type !== 'Point') continue;
          const [lng, lat] = feat.geometry.coordinates;
          const dft = distanceFeet(s.lng, s.lat, lng, lat);
          if (dft < best.distFt) best = { distFt: dft, target: feat };
        }
        if (best.target && best.distFt < thresholdFt) {
          const id = nudgeId(rule.id, subj.id || `${subj.type}-${s.lng.toFixed(6)}-${s.lat.toFixed(6)}`, best.target.id || best.target.properties?.id || `${best.target.geometry.coordinates.join(',')}`);
          const message = formatMessage(rule.message || '', {
            distanceFt: best.distFt,
            thresholdFt
          });
          activeNudges.push({
            id,
            ruleId: rule.id,
            severity: rule.severity || 'warning',
            message,
            type: 'proximity',
            subject: { kind: 'droppedObject', id: subj.id, type: subj.type, position: s },
            target: { kind: 'infrastructure', layerId, featureId: best.target.id },
            actions: rule.actions || [],
            citation: rule.citation,
            meta: { distanceFt: best.distFt, thresholdFt }
          });
        }
      }
    } else if (rule.type === 'text') {
      // Only evaluate on labeling changes; caller should gate invocation via options.labelScan === true
      if (!options?.labelScan) continue;
      for (const f of customShapes || []) {
        const label = f?.properties?.label;
        if (!label) continue;
        const spec = rule.match || {};
        let matched = false;
        let snippet = '';
        if (spec.mode === 'regex' && spec.pattern) {
          try {
            const re = new RegExp(spec.pattern, spec.flags || 'i');
            const m = label.match(re);
            if (m) {
              matched = true;
              snippet = m[0];
            }
          } catch {}
        } else {
          // fallback substring
          matched = label.toLowerCase().includes('glass');
          snippet = 'glass';
        }
        if (matched) {
          const pt = getShapePoint(f);
          const id = nudgeId(rule.id, f.id || label, snippet);
          const message = formatMessage(rule.message || '', { labelSnippet: snippet });
          activeNudges.push({
            id,
            ruleId: rule.id,
            severity: rule.severity || 'info',
            message,
            type: 'text',
            subject: { kind: 'customShape', id: f.id, position: pt },
            actions: rule.actions || [],
            citation: rule.citation,
            meta: { snippet }
          });
        }
      }
    }
  }

  const t1 = performance.now?.() ?? Date.now();
  return { nudges: activeNudges, perf: { tookMs: Math.max(0, t1 - t0) } };
}


