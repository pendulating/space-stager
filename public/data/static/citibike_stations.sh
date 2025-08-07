#! /bin/bash

# write a script to download the citibike stations data from the citibike website, https://gbfs.lyft.com/gbfs/2.3/bkn/en/station_information.json

# create a directory for the citibike stations data
mkdir -p citibike_stations

# download the citibike stations data
curl -o citibike_stations/stations.json https://gbfs.lyft.com/gbfs/2.3/bkn/en/station_information.json

# print the number of stations in the data
echo "Number of stations: $(jq '.data.stations | length' citibike_stations/stations.json)"

# cull columns so only the following are included:
# station_id, name, lat, lon 
jq '.data.stations | map({short_name: .short_name, lat: .lat, lon: .lon})' citibike_stations/stations.json > citibike_stations/stations_culled.json


