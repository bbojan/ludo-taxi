#!/usr/bin/env python3
"""Fit each sheet's position/scale/rotation from control points and write layout.js.

Control points live in tools/control_points.json:
    { "08": [ {"u": 12.5, "v": 40, "lat": 42.0, "lon": 21.4, "note": "Илинденска x Партизански"}, ... ] }
u, v = position on the sheet in percent of its width / height (as read from tools/grid.html).

For every sheet with >= 2 points, a least-squares similarity transform (move + rotate +
uniform scale) is fitted in Web Mercator space, then converted to the layout.js fields:
lat/lon of the sheet centre, width in metres, rot in degrees clockwise. Sheets without
enough points keep their current values. Prints the residual of every point in metres.

    python3 tools/fit.py            # fit, print report, rewrite layout.js (backup first!)
    python3 tools/fit.py --dry      # report only
"""
import cmath
import json
import math
import os
import re
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from server import render_layout  # same writer as the editor uses  # noqa: E402

WZ = 16
WORLD = 256 * 2 ** WZ


def merc(lat, lon):
    s = math.sin(math.radians(lat))
    return complex((lon + 180) / 360 * WORLD, (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * WORLD)


def unmerc(z):
    lon = z.real / WORLD * 360 - 180
    n = math.pi - 2 * math.pi * z.imag / WORLD
    return math.degrees(math.atan(math.sinh(n))), lon


def m_per_unit(lat):
    return 156543.03392 * math.cos(math.radians(lat)) / 2 ** WZ


def jpeg_size(path):
    with open(path, "rb") as f:
        data = f.read()
    i = 2
    while i < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack(">HH", data[i + 5:i + 9])
            return w, h
        i += 2 + struct.unpack(">H", data[i + 2:i + 4])[0]
    raise ValueError(path)


def load_layout():
    text = open(os.path.join(ROOT, "layout.js"), encoding="utf-8").read()
    rows = []
    for m in re.finditer(r"\{([^{}]*)\}", text.split("[", 1)[1]):
        body = m.group(1)
        row = {}
        for k, v in re.findall(r'(\w+):\s*("(?:[^"\\]|\\.)*"|-?[\d.]+)', body):
            row[k] = json.loads(v) if v.startswith('"') else float(v)
        rows.append(row)
    return rows


def fit(points, w, h):
    """points: list of (local complex in px, centred; world complex). Returns a, b with world = a*local + b."""
    n = len(points)
    lm = sum(p[0] for p in points) / n
    wm = sum(p[1] for p in points) / n
    num = sum((p[1] - wm) * (p[0] - lm).conjugate() for p in points)
    den = sum(abs(p[0] - lm) ** 2 for p in points)
    a = num / den
    return a, wm - a * lm


def main():
    dry = "--dry" in sys.argv
    cps = json.load(open(os.path.join(ROOT, "tools", "control_points.json"), encoding="utf-8"))
    layout = load_layout()
    for s in layout:
        pts = cps.get(s["id"], [])
        if len(pts) < 2:
            print(f'{s["id"]} {s["name"]}: {len(pts)} point(s), kept as is')
            continue
        w, h = jpeg_size(os.path.join(ROOT, "sheets", f'{s["id"]}.jpg'))
        pairs = [(complex((p["u"] / 100 - .5) * w, (p["v"] / 100 - .5) * h), merc(p["lat"], p["lon"])) for p in pts]
        a, b = fit(pairs, w, h)
        lat, lon = unmerc(b)                      # local (0,0) = sheet centre
        scale, rot = abs(a), math.degrees(cmath.phase(a))
        width = w * scale * m_per_unit(lat)
        s.update(lat=lat, lon=lon, width=width, rot=(rot + 180) % 360 - 180)
        res = [abs(a * l + b - wz) * m_per_unit(lat) for l, wz in pairs]
        print(f'{s["id"]} {s["name"]}: {len(pts)} pts  width {width:.0f} m  rot {s["rot"]:.1f}°  '
              f'residual max {max(res):.0f} m, mean {sum(res) / len(res):.0f} m')
        for p, r in zip(pts, res):
            flag = "  <-- check" if r > max(60, 2.5 * sum(res) / len(res)) and len(pts) > 2 else ""
            print(f'      {r:5.0f} m  {p.get("note", "")}{flag}')
    if not dry:
        for i, s in enumerate(layout):
            s["z"] = int(s.get("z", i))
        text = render_layout(layout)
        open(os.path.join(ROOT, "layout.js"), "w", encoding="utf-8").write(text)
        # Snapshot of the fitted values, so the viewer can restore them after manual edits.
        snap = text.replace("window.DEFAULT_LAYOUT", "window.CLAUDE_LAYOUT").replace(
            "// This file is rewritten by the viewer's \"Edit layout\" mode when run with server.py.",
            "// Snapshot of the automatic alignment (tools/fit.py). Not touched by the editor;\n"
            "// the viewer's \"Restore Claude's positions\" buttons copy values from here.")
        open(os.path.join(ROOT, "layout.claude.js"), "w", encoding="utf-8").write(snap)
        print("layout.js and layout.claude.js written")


if __name__ == "__main__":
    main()
