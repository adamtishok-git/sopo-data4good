"""
Patch existing webapp JSON files to add race/ethnicity fields to each block.
Run this instead of the full pipeline when cache is unavailable.
"""
import json, os

with open("data/race_by_block.json") as f:
    race_by_block = json.load(f)

data_dir = "webapp/public/data"
files = [f for f in os.listdir(data_dir) if f.endswith(".json")]

for fname in files:
    path = os.path.join(data_dir, fname)
    with open(path) as f:
        data = json.load(f)

    for block in data.get("blocks", []):
        bid = block["id"]
        race = race_by_block.get(bid, {})
        block["raceTotal"]    = race.get("total", 0)
        block["raceMinority"] = race.get("minority", 0)
        block["pctMinority"]  = race.get("pct_minority")

    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"))

    size_kb = os.path.getsize(path) / 1024
    print(f"{fname}: {len(data.get('blocks', []))} blocks patched, {size_kb:.0f} KB")

print("Done.")
