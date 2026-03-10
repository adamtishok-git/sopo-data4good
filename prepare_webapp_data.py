"""
Generate per-scenario JSON data files for the web app.
Includes all 5 assignment modes + per-block grade-band student counts.
"""
import json, os, pickle
import pandas as pd
import geopandas as gpd
import numpy as np

from src.config import (
    SCENARIOS, RECONFIG_SCENARIOS, SCHOOLS,
    PREK_COMMUNITY_CURRENT, PREK_PER_SCHOOL, PREK_PER_CENTER,
    SCHOOL_COLORS, WALK_THRESHOLD_METERS,
    TOTAL_K4, TOTAL_K1, TOTAL_G24,
)

os.makedirs("webapp/public/data", exist_ok=True)

with open("cache/distance_matrices.pkl", "rb") as f:
    dm = pickle.load(f)
walk_df  = dm["walk"]
drive_df = dm["drive"]
walk_df.index  = walk_df.index.astype(str)
drive_df.index = drive_df.index.astype(str)

# Blocks with no school-age children — excluded from map and student counts.
# TODO: revisit with actual per-student address data from the school district.
NO_STUDENTS_BLOCKS = {"230050030022012"}  # Retirement community

blocks_gdf = gpd.read_file("Polygons.geojson")
blocks_gdf = blocks_gdf.rename(columns={"GEOID20": "block_id", "POP20": "population"})
blocks_gdf["block_id"]  = blocks_gdf["block_id"].astype(str)
blocks_gdf["population"] = pd.to_numeric(blocks_gdf["population"], errors="coerce").fillna(0).astype(int)
blocks_gdf = blocks_gdf.set_index("block_id", drop=False)

# Use only eligible (non-excluded) population so students redistribute correctly
eligible_pop = blocks_gdf.loc[~blocks_gdf["block_id"].isin(NO_STUDENTS_BLOCKS), "population"].sum()

CLOSED_MAP = {s["name"]: s["closed"] for s in SCENARIOS}

SCHOOLS_OUT = {
    k: {"lat": v["lat"], "lng": v["lng"], "capacity": v["capacity"],
        "color": SCHOOL_COLORS[k]}
    for k, v in SCHOOLS.items()
}

def safe_dist(df, bid, sid):
    try:
        v = df.loc[bid, sid]
        return round(float(v), 1) if np.isfinite(v) else None
    except Exception:
        return None

def load_asgn(path):
    df = pd.read_csv(path)
    df["block_id"] = df["block_id"].astype(str)
    return dict(zip(df["block_id"], df["assigned_school"]))

for scenario in SCENARIOS:
    sname  = scenario["name"]
    closed = CLOSED_MAP[sname]
    open_school_ids = [s for s in SCHOOLS if s != closed]
    reconfig = RECONFIG_SCENARIOS[sname]
    prek1_ids = reconfig["prek1_schools"]
    g24_ids   = reconfig["g24_schools"]

    # Load all 5 mode assignments
    modes = {
        "community_current": load_asgn(f"outputs/{sname}_community_current.csv"),
        "community_full":    load_asgn(f"outputs/{sname}_community_full.csv"),
        "prek1_current":     load_asgn(f"outputs/{sname}_prek1_current.csv"),
        "prek1_full":        load_asgn(f"outputs/{sname}_prek1_full.csv"),
        "g24":               load_asgn(f"outputs/{sname}_g24.csv"),
    }

    # PreK overhead per mode (for display / capacity calculations in the webapp)
    prek_alloc = {
        "community_current": PREK_COMMUNITY_CURRENT[sname],
        "community_full":    {sid: PREK_PER_SCHOOL for sid in open_school_ids},
        "prek1_current":     {sid: PREK_PER_SCHOOL for sid in prek1_ids},
        "prek1_full":        {sid: PREK_PER_CENTER for sid in prek1_ids},
        "g24":               {},
    }

    blocks_out = []
    for bid, row in blocks_gdf.iterrows():
        # Skip excluded blocks entirely — they won't appear on the map
        if bid in NO_STUDENTS_BLOCKS:
            continue

        pop      = int(row["population"])
        stud_k4  = round(pop / eligible_pop * TOTAL_K4,  2)
        stud_k1  = round(pop / eligible_pop * TOTAL_K1,  2)
        stud_g24 = round(pop / eligible_pop * TOTAL_G24, 2)

        walk_dists  = {sid: safe_dist(walk_df,  bid, sid) for sid in open_school_ids}
        drive_dists = {sid: safe_dist(drive_df, bid, sid) for sid in open_school_ids}
        geom = row["geometry"].__geo_interface__

        base_assignments = {mode: asgn.get(bid) for mode, asgn in modes.items()}

        blocks_out.append({
            "id":               bid,
            "geometry":         geom,
            "population":       pop,
            "studentsK4":       stud_k4,
            "studentsK1":       stud_k1,
            "studentsG24":      stud_g24,
            "baseAssignments":  base_assignments,
            "walkDists":        walk_dists,
            "driveDists":       drive_dists,
        })

    out = {
        "scenario":      sname,
        "closedSchool":  closed,
        "openSchools":   open_school_ids,
        "schools":       {s: SCHOOLS_OUT[s] for s in open_school_ids},
        "reconfig":      {"prek1Schools": prek1_ids, "g24Schools": g24_ids},
        "prekAllocations": prek_alloc,
        "blocks":        blocks_out,
    }

    path = f"webapp/public/data/{sname}.json"
    with open(path, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"{sname}: {len(blocks_out)} blocks, {os.path.getsize(path)/1024:.0f} KB")

print("Done.")
