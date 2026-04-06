"""
Compute shared grade-center boundaries for the kaler_closed scenario.

Finds a single 2-zone geographic partition that:
  1. Satisfies all four capacity constraints simultaneously (no portables needed)
  2. Minimises total student–school drive distance — each block is assigned to
     the zone whose schools are geographically closest, measured as the
     weighted sum of K-1 students × drive-to-prek1-school  +
                    G2-4 students × drive-to-g24-school

Zone pairing (ordered by corrected reconfig — Dyer↔Skillin, Small↔Brown):
  Zone 0: Dyer  (PreK–1, cap 240) + Skillin (Grades 2–4, cap 380)
  Zone 1: Small (PreK–1, cap 240) + Brown   (Grades 2–4, cap 260)  ← binding

Patches kaler_closed.json baseAssignments for prek1_current, prek1_full, g24.
prek1_full shares the same zone geometry; the additional PreK overhead only
affects capacity utilisation display, not the boundary itself.

Algorithm:
  Step 1 — Load the independently-optimised g24 (Grades 2–4) zone partition as
            the starting point.  By construction those assignments satisfy
            Zone-1 G2-4 ≤ 260 (Brown cap), so only a K-1 imbalance, if any,
            remains to fix.
  Step 2 — Multi-constraint capacity rebalancing.  Three escalating move types:
            (a) single border-block move, (b) peninsula (bridge + all trailing
            components) move, (c) border swap.  Iterates until all four capacity
            constraints are satisfied or no further moves are available.
  Step 3 — Distance optimisation: move border blocks to the zone with the lower
            weighted drive cost (K-1 students × dist-to-prek1 + G2-4 × dist-to-g24)
            while keeping all capacity constraints satisfied.

Run:
    python3 compute_shared_boundaries.py
"""

import json
from collections import deque
from shapely.geometry import shape
import geopandas as gpd

# ── Load ──────────────────────────────────────────────────────────────────────

DATA_PATH = "webapp/public/data/kaler_closed.json"
with open(DATA_PATH) as f:
    data = json.load(f)

reconfig   = data["reconfig"]
schools    = data["schools"]
blocks_raw = data["blocks"]

prek1_ids = reconfig["prek1Schools"]   # ['Dyer', 'Small']
g24_ids   = reconfig["g24Schools"]     # ['Skillin', 'Brown']

k1_caps  = [schools[p]["capacity"] for p in prek1_ids]   # [240, 240]
g24_caps = [schools[g]["capacity"] for g in g24_ids]     # [380, 260]

print(f"Zone 0: {prek1_ids[0]} (K-1 ≤{k1_caps[0]}) + {g24_ids[0]} (G2-4 ≤{g24_caps[0]})")
print(f"Zone 1: {prek1_ids[1]} (K-1 ≤{k1_caps[1]}) + {g24_ids[1]} (G2-4 ≤{g24_caps[1]})")

# ── Block lookup and distance helper ─────────────────────────────────────────

block_idx = {b["id"]: b for b in blocks_raw}

def zone_cost(block, zone_idx):
    """
    Total expected drive distance for all students in this block if assigned
    to zone_idx.  K-1 students drive to the prek1 school; G2-4 students
    drive to the g24 school.  Missing distances are treated as very large.
    """
    drive = block.get("driveDists", {})
    def d(school):
        v = drive.get(school)
        return v if v is not None else 1e9
    k1  = block.get("studentsK1",  0)
    g24 = block.get("studentsG24", 0)
    return k1 * d(prek1_ids[zone_idx]) + g24 * d(g24_ids[zone_idx])

# ── Build adjacency graph from polygon geometries ─────────────────────────────

print("Building adjacency graph...")
geo_records = [{"block_id": b["id"], "geometry": shape(b["geometry"])}
               for b in blocks_raw]
gdf    = gpd.GeoDataFrame(geo_records, crs="EPSG:4326")
sindex = gdf.sindex

