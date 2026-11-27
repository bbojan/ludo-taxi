#!/usr/bin/env python3
"""Local server for the taxi maps viewer.

Serves the project folder like `python3 -m http.server`, and also accepts
POST /api/layout from the viewer's edit mode, which rewrites layout.js
so sheet positions are saved in the project itself.

    python3 server.py            # http://localhost:8777
    python3 server.py 9000       # another port
"""
import json
import math
import os
import re
import shutil
import sys
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
LAYOUT = os.path.join(ROOT, "layout.js")

HEADER = """// Placement of each hand-drawn sheet on the Skopje map.
// lat/lon = centre of the sheet, width = sheet width in metres on the ground,
// rot = clockwise rotation in degrees (0 = sheet drawn with north up), z = stacking order.
// This file is rewritten by the viewer's "Edit layout" mode when run with server.py.
window.DEFAULT_LAYOUT = [
"""


def num(v, lo, hi):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or not lo <= v <= hi:
        raise ValueError(f"bad number: {v!r}")
    return v


def render_layout(sheets):
    if not isinstance(sheets, list) or not 1 <= len(sheets) <= 500:
        raise ValueError("expected a list of sheets")
    rows = []
    for s in sheets:
        if not isinstance(s, dict):
            raise ValueError("sheet must be an object")
        sid, name, file = s.get("id"), s.get("name"), s.get("file")
        if not (isinstance(sid, str) and re.fullmatch(r"\d{2}", sid)):
            raise ValueError(f"bad id: {sid!r}")
        if not (isinstance(name, str) and isinstance(file, str) and len(name) < 200 and len(file) < 200):
            raise ValueError("bad name/file")
        lat = round(num(s.get("lat"), -90, 90), 6)
        lon = round(num(s.get("lon"), -180, 180), 6)
        width = round(num(s.get("width"), 10, 100000))
        rot = round(num(s.get("rot"), -360, 360), 1)
        z = int(num(s.get("z", 0), -1e6, 1e6))
        j = lambda v: json.dumps(v, ensure_ascii=False)
        rows.append(f"  {{ id: {j(sid)}, name: {j(name)}, file: {j(file)}, "
                    f"lat: {lat}, lon: {lon}, width: {width}, rot: {rot}, z: {z} }}")
    return HEADER + ",\n".join(rows) + "\n];\n"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        # always fetch fresh layout.js / app.js while editing
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        if self.path != "/api/layout":
            return self.send_error(404)
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > 1_000_000:
                raise ValueError("too large")
            text = render_layout(json.loads(self.rfile.read(length)))
            backup = os.path.join(ROOT, "layout.original.js")
            if not os.path.exists(backup) and os.path.exists(LAYOUT):
                shutil.copy2(LAYOUT, backup)   # one-time copy of the layout before any edits
            fd, tmp = tempfile.mkstemp(dir=ROOT, suffix=".tmp")
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(text)
            os.replace(tmp, LAYOUT)       # atomic: never a half-written layout.js
        except (ValueError, json.JSONDecodeError) as e:
            return self.send_error(400, str(e))
        self.send_response(204)
        self.end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    print(f"Taxi maps: http://localhost:{port}  (Ctrl+C to stop)")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
