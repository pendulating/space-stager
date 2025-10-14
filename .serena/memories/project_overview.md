Space Stager (Vite + React) is a client-side mapping tool for planning public space events in NYC. It loads NYC open data (Socrata, ArcGIS) and local static datasets, renders with MapLibre GL, and supports placing objects, exporting site plans to PDF/PNG, and toggling many infrastructure layers. Key domains: infrastructure layers, permit areas, object placement, export.

Core flows:
- Map bootstraps in `src/components/Map/MapContainer.jsx` using MapLibre.
- Infrastructure data fetched/normalized in `src/services/infrastructureService.js`, orchestrated by `src/hooks/useInfrastructure.js` and `src/services/geographyLayerManager.js` for sources/layers.
- Permit areas and geography via `src/services/geographyService.js` and `src/hooks/usePermitAreas.js`.
- Export logic in `src/utils/exportUtils.js` including loading icons/sprites and citywide inset rendering.
- Icons/sprites managed via `src/utils/iconUtils.js` and enhanced sprite rendering.

Configuration lives in `src/constants/{endpoints,layers,mapConfig,placeableObjects}.js`. Public assets under `public/data/...`. E2E configured via `playwright.config.js`.