adj = {b["id"]: set() for b in blocks_raw}
for i, row_i in gdf.iterrows():
    bid_i  = row_i["block_id"]
    geom_i = row_i["geometry"]
    candidates = list(sindex.intersection(geom_i.bounds))
    for j in candidates:
        if j <= i:
            continue
        row_j  = gdf.iloc[j]
        bid_j  = row_j["block_id"]
        geom_j = row_j["geometry"]
        try:
            shared = geom_i.intersection(geom_j)
            if not shared.is_empty and shared.geom_type not in ("Point", "MultiPoint"):
                adj[bid_i].add(bid_j)
                adj[bid_j].add(bid_i)
        except Exception:
            pass

print(f"  {sum(len(v) for v in adj.values()) // 2} adjacency edges across "
      f"{len(blocks_raw)} blocks")

# ── Helpers ───────────────────────────────────────────────────────────────────

def zone_loads(zone_dict):
    k1_l  = [0.0, 0.0]
    g24_l = [0.0, 0.0]
    for bid, z in zone_dict.items():
        b = block_idx[bid]
        k1_l[z]  += b.get("studentsK1",  0)
        g24_l[z] += b.get("studentsG24", 0)
    return k1_l, g24_l

def is_contiguous_after_removal(zone_dict, remove_ids, zone_num):
    """BFS check: does zone_num stay connected if remove_ids (set) are removed?"""
    remove_set = remove_ids if isinstance(remove_ids, (set, frozenset)) else {remove_ids}
    members = [b for b, z in zone_dict.items() if z == zone_num and b not in remove_set]
    if len(members) <= 1:
        return True
    start   = members[0]
    visited = {start}
    queue   = deque([start])
    while queue:
        cur = queue.popleft()
        for nbr in adj.get(cur, set()):
            if nbr not in visited and nbr not in remove_set and zone_dict.get(nbr) == zone_num:
                visited.add(nbr)
                queue.append(nbr)
    return len(visited) == len(members)

def peninsula_group(zone_dict, seed_id, over_z):
    """
    If seed_id is an articulation point (bridge) in over_z, return a frozenset
    of seed_id plus all smaller disconnected components that appear when seed_id
    is removed.  Moving this entire group to the other zone keeps over_z
    contiguous because only the largest component is left behind.
    Returns None if seed_id is not a bridge.
    """
    rest = {b for b, z in zone_dict.items() if z == over_z and b != seed_id}
    if len(rest) <= 1:
        return frozenset([seed_id]) | rest

    components = []
    unvisited = set(rest)
    while unvisited:
        start = next(iter(unvisited))
        comp  = set()
        queue = deque([start])
        comp.add(start)
        while queue:
            cur = queue.popleft()
            for nbr in adj.get(cur, set()):
                if nbr in unvisited and nbr not in comp:
                    comp.add(nbr)
                    queue.append(nbr)
        unvisited -= comp
        components.append(comp)

    if len(components) <= 1:
        return None  # not a bridge

    # Keep the largest component in over_z; move seed + everything else.
    largest = max(components, key=len)
    others  = [c for c in components if c is not largest]
    return frozenset([seed_id]) | frozenset(b for c in others for b in c)

# ── Step 1: Load existing g24 assignments as starting partition ───────────────
#
# The g24 assignments were independently optimised to keep Brown (Zone-1)
# G2-4 ≤ 260.  Using them as the starting point guarantees Zone-1 G2-4 is
# already within cap; rebalancing then only needs to fix any K-1 imbalance.

print("\nStep 1: Loading existing g24 zone partition as starting point...")
zone = {}
for b in blocks_raw:
    bid  = b["id"]
    asgn = b.get("baseAssignments", {}).get("g24")
    zone[bid] = 1 if asgn == g24_ids[1] else 0   # g24_ids[1] = Brown = Zone 1

