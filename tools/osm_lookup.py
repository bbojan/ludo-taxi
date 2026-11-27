#!/usr/bin/env python3
"""Find real-world coordinates of street intersections in Skopje from an OSM extract.

Used to align the hand-drawn sheets: read named intersections off a sheet, look them up here.

    python3 tools/osm_lookup.py streets.json "Илинденска" "Партизански"     # intersection(s)
    python3 tools/osm_lookup.py streets.json --names "Партиз"              # list matching street names

The extract is an Overpass `out tags geom` dump of named highways/rivers/railways
(see README, "Aligning automatically").
"""
import json
import math
import sys
import unicodedata


def norm(s):
    s = unicodedata.normalize("NFC", s).lower()
    for a, b in (("бул.", ""), ("булевар", ""), ("ул.", ""), ("„", ""), ("“", ""), ('"', "")):
        s = s.replace(a, b)
    return " ".join(s.split())


def load(path):
    ways = []
    for e in json.load(open(path, encoding="utf-8"))["elements"]:
        name = e.get("tags", {}).get("name")
        if name and "geometry" in e:
            ways.append((name, [(p["lat"], p["lon"]) for p in e["geometry"]]))
    return ways


def matching(ways, q):
    q = norm(q)
    return [w for w in ways if q in norm(w[0])]


def dist_m(a, b):
    dy = (a[0] - b[0]) * 111320
    dx = (a[1] - b[1]) * 111320 * math.cos(math.radians(a[0]))
    return math.hypot(dx, dy)


def seg_intersections(p1, p2, q1, q2):
    """Intersection point of two segments (lat/lon treated as planar, fine at city scale)."""
    (y1, x1), (y2, x2), (y3, x3), (y4, x4) = p1, p2, q1, q2
    d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(d) < 1e-14:
        return None
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d
    u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / d
    if 0 <= t <= 1 and 0 <= u <= 1:
        return (y1 + t * (y2 - y1), x1 + t * (x2 - x1))
    return None


def intersections(ways, a, b, near=None, max_gap=25):
    """All points where a street matching `a` meets one matching `b` (shared node, crossing,
    or ends within max_gap metres). Clustered to one point per junction."""
    A, B = matching(ways, a), matching(ways, b)
    pts = []
    for _, ga in A:
        for _, gb in B:
            sb = set(gb)
            pts += [p for p in ga if p in sb]
            for i in range(len(ga) - 1):
                for j in range(len(gb) - 1):
                    x = seg_intersections(ga[i], ga[i + 1], gb[j], gb[j + 1])
                    if x:
                        pts.append(x)
            for p in (ga[0], ga[-1]):
                for q in gb:
                    if dist_m(p, q) < max_gap:
                        pts.append(((p[0] + q[0]) / 2, (p[1] + q[1]) / 2))
    clusters = []
    for p in pts:
        for c in clusters:
            if dist_m(c[0], p) < 60:
                c.append(p)
                break
        else:
            clusters.append([p])
    out = [(sum(p[0] for p in c) / len(c), sum(p[1] for p in c) / len(c)) for c in clusters]
    if near:
        out.sort(key=lambda p: dist_m(p, near))
    return out


if __name__ == "__main__":
    path, *args = sys.argv[1:]
    ways = load(path)
    if args[0] == "--names":
        for n in sorted({w[0] for w in matching(ways, args[1])}):
            print(n)
    else:
        for p in intersections(ways, args[0], args[1]):
            print(f"{p[0]:.6f} {p[1]:.6f}")
