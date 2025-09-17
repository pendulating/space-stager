---
sidebar_position: 8
title: Sprite Resolver & Enhanced Rendering
---

Enhanced rendering uses angle-variant sprites and a resolver that provides stable URLs, preloading, and contrasting backgrounds.

## Resolver

- `getCandidateSrcs(objectType, angle, viewType)`: returns an ordered chain of sprite URLs for the given angle/view.
- `preloadImage`/`preloadChain`/`prefetchView`: reduce flicker by warming image caches.
- `bgColorFor(src)`: computes a contrasting background color for icon swatches.

Key file: `src/utils/spriteResolver.js`


