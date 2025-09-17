---
title: Endpoints
sidebar_position: 1
---

## Infrastructure Endpoints

Name | URL | Local | Geo Field | Notes
--- | --- | --- | --- | ---
bikeLanes | https://data.cityofnewyork.us/resource/mzxg-pwib.geojson | No | the_geom | 
bikeParking | https://data.cityofnewyork.us/resource/592z-n7dk.geojson | No | the_geom | 
citibikeStations | /data/static/citibike_stations/citibike_stations.geojson | Yes |  | 
subwayEntrances | https://data.ny.gov/resource/i9wp-a4ja.geojson | No | entrance_georeference | selectFields
fireLanes | https://data.cityofnewyork.us/resource/inkn-q76z.geojson | No | the_geom | 
specialDisasterRoutes | https://data.cityofnewyork.us/resource/inkn-q76z.geojson | No | the_geom | 
csclCenterlines | https://data.cityofnewyork.us/resource/inkn-q76z.geojson | No | the_geom | 
pedestrianRamps | https://data.cityofnewyork.us/resource/ufzp-rrqu.geojson | No | the_geom | 
parkingMeters | https://data.cityofnewyork.us/resource/693u-uax6.geojson | No | location | 
linknycKiosks | https://data.cityofnewyork.us/resource/s4kf-3yrf.json | No | location | 
publicRestrooms | https://data.cityofnewyork.us/resource/i7jb-7jku.geojson | No | location_1 | 
drinkingFountains | https://data.cityofnewyork.us/resource/qnv7-p7a2.geojson | No | the_geom | 
sprayShowers | https://data.cityofnewyork.us/resource/ckaz-6gaa.geojson | No | point | 
parksTrails | https://data.cityofnewyork.us/resource/vjbm-hsyr.geojson | No | shape | 
parkingLots | https://data.cityofnewyork.us/resource/7cgt-uhhz.geojson | No | the_geom | 
iceLadders | https://data.cityofnewyork.us/resource/eubv-y6cr.geojson | No | the_geom | 
parksSigns | https://data.cityofnewyork.us/resource/hv9n-xgy4.geojson | No | point | 
streetParkingSigns | https://data.cityofnewyork.us/resource/nfid-uabd.json | No |  | selectFields
trees | https://data.cityofnewyork.us/resource/hn5i-inap.geojson | No | location | 
hydrants | https://data.cityofnewyork.us/resource/5bgh-vtsn.geojson | No | the_geom | 
trashBaskets | https://data.cityofnewyork.us/resource/8znf-7b2c.geojson | No | point | 
busStops | /data/static/bus_stops_nyc.geojson | Yes |  | 
benches | https://data.cityofnewyork.us/resource/esmy-s8q5.geojson | No | the_geom | 
accessiblePedSignals | https://data.cityofnewyork.us/resource/de3m-c5p4.geojson | No | the_geom | selectFields
curbCuts | https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_Cut_2022/FeatureServer/5/query | No |  | selectFields
dcwpParkingGarages | https://data.cityofnewyork.us/resource/w7w3-xahh.json | No |  | selectFields
stationEnvelopes | https://data.ny.gov/resource/vkng-7ivg.geojson | No | shape | selectFields

## Geography Endpoints

Name | URL
--- | ---
parks | /data/permit-areas/nyc-permit-areas-minified.geojson
plazas | /data/static/nyc_public_plazas_enriched.geojson
intersections | /data/static/nyc_cscl_intersections.geojson

## Export Endpoints

Name | URL | Geo Field
--- | --- | ---
sidewalks | https://data.cityofnewyork.us/resource/52n9-sdep.geojson | the_geom