k1_l, g24_l = zone_loads(zone)
print(f"  Zone 0: K-1 {k1_l[0]:.1f}/{k1_caps[0]}   G2-4 {g24_l[0]:.1f}/{g24_caps[0]}")
print(f"  Zone 1: K-1 {k1_l[1]:.1f}/{k1_caps[1]}   G2-4 {g24_l[1]:.1f}/{g24_caps[1]}")

# ── Step 2: Capacity rebalancing ──────────────────────────────────────────────
#
# Move border blocks from over-capacity zones to under-capacity zones.
# Falls back to peninsula (multi-block) moves and border swaps when single
# moves are blocked by contiguity.

def find_best_single(zone_dict, over_z, tgt_z, k1_l, g24_l, over_type):
    """Return (bid, score) of the best single border block to move, or None."""
    best = None
    for bid, z in zone_dict.items():
        if z != over_z:
            continue
        if not any(zone_dict.get(nbr) == tgt_z for nbr in adj.get(bid, set())):
            continue
        b = block_idx[bid]
        if k1_l[tgt_z]  + b.get("studentsK1",  0) > k1_caps[tgt_z]:
            continue
        if g24_l[tgt_z] + b.get("studentsG24", 0) > g24_caps[tgt_z]:
            continue
        if not is_contiguous_after_removal(zone_dict, {bid}, over_z):
            continue
        relief     = b.get("studentsK1", 0) if over_type == "k1" else b.get("studentsG24", 0)
        dist_delta = zone_cost(b, tgt_z) - zone_cost(b, over_z)
        score = (relief, -dist_delta)
        if best is None or score > best[1]:
            best = (bid, score)
    return best

def find_best_peninsula(zone_dict, over_z, tgt_z, k1_l, g24_l, over_type):
    """Return (group, relief) of the best peninsula group to move, or None."""
    border_bridges = [bid for bid, z in zone_dict.items()
                      if z == over_z
                      and any(zone_dict.get(nbr) == tgt_z for nbr in adj.get(bid, set()))
                      and not is_contiguous_after_removal(zone_dict, {bid}, over_z)]
    best = None
    for seed in border_bridges:
        group = peninsula_group(zone_dict, seed, over_z)
        if group is None:
            continue
        grp_k1  = sum(block_idx[b].get("studentsK1",  0) for b in group)
        grp_g24 = sum(block_idx[b].get("studentsG24", 0) for b in group)
        if k1_l[tgt_z]  + grp_k1  > k1_caps[tgt_z]:
            continue
        if g24_l[tgt_z] + grp_g24 > g24_caps[tgt_z]:
            continue
        if not is_contiguous_after_removal(zone_dict, group, over_z):
            continue
        relief = grp_k1 if over_type == "k1" else grp_g24
        if best is None or relief > best[1]:
            best = (group, relief)
    return best

def find_best_swap(zone_dict, over_z, tgt_z, k1_l, g24_l, over_type):
    """
    Try swapping adjacent blocks across the zone boundary.
    A swap (a ∈ tgt_z → over_z, b ∈ over_z → tgt_z) is accepted when:
      - net_relief > 0 (the violated constraint improves)
      - no new violations are introduced in the other three constraints
      - both zones remain contiguous after the swap
    """
    best = None
    for aid, az in zone_dict.items():
        if az != tgt_z:
            continue
        a = block_idx[aid]
        a_k1  = a.get("studentsK1",  0)
        a_g24 = a.get("studentsG24", 0)
        for bid in adj.get(aid, set()):
            if zone_dict.get(bid) != over_z:
                continue
            b = block_idx[bid]
            b_k1  = b.get("studentsK1",  0)
            b_g24 = b.get("studentsG24", 0)
            net_relief = (b_k1 - a_k1) if over_type == "k1" else (b_g24 - a_g24)
            if net_relief <= 0:
                continue
            # No new violations in the other three constraints
            new_g24_ov = g24_l[over_z] - b_g24 + a_g24
            new_k1_tg  = k1_l[tgt_z]  - a_k1  + b_k1
            new_g24_tg = g24_l[tgt_z] - a_g24 + b_g24
            if new_g24_ov > g24_caps[over_z]: continue
            if new_k1_tg  > k1_caps[tgt_z]:  continue
            if new_g24_tg > g24_caps[tgt_z]:  continue
            # Contiguity check (simulate swap temporarily)
            zone_dict[aid] = over_z
            zone_dict[bid] = tgt_z
            ok = (is_contiguous_after_removal(zone_dict, set(), over_z) and
                  is_contiguous_after_removal(zone_dict, set(), tgt_z))
            zone_dict[aid] = tgt_z
            zone_dict[bid] = over_z
            if not ok:
                continue
            if best is None or net_relief > best[1]:
                best = ((aid, bid), net_relief)
    return best

