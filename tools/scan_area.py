#!/usr/bin/env python3
"""List intersections between candidate street names inside a lat/lon box.
    python3 tools/scan_area.py streets.json lat0 lat1 lon0 lon1 "Name 1" "Name 2" ...
Names are substring matches; prints which names exist in OSM, then every pair that meets."""
import itertools, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from osm_lookup import load, intersections, matching
path, la0, la1, lo0, lo1, *names = sys.argv[1:]
la0, la1, lo0, lo1 = map(float, (la0, la1, lo0, lo1))
ways = load(path)
have = [n for n in names if matching(ways, n)]
print("in OSM:", ", ".join(have))
print("missing:", ", ".join(n for n in names if n not in have))
for a, b in itertools.combinations(have, 2):
    pts = [p for p in intersections(ways, a, b) if lo0 < p[1] < lo1 and la0 < p[0] < la1]
    if pts:
        print(f"{a} x {b}: " + "; ".join(f"{p[0]:.6f} {p[1]:.6f}" for p in pts[:2]))
