---
sidebar_position: 4
title: Export Pipeline (PNG/PDF)
---

The export system produces PNG or PDF site plans with optional citywide inset, legend, and blueprint styling.

## Styling primitives

- `exportStyles.js`: blueprint theme (fonts, sizes, line widths, colors) and helpers: `registerBlueprintFonts`, `setPdfFont`, `drawTextWithWipe`, `drawNorthArrow`, `drawScaleBar`.

## PNG/PDF flows

- PNG: renders the map canvas and overlays; composes legend/inset as bitmaps.
- PDF: uses jsPDF and autotable; converts mm↔pt; draws labels with wipe boxes to ensure readability; adds scale bar and north arrow.

## Sprites & enhanced rendering

- Enhanced angle sprites are registered on demand; legend chooses representative variants consistent with map rendering.

Key files:

- `src/utils/exportUtils.js`
- `src/utils/exportStyles.js`