print("\nStep 2: Rebalancing to satisfy all four capacity constraints...")
for iteration in range(500):
    k1_l, g24_l = zone_loads(zone)

    worst = None
    for z in range(2):
        for metric, load, cap in [("k1",  k1_l[z],  k1_caps[z]),
                                   ("g24", g24_l[z], g24_caps[z])]:
            excess = load - cap
            if excess > 0 and (worst is None or excess > worst[3]):
                worst = (z, metric, load, excess)

    if worst is None:
        print(f"  ✓ All constraints satisfied after {iteration} iteration(s).")
        break

    over_z, over_type, _, _ = worst
    tgt_z = 1 - over_z

    # 1) Single-block move
    single = find_best_single(zone, over_z, tgt_z, k1_l, g24_l, over_type)
    if single:
        bid = single[0]
        b   = block_idx[bid]
        zone[bid] = tgt_z
        print(f"  [{iteration+1}] …{bid[-8:]} zone {over_z}→{tgt_z}  "
              f"(K-1={b.get('studentsK1',0):.1f}  G2-4={b.get('studentsG24',0):.1f}  "
              f"relieving {over_type})")
        continue

    # 2) Peninsula (multi-block) move
    pgroup = find_best_peninsula(zone, over_z, tgt_z, k1_l, g24_l, over_type)
    if pgroup:
        group, _ = pgroup
        grp_k1  = sum(block_idx[b].get("studentsK1",  0) for b in group)
        grp_g24 = sum(block_idx[b].get("studentsG24", 0) for b in group)
        for bid in group:
            zone[bid] = tgt_z
        print(f"  [{iteration+1}] Peninsula of {len(group)} blocks zone {over_z}→{tgt_z}  "
              f"(K-1={grp_k1:.1f}  G2-4={grp_g24:.1f}  relieving {over_type})")
        continue

    # 3) Swap (a ∈ tgt_z ↔ b ∈ over_z)
    swap = find_best_swap(zone, over_z, tgt_z, k1_l, g24_l, over_type)
    if swap:
        (aid, bid), _ = swap
        a = block_idx[aid]
        b = block_idx[bid]
        zone[aid] = over_z
        zone[bid] = tgt_z
        print(f"  [{iteration+1}] Swap: {aid[-8:]}(z{tgt_z})↔{bid[-8:]}(z{over_z})  "
              f"(a K-1={a.get('studentsK1',0):.1f} G2-4={a.get('studentsG24',0):.1f}  "
              f"b K-1={b.get('studentsK1',0):.1f} G2-4={b.get('studentsG24',0):.1f}  "
              f"relieving {over_type})")
        continue

    print(f"  WARNING: no valid move found to resolve {over_type} "
          f"over-capacity in zone {over_z}. Stopping early.")
    break
else:
    print("  WARNING: rebalancing did not converge in 500 iterations.")

# ── Step 3: Distance optimisation — swap border blocks to reduce drive time ───

