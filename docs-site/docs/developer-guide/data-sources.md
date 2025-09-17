---
sidebar_position: 9
title: Data Sources (NYC Open Data & Others)
---

Primary sources are NYC Open Data (Socrata), NY State Open Data, ArcGIS FeatureServer, and local static files.

Examples (see `src/constants/endpoints.js` for the full list):

- Bike Lanes (NYC): `https://data.cityofnewyork.us/resource/mzxg-pwib.geojson`
- Bike Parking (NYC): `https://data.cityofnewyork.us/resource/592z-n7dk.geojson`
- Subway Entrances (NY State): `https://data.ny.gov/resource/i9wp-a4ja.geojson`
- CSCL Centerlines (NYC): `https://data.cityofnewyork.us/resource/inkn-q76z.geojson`
- Pedestrian Ramps (NYC): `https://data.cityofnewyork.us/resource/ufzp-rrqu.geojson`
- Parking Meters (NYC): `https://data.cityofnewyork.us/resource/693u-uax6.geojson`
- LinkNYC (NYC): `https://data.cityofnewyork.us/resource/s4kf-3yrf.json`
- Public Restrooms (NYC): `https://data.cityofnewyork.us/resource/i7jb-7jku.geojson`
- Drinking Fountains (NYC): `https://data.cityofnewyork.us/resource/qnv7-p7a2.geojson`
- Spray Showers (NYC): `https://data.cityofnewyork.us/resource/ckaz-6gaa.geojson`
- Parks Trails (NYC): `https://data.cityofnewyork.us/resource/vjbm-hsyr.geojson`
- Parking Lots (NYC): `https://data.cityofnewyork.us/resource/7cgt-uhhz.geojson`
- Ice Ladders (NYC): `https://data.cityofnewyork.us/resource/eubv-y6cr.geojson`
- Parks Signs (NYC): `https://data.cityofnewyork.us/resource/hv9n-xgy4.geojson`
- Street Parking Signs (NYC): `https://data.cityofnewyork.us/resource/nfid-uabd.json`
- Bus Stops (local static): `/data/static/bus_stops_nyc.geojson`
- DCWP Garages (NYC): `https://data.cityofnewyork.us/resource/w7w3-xahh.json`
- Building Footprints by BIN (NYC): `https://data.cityofnewyork.us/resource/5zhs-2jue.geojson`
- Curb Cuts 2022 (ArcGIS): `https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_Cut_2022/FeatureServer/5/query`

Notes:

- Queries use `$where` with `within_box()`/`intersects()` and optional `$select` to reduce payload.
- Some endpoints return JSON arrays (not GeoJSON); the service normalizes to GeoJSON Features.
- Coordinate conversions (EPSG:2263 → WGS84) are applied where needed.


