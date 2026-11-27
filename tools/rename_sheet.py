#!/usr/bin/env python3
"""Rename a sheet everywhere: display name and original file name.

    python3 tools/rename_sheet.py 01 "Населба Лисиче"

- layout.js and layout.claude.js: `name` and `file` of that sheet (positions untouched)
- input/: the original scan is renamed to "<number> <name in lower case, no commas>.jpg"
- sheets/all-originals.zip is rebuilt (make_zip.py)
The sheets/NN.jpg copies keep their numbers, so nothing else changes.
Reload any open map page afterwards, otherwise its next save writes the old name back.
"""
import json
import os
import re
import subprocess
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sid, new_name = sys.argv[1], unicodedata.normalize("NFC", sys.argv[2].strip())
if not re.fullmatch(r"\d{2}", sid) or not new_name:
    sys.exit("usage: rename_sheet.py NN \"New name\"")
num = str(int(sid))
new_file = f"{num} {new_name.lower().replace(',', '')}.jpg"
new_file = re.sub(r"\s+", " ", new_file)

# 1. original scan in input/
inp = os.path.join(ROOT, "input")
old = [f for f in os.listdir(inp) if re.match(rf"{num} ", unicodedata.normalize("NFC", f))]
if len(old) != 1:
    sys.exit(f"expected one input file starting with '{num} ', found {old}")
if unicodedata.normalize("NFC", old[0]) != new_file:
    if os.path.exists(os.path.join(inp, new_file)):
        sys.exit(f"input/{new_file} already exists")
    os.rename(os.path.join(inp, old[0]), os.path.join(inp, new_file))
print(f"input/{old[0]}  ->  input/{new_file}")

# 2. layout files: only the name and file of this sheet
row = re.compile(r'(\{ id: "' + sid + r'", name: )("(?:[^"\\]|\\.)*")(, file: )("(?:[^"\\]|\\.)*")')
for fn in ("layout.js", "layout.claude.js"):
    path = os.path.join(ROOT, fn)
    if not os.path.exists(path):
        continue
    text = open(path, encoding="utf-8").read()
    j = lambda v: json.dumps(v, ensure_ascii=False)
    new_text, n = row.subn(lambda m: m.group(1) + j(new_name) + m.group(3) + j(new_file), text)
    if n != 1:
        sys.exit(f"{fn}: sheet {sid} not found")
    open(path, "w", encoding="utf-8").write(new_text)
    print(f"{fn}: sheet {sid} name = {new_name}, file = {new_file}")

# 3. download-all ZIP
subprocess.run([sys.executable, os.path.join(ROOT, "make_zip.py")], check=True)
