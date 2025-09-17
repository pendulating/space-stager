---
sidebar_position: 7
title: Infrastructure Service & Layer Styling
---

`infrastructureService.js` loads and normalizes layer data by current bounds, with per-layer fetching logic and field normalization. Styling is computed by `getLayerStyle()` using icon metadata and enhanced rendering flags.

## Fetching & normalization

- Builds SoQL queries with `within_box`/`intersects` per layer; handles ArcGIS FeatureServer envelopes and JSON endpoints.
- Normalizes fields for signs, meters, restrooms, etc., and converts EPSG:2263 coordinates to WGS84 where needed.
- For DCWP garages, fetches footprint polygons by BIN in chunks.

## Styling

- Returns MapLibre layer definitions per layer id (symbol/circle/line/fill) with size and color logic; integrates enhanced sprites when available.

Key file: `src/services/infrastructureService.js`


