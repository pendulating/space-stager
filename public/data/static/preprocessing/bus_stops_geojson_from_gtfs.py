# %%
import geopandas as gpd 
import pandas as pd 
from glob import glob 

# %%
bus_stops_nyc = pd.concat([pd.read_csv(f) for f in glob("../gtfs/*/stops.txt")])

# %%
bus_routes_nyc = pd.concat([pd.read_csv(f) for f in glob("../gtfs/*/routes.txt")])
bus_stop_times_nyc = pd.concat([pd.read_csv(f) for f in glob("../gtfs/*/stop_times.txt")])
bus_trips_nyc = pd.concat([pd.read_csv(f) for f in glob("../gtfs/*/trips.txt")])

# %%
print(bus_stops_nyc.isna().sum())
print(bus_routes_nyc.isna().sum())
print(bus_stop_times_nyc.isna().sum())
print(bus_trips_nyc.isna().sum())


# %%
# drop cols with nas 
bus_stops_nyc = bus_stops_nyc.dropna(axis=1, how='all')
# drop 'location_type', and 'stop_desc'
bus_stops_nyc = bus_stops_nyc.drop(columns=['location_type', 'stop_desc'])


# %%
# convert to geodataframe
bus_stops_nyc = gpd.GeoDataFrame(
    bus_stops_nyc, 
    geometry=gpd.points_from_xy(bus_stops_nyc.stop_lon, bus_stops_nyc.stop_lat),
    crs="EPSG:4326"
)


# join stop_times and trips 
bus_stop_times_nyc = bus_stop_times_nyc.merge(bus_trips_nyc, on='trip_id')
# join merged with routes 
merged_route_info = bus_routes_nyc.merge(bus_stop_times_nyc, on='route_id')
# for each stop_id in stop_times.txt, list all distinct route_id (from trips.txt -> routes.txt merge) that have trips serving the stop. 
routes_per_stop = merged_route_info.groupby('stop_id')['route_id'].apply(set).apply(list).reset_index()


# add routes per stop to bus_stops_nyc
bus_stops_nyc = bus_stops_nyc.merge(routes_per_stop, on='stop_id', how='left')


# %%
# write to geojson
bus_stops_nyc.to_file("../gtfs/bus_stops_nyc.geojson", driver='GeoJSON')

# %%



