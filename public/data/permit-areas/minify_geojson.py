import geopandas as gpd

# Path to your original GeoJSON file
input_path = "nyc_20250611_122007.geojson"
# Path for the minified output
output_path = "nyc-permit-areas-minified.geojson"

# Read the original GeoJSON
gdf = gpd.read_file(input_path)

# Keep only the desired columns (if they exist)
columns_to_keep = ["system", "geometry", "name", "propertyname", "subpropertyname"]
gdf = gdf[[col for col in columns_to_keep if col in gdf.columns]]

# Simplify geometry (tolerance in degrees, adjust as needed)
# 0.0002 is a good starting point for city-scale data
#gdf["geometry"] = gdf["geometry"].simplify(tolerance=0.0002, preserve_topology=True)

# Save to new GeoJSON
gdf.to_file(output_path, driver="GeoJSON")

print(f"Minified GeoJSON saved to {output_path}")