print("\nStep 3: Distance optimisation (swapping border blocks closer to their school)...")
swaps    = 0
improved = True
while improved:
    improved = False
    k1_l, g24_l = zone_loads(zone)
    for bid in list(zone.keys()):
        cur_z = zone[bid]
        tgt_z = 1 - cur_z
        if not any(zone.get(nbr) == tgt_z for nbr in adj.get(bid, set())):
            continue
        b = block_idx[bid]
        if zone_cost(b, tgt_z) >= zone_cost(b, cur_z):
            continue
        if k1_l[tgt_z]  + b.get("studentsK1",  0) > k1_caps[tgt_z]:
            continue
        if g24_l[tgt_z] + b.get("studentsG24", 0) > g24_caps[tgt_z]:
            continue
        if not is_contiguous_after_removal(zone, {bid}, cur_z):
            continue
        zone[bid] = tgt_z
        k1_l[cur_z]  -= b.get("studentsK1",  0);  k1_l[tgt_z]  += b.get("studentsK1",  0)
        g24_l[cur_z] -= b.get("studentsG24", 0);  g24_l[tgt_z] += b.get("studentsG24", 0)
        swaps    += 1
        improved  = True

print(f"  {swaps} block(s) moved to reduce drive distances.")

# ── Final report ──────────────────────────────────────────────────────────────

k1_l, g24_l = zone_loads(zone)
print("\n── Final zone loads ─────────────────────────────────────────────")
all_ok = True
for z in range(2):
    k_ok  = "✓" if k1_l[z]  <= k1_caps[z]  else "✗ OVER"
    g_ok  = "✓" if g24_l[z] <= g24_caps[z] else "✗ OVER"
    if "OVER" in k_ok or "OVER" in g_ok:
        all_ok = False
    print(f"  Zone {z} ({prek1_ids[z]} + {g24_ids[z]}):  "
          f"K-1 {k1_l[z]:.1f}/{k1_caps[z]} {k_ok}   "
          f"G2-4 {g24_l[z]:.1f}/{g24_caps[z]} {g_ok}")

total_dist     = 0.0
total_students = 0.0
for b in blocks_raw:
    bid   = b["id"]
    z     = zone.get(bid, 0)
    drive = b.get("driveDists", {})
    for school, students in [(prek1_ids[z], b.get("studentsK1",  0)),
                              (g24_ids[z],   b.get("studentsG24", 0))]:
        d = drive.get(school)
        if d and students > 0:
            total_dist     += d * students
            total_students += students

avg_mi = (total_dist / total_students / 1609.34) if total_students > 0 else 0.0
print(f"\nWeighted avg drive distance (all grade-center students): {avg_mi:.2f} mi")
print("─────────────────────────────────────────────────────────────")

if not all_ok:
    print("\nWARNING: one or more capacity constraints not met — review output above.")

# ── Patch kaler_closed.json ───────────────────────────────────────────────────

prek1_asgn = {bid: prek1_ids[z] for bid, z in zone.items()}
g24_asgn   = {bid: g24_ids[z]   for bid, z in zone.items()}

changed = 0
for block in data["blocks"]:
    bid = block["id"]
    if bid not in prek1_asgn:
        continue
    prev = (block["baseAssignments"].get("prek1_current"),
            block["baseAssignments"].get("g24"))
    block["baseAssignments"]["prek1_current"] = prek1_asgn[bid]
    block["baseAssignments"]["prek1_full"]    = prek1_asgn[bid]
    block["baseAssignments"]["g24"]           = g24_asgn[bid]
    if prev != (prek1_asgn[bid], g24_asgn[bid]):
        changed += 1

with open(DATA_PATH, "w") as f:
    json.dump(data, f, separators=(",", ":"))

print(f"\nPatched {DATA_PATH} — {changed} block(s) updated.")
print("Open the webapp → Grade Centers → toggle PreK–1 ↔ 2–4 to verify identical boundaries.")
