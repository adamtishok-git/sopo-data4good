"""
Main pipeline orchestrator.

Execution order:
  1. Load block geometries + school points
  2. Build block adjacency graph
  3. Build walk + drive distance matrices (cached)
  4. For each scenario: run assignment, compute metrics, export outputs
  5. Generate cross-scenario summary table
  6. Generate HTML maps for all scenarios
"""
import os
import json
import pickle
import pandas as pd
import geopandas as gpd

from src.config import SCENARIOS, OUTPUT_DIR, CACHE_DIR, SCHOOL_COLORS
from src.data_loader import load_blocks, load_schools
from src.network import build_distance_matrices
from src.contiguity import build_adjacency_graph
from src.assignment import run_scenario
from src.metrics import compute_scenario_metrics, build_summary_table
from src.visualization import make_scenario_map, save_map


def _adjacency_cache_path():
    return os.path.join(CACHE_DIR, "adjacency.pkl")


def _load_or_build_adjacency(blocks_gdf):
    path = _adjacency_cache_path()
    if os.path.exists(path):
        print("  Loading cached adjacency graph...")
        with open(path, "rb") as f:
            return pickle.load(f)
    print("  Building block adjacency graph (this may take a minute)...")
    G = build_adjacency_graph(blocks_gdf)
    with open(path, "wb") as f:
        pickle.dump(G, f)
    print(f"  Adjacency graph cached to {path}")
    return G


def run():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(CACHE_DIR, exist_ok=True)

    # ------------------------------------------------------------------ #
    # 1. Load data
    # ------------------------------------------------------------------ #
    print("=" * 60)
    print("Step 1: Loading data")
    print("=" * 60)
    blocks_gdf  = load_blocks()
    schools_gdf = load_schools()
    print(f"  Loaded {len(blocks_gdf)} census blocks, "
          f"total pop = {blocks_gdf['population'].sum():,}")
    print(f"  Loaded {len(schools_gdf)} schools")

    # ------------------------------------------------------------------ #
    # 2. Adjacency graph
    # ------------------------------------------------------------------ #
    print("\n" + "=" * 60)
    print("Step 2: Block adjacency graph")
    print("=" * 60)
    adjacency = _load_or_build_adjacency(blocks_gdf)
    print(f"  Graph: {adjacency.number_of_nodes()} nodes, "
          f"{adjacency.number_of_edges()} edges")

    # ------------------------------------------------------------------ #
    # 3. Distance matrices
    # ------------------------------------------------------------------ #
    print("\n" + "=" * 60)
    print("Step 3: Travel distance matrices")
    print("=" * 60)
    dist = build_distance_matrices(blocks_gdf, schools_gdf)
    walk_df  = dist["walk"]
    drive_df = dist["drive"]
    print(f"  Walk matrix:  {walk_df.shape}")
    print(f"  Drive matrix: {drive_df.shape}")

    # ------------------------------------------------------------------ #
    # 4. Run all scenarios
    # ------------------------------------------------------------------ #
    print("\n" + "=" * 60)
    print("Step 4: Running scenarios")
    print("=" * 60)

    all_scenario_metrics = []

    for scenario in SCENARIOS:
        name = scenario["name"]
        print(f"\n[Scenario: {name}]")

        assignments, open_schools = run_scenario(
            scenario, blocks_gdf, schools_gdf, walk_df, drive_df, adjacency
        )

        # -- Metrics --
        scene_metrics = compute_scenario_metrics(
            name, assignments, blocks_gdf, open_schools,
            walk_df, drive_df, adjacency
        )
        all_scenario_metrics.append(scene_metrics)

        # -- Export block assignments CSV --
        assign_rows = []
        for bid, sid in assignments.items():
            row = blocks_gdf.loc[bid]
            wd  = walk_df.loc[bid, sid] if sid in walk_df.columns else None
            dd  = drive_df.loc[bid, sid] if sid in drive_df.columns else None
            assign_rows.append({
                "block_id":           bid,
                "assigned_school":    sid,
                "population":         int(row["population"]),
                "students":           round(float(row["students"]), 1),
                "walk_dist_m":        round(wd, 1) if wd is not None else None,
                "drive_dist_m":       round(dd, 1) if dd is not None else None,
                "walk_dist_mi":       round(wd / 1609.34, 3) if wd is not None else None,
                "drive_dist_mi":      round(dd / 1609.34, 3) if dd is not None else None,
                "walkable":           bool(wd is not None and wd <= 1609.34),
            })
        assign_df = pd.DataFrame(assign_rows)
        assign_csv = os.path.join(OUTPUT_DIR, f"{name}_block_assignments.csv")
        assign_df.to_csv(assign_csv, index=False)
        print(f"  Saved: {assign_csv}")

        # -- Export boundary polygons GeoJSON --
        zone_polys = []
        for sid in open_schools["school_id"]:
            zone_block_ids = [b for b, s in assignments.items() if s == sid]
            if not zone_block_ids:
                continue
            # Dissolve blocks in WGS84
            zone_blocks_4326 = blocks_gdf.loc[zone_block_ids].copy()
            zone_blocks_4326["geometry"] = zone_blocks_4326["geometry_4326"]
            zone_blocks_4326 = zone_blocks_4326.set_geometry("geometry").set_crs("EPSG:4326", allow_override=True)
            dissolved = zone_blocks_4326.dissolve()
            zone_polys.append({
                "school_id": sid,
                "geometry":  dissolved.geometry.iloc[0],
                "color":     SCHOOL_COLORS.get(sid, "#999999"),
            })

        if zone_polys:
            zone_gdf = gpd.GeoDataFrame(zone_polys, crs="EPSG:4326")
            boundary_path = os.path.join(OUTPUT_DIR, f"{name}_boundaries.geojson")
            zone_gdf.to_file(boundary_path, driver="GeoJSON")
            print(f"  Saved: {boundary_path}")

        # -- Export metrics JSON --
        metrics_path = os.path.join(OUTPUT_DIR, f"{name}_metrics.json")
        with open(metrics_path, "w") as f:
            json.dump(scene_metrics, f, indent=2, default=str)
        print(f"  Saved: {metrics_path}")

        # -- Generate map --
        print(f"  Generating map for {name}...")
        fmap = make_scenario_map(
            scenario_name=name,
            assignments=assignments,
            blocks_gdf=blocks_gdf,
            open_schools=open_schools,
            school_metrics=scene_metrics["school_metrics"],
            walk_df=walk_df,
            drive_df=drive_df,
        )
        save_map(fmap, name)

    # ------------------------------------------------------------------ #
    # 5. Summary table
    # ------------------------------------------------------------------ #
    print("\n" + "=" * 60)
    print("Step 5: Summary comparison table")
    print("=" * 60)
    summary_df = build_summary_table(all_scenario_metrics)
    summary_path = os.path.join(OUTPUT_DIR, "scenario_summary.csv")
    summary_df.to_csv(summary_path)
    print(f"\nScenario Summary (ranked):\n")
    pd.set_option("display.max_columns", 20)
    pd.set_option("display.width", 120)
    print(summary_df[[
        "scenario", "capacity_feasible",
        "total_walkable_students", "avg_drive_distance_mi",
        "max_drive_distance_mi", "capacity_overflow",
        "all_zones_contiguous", "composite_rank"
    ]].to_string())
    print(f"\n  Saved: {summary_path}")

    print("\n" + "=" * 60)
    print("Pipeline complete. All outputs in:", OUTPUT_DIR)
    print("=" * 60)

    return all_scenario_metrics, summary_df
