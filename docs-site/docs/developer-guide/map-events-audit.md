---
sidebar_position: 2
title: Map Events Audit
---

<!-- Imported from docs/map-events-audit.md -->

## Space Stager: Map Event Listeners, Hover/Popup, and Marker Overlay Audit

### Scope

- App: Space Stager (React 18)
- Map engine: MapLibre GL JS (`maplibre-gl` ^3.6.2)
- Focus areas: map event registration, hover popups for dropped objects, on-map nudge markers performance, and architectural alignment with React and MapLibre best practices.

### Summary of Findings

- **Duplicate/distributed event listeners**: Many `map.on` registrations exist across multiple components/hooks, increasing the chance of conflicting behavior and re-registration churn.
- **Hover popups for dropped objects**: Implemented with `mouseenter/leave` and ad-hoc Popup creation via a global ctor. This can flicker and fails on overlapping features; better to use a single Popup and `mousemove` for stable updates.
- **Nudge markers lag on camera move**: Marker positions are computed via `map.project` only when nudges or object updates change, not when the camera moves; this causes noticeable lag until other state changes occur.
- **Window-level drag handlers**: Drag logic attaches `mousemove`/`mouseup` to `window` while disabling `map.dragPan`; this is acceptable but requires careful cleanup and deduping across layers/DOM overlays.
- **Lifecycle tight coupling**: Several effects reattach handlers on redraws/style changes without centralized coordination. A shared `useMapEvents` hook exists and should be leveraged app-wide.
- **Popup ctor sourcing**: Popups are created via `window.maplibregl || window.mapboxgl`; prefer direct `import { Popup } from 'maplibre-gl'` to avoid globals and ensure bundler-friendly builds.

### Current Event Wiring Map (by file)

#### `src/components/Map/MapContainer.jsx`

- Style/layer lifecycle: `style.load`, `draw.modechange`, `draw.render`
- Draw events: `draw.create`, `draw.update`, `draw.delete`, `draw.selectionchange`
- Map interactions: disables double-click zoom; container-level React `onMouseMove` and `onClick` for placement + selection
- Derived annotations (GeoJSON source): updated with `setData` and kept above Draw layers; ordering nudged with timeouts

#### `src/components/Map/DroppedObjects.jsx`

- Source/layers: Ensures `dropped-objects` GeoJSON + symbol/circle/selected layers; frequent use of `setData`
- Interactions: `click` (select), `mousedown` (drag), `mouseenter/leave` (cursor), dedicated hover popup effect
- Images: Handles `styleimagemissing` to dynamically register enhanced sprites
- Selection highlight: updates filter on `DROPPED_SELECTED_LAYER_ID`
- Indexing: maintains `map.__droppedObjectsIndex` for id→object lookup

#### `src/components/Map/DroppedRectangles.jsx`

- Drag handlers on `window` with cleanup; separate overlay for rectangle edit/resize

#### `src/hooks/useMapViewState.js`

- Subscribes to `render`, `style.load`, and basics: `move`, `zoom`, `rotate`, `pitch`, `resize`
- Exposes a `renderTick` counter for camera-driven UI updates

#### `src/hooks/useDrawTools.js`

- Extensive `draw.*` event registrations across multiple places; manages Draw control lifecycle

#### `src/hooks/useInfrastructure.js`

- Per-layer `mouseenter/leave/click` for polygon/point infrastructure layers
- Cleanup sometimes uses `off(event, layerId)` without handler; while supported, mixing patterns across files complicates reasoning

#### `src/hooks/usePermitAreas.js`

- Multiple listeners: hover `mousemove`, `mouseenter/leave`; clicks and double-clicks; also `draw.*` for mode changes

#### `src/hooks/useMapEvents.js`

- Centralized helper that attaches/detaches listeners and reattaches on `style.load`. Not yet uniformly adopted.

### Problems and Root Causes

1. **Hover popups for dropped objects are brittle**
   - Uses `mouseenter/leave` to show/hide; on dense/overlapping features these events can fail to fire in the expected order.
   - Popup instance is created via a global ctor; multiple instances risk churn and stale references.
   - Best practice is a single persistent Popup, updated on `mousemove` for the target layer, with `mouseleave` to clear.

2. **Nudge markers lag behind camera**
   - `NudgeMarkers` projects positions with `map.project` inside a `useMemo` keyed on `[nudges, map, objectUpdateTrigger]`, ignoring camera movement.
   - Without subscribing to `render`/`move` or `view.renderTick`, the overlay does not follow the map each frame.

3. **Listener duplication and lifecycle conflicts**
   - `map.on` scattered across `MapContainer`, `DroppedObjects`, `useDrawTools`, `usePermitAreas`, `useInfrastructure`, `useZoneCreator`.
   - Handlers get re-registered during prop/state changes. Some cleanups remove by event only; others specify handlers. Mixing patterns increases risk of leaks or missed detachments.

4. **Drag handling overlap (DOM vs layer)**
   - Both layer-based drag (on symbol/circle) and DOM overlay drag (for placed point) exist. While this can coexist, ensure only one path is active per interaction to avoid double-updates.

5. **Global Popup constructor**
   - Depending on `window.maplibregl` can fail in tests or non-window environments and complicates tree-shaking. Import from `maplibre-gl` directly.

### Best-Practice References (MapLibre)

