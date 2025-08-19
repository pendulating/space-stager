# simple script to load nybb from geodatasets and export as a network image 
import geopandas as gpd
import geodatasets
import matplotlib.pyplot as plt

# load nybb from geodatasets
nybb = gpd.read_file(geodatasets.get_path('nybb'))

# plot as simple png 
fig, ax = plt.subplots(figsize=(10, 10))
nybb.plot(ax=ax, color='white', edgecolor='black', linewidth=1.5)
plt.axis('off')
plt.savefig('../../public/data/nybb.png', dpi=300, bbox_inches='tight', pad_inches=0)