"""
Fetch 2020 Decennial Census race/ethnicity data at the census block level
for South Portland, ME (state=23 Maine, county=005 Cumberland).

Variables from PL 94-171 redistricting file:
  P1_001N  - Total population
  P2_005N  - Not Hispanic or Latino: White alone

Minority = Total - (Non-Hispanic White alone)
This captures: Hispanic/Latino of any race + all non-white non-Hispanic people.

Saves data/race_by_block.json: {block_id: {total, white_nh, minority, pct_minority}}
"""
import json, urllib.request

STATE  = "23"
COUNTY = "005"

url = (
    "https://api.census.gov/data/2020/dec/pl"
    f"?get=P1_001N,P2_005N"
    f"&for=block:*"
    f"&in=state:{STATE}%20county:{COUNTY}%20tract:*"
)

print(f"Fetching: {url}")
with urllib.request.urlopen(url) as resp:
    rows = json.loads(resp.read())

# First row is header
header = rows[0]
idx_total    = header.index("P1_001N")
idx_white_nh = header.index("P2_005N")
idx_state    = header.index("state")
idx_county   = header.index("county")
idx_tract    = header.index("tract")
idx_block    = header.index("block")

race_data = {}
for row in rows[1:]:
    block_id = row[idx_state] + row[idx_county] + row[idx_tract] + row[idx_block]
    total    = int(row[idx_total]    or 0)
    white_nh = int(row[idx_white_nh] or 0)
    minority = total - white_nh
    pct      = round(minority / total * 100, 1) if total > 0 else None
    race_data[block_id] = {
        "total":       total,
        "white_nh":    white_nh,
        "minority":    minority,
        "pct_minority": pct,
    }

with open("data/race_by_block.json", "w") as f:
    json.dump(race_data, f, separators=(",", ":"))

print(f"Saved {len(race_data)} blocks to data/race_by_block.json")

# Quick sanity check: print a few blocks that have students
with open("data/student_blocks.json") as f:
    student_blocks = json.load(f)
sample = [bid for bid in list(student_blocks.keys())[:5] if bid in race_data]
for bid in sample:
    r = race_data[bid]
    print(f"  {bid}: total={r['total']} minority={r['minority']} ({r['pct_minority']}%)")
