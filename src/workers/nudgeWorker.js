// src/workers/nudgeWorker.js
// Purpose: Optional Web Worker module to evaluate rules off the main thread using Comlink.
// Linked files:
// - Wrapped by `src/utils/nudgeEngine.js` when worker mode is enabled
// - Exposes an API like { initIndexes, evaluate } via Comlink

// Implementation outline (no logic yet):
// - Use Comlink.expose({ ... }) to publish methods
// - Inside, build spatial/text indexes and run evaluation similar to main-thread engine

// Minimal testable worker API. In a real worker, these would be exposed via Comlink.
// We export plain functions so unit tests can import and call them directly in Node.

const state = {
  rules: [],
};

export function initIndexes({ rules = [] } = {}) {
  state.rules = Array.isArray(rules) ? rules : [];
  return { ok: true, ruleCount: state.rules.length };
}

export function evaluate({ droppedObjects = [], infrastructureData = {}, layers = {} } = {}) {
  // Extremely small placeholder: generate a nudge for each dropped object if any rule exists
  const nudges = [];
  if (state.rules.length > 0) {
    for (const obj of droppedObjects) {
      if (!obj?.position) continue;
      nudges.push({
        id: `wk::${obj.id || obj.type}`,
        ruleId: state.rules[0]?.id || 'worker-rule',
        severity: 'info',
        message: `Worker saw ${obj.type}`,
        subject: { kind: 'droppedObject', id: obj.id, type: obj.type, position: obj.position },
        meta: {}
      });
    }
  }
  return { nudges, perf: { tookMs: 0 } };
}

export default { initIndexes, evaluate };


