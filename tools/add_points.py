#!/usr/bin/env python3
"""Replace one sheet's control points:  python3 tools/add_points.py 08 'u v lat lon note' ...   (one quoted arg per point)"""
import json, os, sys
p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "control_points.json")
d = json.load(open(p, encoding="utf-8"))
sid, rows = sys.argv[1], sys.argv[2:]
pts = []
for r in rows:
    u, v, lat, lon, *note = r.split()
    pts.append({"u": float(u), "v": float(v), "lat": float(lat), "lon": float(lon), "note": " ".join(note)})
d[sid] = pts
json.dump(dict(sorted(d.items())), open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(sid, len(pts), "points")
