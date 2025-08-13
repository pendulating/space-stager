// src/workers/nudgeWorker.js
// Purpose: Optional Web Worker module to evaluate rules off the main thread using Comlink.
// Linked files:
// - Wrapped by `src/utils/nudgeEngine.js` when worker mode is enabled
// - Exposes an API like { initIndexes, evaluate } via Comlink

// Implementation outline (no logic yet):
// - Use Comlink.expose({ ... }) to publish methods
// - Inside, build spatial/text indexes and run evaluation similar to main-thread engine

// Placeholder to avoid build errors in Vite until implementation
export default {};


