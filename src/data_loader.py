"""
Load and prepare census block geometries and school point data.
"""
import geopandas as gpd
import pandas as pd
from shapely.geometry import Point
from src.config import SCHOOLS, BLOCKS_GEOJSON, TOTAL_ENROLLMENT


def load_blocks() -> gpd.GeoDataFrame:
    """
    Load census block polygons from GeoJSON.

    Returns a GeoDataFrame with columns:
        block_id, geometry, population, centroid_lat, centroid_lon,
        students (proportional to POP20), geometry_4326, centroid (Point)
    CRS: EPSG:4326, then projected to EPSG:32619 (UTM 19N, Maine)
    """
    gdf = gpd.read_file(BLOCKS_GEOJSON)

    # Normalize column names
    gdf = gdf.rename(columns={
        "GEOID20":    "block_id",
        "POP20":      "population",
        "INTPTLAT20": "centroid_lat",
        "INTPTLON20": "centroid_lon",
    })

    gdf["population"] = pd.to_numeric(gdf["population"], errors="coerce").fillna(0).astype(int)
    gdf["centroid_lat"] = pd.to_numeric(gdf["centroid_lat"], errors="coerce")
    gdf["centroid_lon"] = pd.to_numeric(gdf["centroid_lon"], errors="coerce")

    # Build centroid points in 4326
    gdf["centroid"] = gdf.apply(
        lambda r: Point(r["centroid_lon"], r["centroid_lat"]), axis=1
    )

    # Proportional student count per block
    total_pop = gdf["population"].sum()
    gdf["students"] = (gdf["population"] / total_pop * TOTAL_ENROLLMENT).round(1)

    # Keep geometry in 4326 for folium output
    gdf = gdf.set_crs("EPSG:4326", allow_override=True)
    gdf["geometry_4326"] = gdf["geometry"]

    # Project to UTM 19N for metric distance calculations
    gdf = gdf.to_crs("EPSG:32619")

    # Recompute centroid in projected CRS for network snapping
    gdf["centroid_proj"] = gdf.geometry.centroid

    gdf = gdf.set_index("block_id", drop=False)
    gdf.index.name = "idx"

    return gdf[["block_id", "geometry", "geometry_4326", "centroid",
                "centroid_proj", "population", "students",
                "centroid_lat", "centroid_lon"]]


def load_schools() -> gpd.GeoDataFrame:
    """
    Build a GeoDataFrame of school point locations from config.

    Returns GeoDataFrame with columns:
        school_id, geometry (Point), lat, lng, enrollment, capacity
    CRS: EPSG:32619 (projected)
    """
    records = []
    for name, info in SCHOOLS.items():
        records.append({
            "school_id":  name,
            "lat":        info["lat"],
            "lng":        info["lng"],
            "enrollment": info["enrollment"],
            "capacity":   info["capacity"],
            "geometry":   Point(info["lng"], info["lat"]),
        })

    gdf = gpd.GeoDataFrame(records, crs="EPSG:4326")
    gdf = gdf.to_crs("EPSG:32619")
    gdf = gdf.set_index("school_id", drop=False)
    gdf.index.name = "idx"
    return gdf
