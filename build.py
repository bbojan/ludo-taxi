#!/usr/bin/env python3
"""Build the static site into dist/ for GitHub Pages (or any static host).

Copies only what the page loads, and adds ?v=<hash> to the CSS/JS links in
index.html so browsers pick up a new deploy instead of a cached old file.

    python3 build.py             # writes dist/
    python3 build.py out         # writes out/

Preview the result with:  python3 -m http.server 8000 --directory dist
"""
import hashlib
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, sys.argv[1] if len(sys.argv) > 1 else "dist")

FILES = ["index.html", "style.css", "app.js", "fun.js", "layout.js", "layout.claude.js", "favicon.svg", "logo.svg", "social.png"]
SHEET = re.compile(r"\d{2}(-s)?\.jpg|all-originals\.zip")


def short_hash(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()[:10]


def main():
    zip_path = os.path.join(ROOT, "sheets", "all-originals.zip")
    if not os.path.exists(zip_path):
        subprocess.run([sys.executable, os.path.join(ROOT, "make_zip.py")], check=True)

    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, "sheets"))

    for name in FILES:
        shutil.copy2(os.path.join(ROOT, name), os.path.join(OUT, name))

    shutil.copytree(os.path.join(ROOT, "projects"), os.path.join(OUT, "projects"))   # About dialog thumbnails

    sheets = sorted(n for n in os.listdir(os.path.join(ROOT, "sheets")) if SHEET.fullmatch(n))
    for name in sheets:
        shutil.copy2(os.path.join(ROOT, "sheets", name), os.path.join(OUT, "sheets", name))

    # cache-bust the CSS and scripts referenced from index.html
    index = os.path.join(OUT, "index.html")
    with open(index, encoding="utf-8") as f:
        html = f.read()
    for name in ["style.css", "app.js", "fun.js", "layout.js", "layout.claude.js"]:
        v = short_hash(os.path.join(ROOT, name))
        html, n = re.subn(rf'(\b(?:src|href)="){re.escape(name)}"', rf'\g<1>{name}?v={v}"', html)
        if n != 1:
            sys.exit(f"build: expected one reference to {name} in index.html, found {n}")
    with open(index, "w", encoding="utf-8") as f:
        f.write(html)

    # GitHub Pages: serve files as-is, no Jekyll processing
    open(os.path.join(OUT, ".nojekyll"), "w").close()

    size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs)
    print(f"Built {os.path.relpath(OUT, ROOT)}/: {len(FILES)} files + {len(sheets)} in sheets/, {size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
