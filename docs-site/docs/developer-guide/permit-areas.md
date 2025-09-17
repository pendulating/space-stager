---
sidebar_position: 3
title: Permit Areas Flow & Selection
---

`usePermitAreas(map, mapLoaded, options)` manages loading, search/filter, focus/subfocus, hover tooltips, and click/double-click selection across Parks, Plazas, and Intersections modes.

## Core responsibilities

- Loads GeoJSON by mode with caching and abort handling; shows loading/error states.
- Search: maintains `searchQuery`, `searchResults`, `isSearching`.
- Focus: sets `focusedArea` and optional `subFocusArea` (polygon scoping) and constrains camera (minZoom, bounds, rotation toggles).
- UI affordances: hover tooltip, single persistent click popover for Parks, overlapping area selector with keyboard/mouse navigation.

## Event wiring (via `useMapEvents`)

- Click / dblclick on permit fill layer select/focus, with general click handling that avoids interference with annotations or active draw modes.
- Listeners reattach on `style.load` to survive basemap switches.

## Overlap selection

- When multiple areas overlap at a click, the hook collects them and shows an on-map selector; selection updates filters and focus.

Key files:

- `src/hooks/usePermitAreas.js`
- `src/components/Sidebar/PermitAreaSearch.jsx`


