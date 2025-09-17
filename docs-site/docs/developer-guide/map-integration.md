---
sidebar_position: 1
title: Map Integration & React Wiring
---

This page describes how MapLibre GL JS is initialized and managed inside React, and how we handle style reloads and event lifecycles.

## Initialization

- `useMap(mapContainer)` loads libraries (`loadMapLibraries`) and calls `initializeMap(container)` to create the `maplibregl.Map`.
- On `load`, we set `mapLoaded`/`styleLoaded` and run `initHarness(map)` for debug helpers.
- We debounce `style.load` to update `styleLoaded` after style switches.

Key files:

- `src/hooks/useMap.js`
- `src/utils/mapUtils.js` (library loading, Navigation/Scale controls, search control)

## Style changes & basemap switching

- Basemap toggling is handled in `Sidebar/BasemapToggle.jsx` and `switchBasemap()` (in `mapUtils`).
- Before switching, we dispatch `map:style:will-change` (consumed by `useMap` to pre-clear `styleLoaded`).
- After style reload, `style.load` reattaches handlers and rebinds draw layers where needed.

## Centralized event lifecycle

- Use `useMapEvents(map, handlers, { reattachOnStyleLoad: true })` to attach/detach map and layer events with automatic cleanup and re-attachment on `style.load`.
- Prefer a single `useMapEvents` instance per module to avoid duplicated listeners.

## Draw tools

- `useDrawTools(map, focusedArea)` creates a `MapboxDraw` instance, adds it to the map, and registers `draw.*` events.
- It initializes early and listens for `style.load` to rebind when styles change.

## Best practices

- Keep React as owner of high-level state; use MapLibre sources/layers (`setData`) for rendering.
- For camera-synced overlays, avoid per-frame React state. Use `render` events or a lightweight `renderTick`.
- Use a single persistent Popup, updated on `mousemove` for hover, to avoid flicker.


