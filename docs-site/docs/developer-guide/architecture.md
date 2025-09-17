---
sidebar_position: 1
title: Architecture Overview
---

Space Stager is a React 18 + Vite app using MapLibre GL for map rendering.

## Key modules

- Hooks: `useMap`, `usePermitAreas`, `useDrawTools`, `useInfrastructure`.
- Contexts: `SitePlanContext`, `GeographyContext`, `ZoneCreatorContext`, `DroppedObjectsContext`.
- Services: `infrastructureService`, `geographyService`, `permitAreaService`.
- Utils: map init, export PDF/PNG, geometry, sprites.

See also: Map events audit.


