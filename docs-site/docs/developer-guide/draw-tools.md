---
sidebar_position: 2
title: Draw Tools & Modes Lifecycle
---

`useDrawTools(map, focusedArea)` owns MapboxDraw setup, custom modes, and event lifecycles.

## Initialization

- Creates a single `MapboxDraw` instance with `displayControlsDefault:false` and `userProperties:true`.
- Registers custom modes (e.g. `draw_rect_object`) alongside built-ins.
- Adds control to the map and wires `draw.create`, `draw.update`, `draw.delete`, `draw.selectionchange`.

## Style reloads

- Initializes early and also listens to `style.load` to rebind layers/filters after basemap switches.
- `reinitializeDrawControls()` ensures a draw instance exists and reattaches events when style changes.

## Mode changes

- On `draw.modechange`, clears active rect indicator when leaving the custom mode, and clears the active tool highlight when returning to `simple_select`.
- Map container also re-hides Draw point layers for text on `style.load`, `draw.modechange`, and `draw.render` by applying a filter.

## Retry mechanism

- If initialization is delayed, the UI exposes a Retry button (`DrawingTools`) which calls the hook’s manual initializer to re-attempt binding.

Key files:

- `src/hooks/useDrawTools.js`
- `src/components/Sidebar/DrawingTools.jsx`
- `src/components/Map/MapContainer.jsx` (reapplies Draw point filters)