- **Hover Popup pattern (mousemove + persistent popup)**: https://github.com/maplibre/maplibre-gl-js/blob/main/test/examples/display-a-popup-on-hover.html
- **Click Popup pattern**: https://github.com/maplibre/maplibre-gl-js/blob/main/test/examples/display-a-popup-on-click.html
- **Live data updates** (use `setData` on GeoJSON sources): https://github.com/maplibre/maplibre-gl-js/blob/main/docs/guides/large-data.md
- **Camera-driven updates**: Use `render` events or `requestAnimationFrame` for smooth camera-following UI (e.g., rotating camera example).

### Recommendations

1. **Centralize map event registration via `useMapEvents`**
   - Replace scattered `map.on/off` calls with a single hook per module that:
     - Attaches handlers on mount and detaches on unmount
     - Reattaches on `style.load` for layer-bound handlers
     - Uses stable handler refs to avoid re-registration churn

2. **Refactor DroppedObjects hover to single shared popup**
   - Import `Popup` from `maplibre-gl` and create one instance.
   - Listen to `mousemove` on both `dropped-objects` layers; update content/position when feature id changes.
   - Clear popup and cursor on `mouseleave`.
   - Hide popup while note editing.

3. **Fix NudgeMarkers camera-following**
   - Option A (simple): consume `useMapViewState(map)` and include `view.renderTick` in dependencies when computing `map.project` results.
   - Option B (performant): avoid React state; keep refs to DOM nodes and update their `style.transform` on `map.on('render', ...)` (no rerender).

4. **Unify drag/selection controllers**
   - Consolidate drag logic to a single path (layer-based or DOM) and ensure `map.dragPan` is disabled only during active drags, with robust cleanup.

5. **Standardize cleanup**
   - Prefer `off(event, layerId, handler)` when possible for explicitness; if removing all listeners for a layer/event, do so intentionally and document it.

6. **Stabilize handlers with refs**
   - Where closures capture changing props/state, keep a stable outer function and deref the latest implementation from a ref to avoid frequent detach/attach cycles.

### Proposed Implementation Steps (linked to TODOs)

1. Inventory and document existing listeners (this document). [DONE]
2. Compare patterns vs MapLibre examples and React best practices. [DONE]
3. Adopt `useMapEvents` in `DroppedObjects`, `useInfrastructure`, `usePermitAreas`, and `useDrawTools` for uniform lifecycle.
4. Replace hover popup in `DroppedObjects` with persistent `Popup` + `mousemove` approach.
5. Update `NudgeMarkers` to follow camera via `view.renderTick` or an imperative `render` listener.
6. Remove conflicting/duplicate listeners and ensure consistent `off` semantics.
7. Add tests: hover popup lifecycle, listener cleanup on unmount, nudge marker following camera.
8. Validate with integration tests; profile during camera move and object drag.

### Impacted Files (initial targets)

- `src/components/Map/DroppedObjects.jsx`
- `src/components/Map/NudgeMarkers.jsx`
- `src/components/Map/MapContainer.jsx`
- `src/hooks/useInfrastructure.js`
- `src/hooks/usePermitAreas.js`
- `src/hooks/useDrawTools.js`
- `src/hooks/useMapEvents.js` (adopt more broadly)

### Notes on React/MapLibre Integration Patterns

- Maintain React as the owner of high-level state, but prefer MapLibre sources/layers for rendering and map-driven interactivity. Use `setData` to mutate, not React re-render.
- For camera-synchronized overlays, avoid React setState per frame; prefer imperative DOM updates tied to `render` events or a lightweight `renderTick` dependency.
- Keep popups/markers as single instances where possible to avoid churn; reuse and update content/position.

### Appendix: Code Pseudocode for Key Fixes

Refactor hover popup (sketch):

```js
import { Popup } from 'maplibre-gl';

const popupRef = useRef(null);
useEffect(() => {
  if (!map) return;
  if (!popupRef.current) popupRef.current = new Popup({ closeButton: false, closeOnClick: false, offset: [0, -20] });
  const popup = popupRef.current;
  let currentId;
  const onMove = (e) => {
    const f = e?.features?.[0];
    const id = f?.properties?.id;
    if (!id || id === currentId) return;
    currentId = id;
    const obj = map.__droppedObjectsIndex?.get(id);
    if (!obj) return;
    popup.setDOMContent(buildContent(obj)).setLngLat(f.geometry.coordinates).addTo(map);
  };
  const onLeave = () => { popup.remove(); currentId = undefined; };
  map.on('mousemove', DROPPED_SYMBOL_LAYER_ID, onMove);
  map.on('mousemove', DROPPED_CIRCLE_LAYER_ID, onMove);
  map.on('mouseleave', DROPPED_SYMBOL_LAYER_ID, onLeave);
  map.on('mouseleave', DROPPED_CIRCLE_LAYER_ID, onLeave);
  return () => {
    map.off('mousemove', DROPPED_SYMBOL_LAYER_ID, onMove);
    map.off('mousemove', DROPPED_CIRCLE_LAYER_ID, onMove);
    map.off('mouseleave', DROPPED_SYMBOL_LAYER_ID, onLeave);
    map.off('mouseleave', DROPPED_CIRCLE_LAYER_ID, onLeave);
    popup.remove();
  };
}, [map]);
```

Nudge markers (render-driven positioning):

```js
const containerRef = useRef(null);
useEffect(() => {
  if (!map || !nudges.length) return;
  const nodes = new Map(); // id -> HTMLElement
  // ...create child nodes under containerRef.current...
  const update = () => {
    for (const m of nudges) {
      const p = map.project([m.subject.position.lng, m.subject.position.lat]);
      const el = nodes.get(m.id);
      if (el) el.style.transform = `translate(${p.x - 8}px, ${p.y - 26}px)`;
    }
  };
  map.on('render', update);
  return () => { map.off('render', update); };
}, [map, nudges]);
```



