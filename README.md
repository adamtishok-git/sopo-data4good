# South Portland Elementary School Redistricting Model

A reproducible geospatial model for analyzing school boundary scenarios in South Portland, Maine.

## What This Does

Models the Kaler closure scenario and optimizes the remaining school zone boundaries to:
1. **Respect hard capacity constraints** — no school exceeds its enrollment cap
2. **Maximize community continuity** — contiguous zones; bussed neighbors go together
3. **Minimize travel distance** — walkability and drive time factored into assignments

The interactive webapp (see `webapp/`) shows community and grade-center boundary options
for the Kaler-closed scenario.

## How It Works

**Three-stage assignment algorithm:**
- **Stage 1** — Capacity-bounded Voronoi flood-fill from guaranteed seed blocks
- **Stage 2** — Hard capacity enforcement with tiered contiguity-preference moves
- **Stage 3** — Bussed community cohesion smoothing (keeps non-walkable neighbors together)

Uses OSM road networks (via OSMnx) for real walk/drive distance matrices.

## Schools

| School | Capacity | Coordinates |
|--------|----------|-------------|
| Brown  | 260 | 43.6347, -70.2489 |
| Dyer   | 240 | 43.6219, -70.2749 |
| Small  | 240 | 43.6413, -70.2339 |
| Skillin | 380 | 43.6260, -70.3054 |
| Kaler  | 240 | 43.6287, -70.2688 |

*Note: Closing Skillin is excluded — remaining four schools (capacity 1,020) cannot absorb all 1,013 K-4 students.*

## Quick Start

```bash
pip install geopandas osmnx folium networkx shapely pandas numpy
python3 run.py
```

Outputs saved to `outputs/`:
- `*_map.html` — Interactive folium maps (open in browser)
- `*_boundaries.geojson` — Zone boundary polygons
- `*_block_assignments.csv` — Per-block assignments with walk/drive distances
- `*_metrics.json` — School utilization, walkability %, avg drive times
- `scenario_summary.csv` — Ranked comparison of all scenarios

## Grade-Center Mode

The webapp supports a **grade-center** view where PreK–1 students attend one set of
schools and Grades 2–4 students attend a different set.

### Zone pairing (Kaler closed)

| Zone | PreK–1 school | Cap | Grades 2–4 school | Cap |
|------|--------------|-----|-------------------|-----|
| West | Dyer | 240 | Skillin | 380 |
| East | Small | 240 | Brown | 260 ← binding |

The Brown G2-4 cap (260) is the binding constraint — it limits how many students
can be assigned to the East zone regardless of the PreK–1 capacity available at Small.

### Shared boundaries

Rather than optimising the PreK–1 and Grades 2–4 zones independently (which produces
different boundary lines that could confuse families), the base case uses a **single
geographic partition** for both grade bands.  Every block's West/East assignment is
identical whether you are looking at the PreK–1 or the 2–4 map.

`prek1_full` (grade-center with full PreK expansion) uses the same zone geometry as
`prek1_current`.  The extra PreK seats affect only the capacity-utilisation display,
not the boundary itself.

### Algorithm (`compute_shared_boundaries.py`)

1. **Starting partition** — Load the independently-optimised Grades 2–4 assignments.
   By construction these satisfy the Brown 260 cap; any K-1 imbalance is then fixed
   in step 2.

2. **Capacity rebalancing** — Iteratively move border blocks from over-capacity zones
   to under-capacity zones using three escalating move types:
   - Single-block moves (most targeted)
   - Peninsula moves (bridge block + all trailing components, guarantees contiguity)
   - Border swaps (exchange adjacent blocks between zones for a net capacity gain)

3. **Distance optimisation** — Move border blocks to the zone with the lower
   student-weighted drive cost:

   ```
   zone_cost = K-1 students × drive_dist_to_prek1_school
             + G2-4 students × drive_dist_to_g24_school
   ```

   A block is moved only when the new zone has a lower cost **and** all four capacity
   constraints remain satisfied after the move.

### Re-running the boundary computation

If you need to regenerate the shared boundaries (e.g. after changing school capacities
or block-level student counts):

```bash
/opt/anaconda3/bin/python3 compute_shared_boundaries.py
```

This patches `webapp/public/data/kaler_closed.json` in-place.  Requires `geopandas`
and `shapely` (available in the Anaconda environment).

## Data

`Polygons.geojson` — 316 census blocks (2020 Census, South Portland, ME) with population
counts used to estimate student distribution.  Block-level race/ethnicity data (2020 Census
PL 94-171) is included to display estimated percent minority students per school zone.
