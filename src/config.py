"""
Central configuration for the South Portland redistricting model.

Note: Closing Skillin is excluded — the remaining four schools have combined
capacity of only 1,020 (260+240+280+240), which is less than total enrollment
of 1,074. The four viable closure scenarios are Brown, Dyer, Small, and Kaler.
"""
import os

SCHOOLS = {
    "Brown":   {"lat": 43.63469222922709, "lng": -70.2488528529349,  "enrollment": 201, "capacity": 260},
    "Dyer":    {"lat": 43.62188281730617, "lng": -70.27491180480025, "enrollment": 197, "capacity": 240},
    "Small":   {"lat": 43.64131092018083, "lng": -70.23385021390395, "enrollment": 192, "capacity": 280},
    "Skillin": {"lat": 43.62597508507279, "lng": -70.30537634309235, "enrollment": 302, "capacity": 380},
    "Kaler":   {"lat": 43.62867422728908, "lng": -70.26881539114758, "enrollment": 182, "capacity": 240},
}

TOTAL_ENROLLMENT = 1074

# Skillin excluded: remaining capacity (1,020) < total enrollment (1,074)
SCENARIOS = [
    {"name": "brown_closed",    "closed": "Brown"},
    {"name": "dyer_closed",     "closed": "Dyer"},
    {"name": "small_closed",    "closed": "Small"},
    {"name": "kaler_closed",    "closed": "Kaler"},
]

# Distance thresholds
WALK_THRESHOLD_MILES = 1.0
WALK_THRESHOLD_METERS = WALK_THRESHOLD_MILES * 1609.34  # 1609.34 m

# OSM place query for network download
STUDY_AREA = "South Portland, Maine, USA"

# Visualization colors per school
SCHOOL_COLORS = {
    "Brown":   "#E74C3C",
    "Dyer":    "#3498DB",
    "Small":   "#2ECC71",
    "Skillin": "#F39C12",
    "Kaler":   "#9B59B6",
    "UNASSIGNED": "#CCCCCC",
}

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR  = os.path.join(BASE_DIR, "cache")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
BLOCKS_GEOJSON = os.path.join(BASE_DIR, "Polygons.geojson")
