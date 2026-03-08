"""
Generate per-scenario JSON data files for the web app.
Run once after run.py to prepare data for the frontend.
Outputs to webapp/public/data/{scenario}.json
"""
import json, os, pickle
import pandas as pd
import geopandas as gpd
import numpy as np

SCENARIOS = ['brown_closed', 'dyer_closed', 'small_closed', 'kaler_closed']
CLOSED_MAP = {
    'brown_closed': 'Brown',
    'dyer_closed':  'Dyer',
    'small_closed': 'Small',
    'kaler_closed': 'Kaler',
}
SCHOOLS = {
    "Brown":   {"lat": 43.63469222922709, "lng": -70.2488528529349,  "capacity": 260, "color": "#E74C3C"},
    "Dyer":    {"lat": 43.62188281730617, "lng": -70.27491180480025, "capacity": 240, "color": "#3498DB"},
    "Small":   {"lat": 43.64131092018083, "lng": -70.23385021390395, "capacity": 280, "color": "#2ECC71"},
    "Skillin": {"lat": 43.62597508507279, "lng": -70.30537634309235, "capacity": 380, "color": "#F39C12"},
    "Kaler":   {"lat": 43.62867422728908, "lng": -70.26881539114758, "capacity": 240, "color": "#9B59B6"},
}

os.makedirs('webapp/public/data', exist_ok=True)

# Load distance matrices
with open('cache/distance_matrices.pkl', 'rb') as f:
    dm = pickle.load(f)
walk_df = dm['walk']
drive_df = dm['drive']

# Convert index to string for consistent lookup
walk_df.index = walk_df.index.astype(str)
drive_df.index = drive_df.index.astype(str)

# Load block geometries (WGS84 - GeoJSON is always WGS84)
blocks_gdf = gpd.read_file('Polygons.geojson')
blocks_gdf = blocks_gdf.rename(columns={'GEOID20': 'block_id', 'POP20': 'population'})
blocks_gdf['block_id'] = blocks_gdf['block_id'].astype(str)
blocks_gdf = blocks_gdf.set_index('block_id')

# Load student estimates (same across scenarios - derived from total pop)
ref_df = pd.read_csv('outputs/brown_closed_block_assignments.csv')
ref_df['block_id'] = ref_df['block_id'].astype(str)
students_map = dict(zip(ref_df['block_id'], ref_df['students']))

def safe_dist(df, bid, sid):
    try:
        v = df.loc[bid, sid]
        return round(float(v), 1) if np.isfinite(v) else None
    except Exception:
        return None

for scenario in SCENARIOS:
    closed = CLOSED_MAP[scenario]
    open_schools = [s for s in SCHOOLS if s != closed]

    asgn_df = pd.read_csv(f'outputs/{scenario}_block_assignments.csv')
    asgn_df['block_id'] = asgn_df['block_id'].astype(str)
    base_assignments = dict(zip(asgn_df['block_id'], asgn_df['assigned_school']))

    blocks_out = []
    for bid, row in blocks_gdf.iterrows():
        if bid not in base_assignments:
            continue
        pop = int(row['population'])
        students = round(float(students_map.get(bid, 0)), 2)

        walk_dists  = {sid: safe_dist(walk_df,  bid, sid) for sid in open_schools}
        drive_dists = {sid: safe_dist(drive_df, bid, sid) for sid in open_schools}

        geom = row['geometry'].__geo_interface__

        blocks_out.append({
            'id':             bid,
            'geometry':       geom,
            'population':     pop,
            'students':       students,
            'baseAssignment': base_assignments[bid],
            'walkDists':      walk_dists,
            'driveDists':     drive_dists,
        })

    out = {
        'scenario':    scenario,
        'closedSchool': closed,
        'openSchools': open_schools,
        'schools':     {s: SCHOOLS[s] for s in open_schools},
        'blocks':      blocks_out,
    }

    path = f'webapp/public/data/{scenario}.json'
    with open(path, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print(f'{scenario}: {len(blocks_out)} blocks, {os.path.getsize(path)/1024:.0f} KB')

print('Done — data files in webapp/public/data/')
