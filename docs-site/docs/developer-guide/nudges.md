---
sidebar_position: 6
title: Nudge Rules & Engine
---

Nudges surface contextual guidance based on placed objects, custom shapes, and visible infrastructure.

## Rules

- Defined in `src/constants/nudgeRules.js` (data-only objects, easy to extend by non-devs).
- Types: `object` (by placed object type), `proximity` (distance to infrastructure points), `text` (label regex/substring).

## Engine

- `evaluateNudges(input)` consumes current state and rules; returns `{ nudges, perf }`.
- Uses Turf for distance; computes representative points for shapes.
- Guards by layer visibility and data presence for `proximity` rules.

Key files:

- `src/utils/nudgeEngine.js`
- `src/constants/nudgeRules.js`
- `src/hooks/useNudges.js`


