#!/usr/bin/env python3
"""Renumber all sheets 1..N in Macedonian Cyrillic alphabetical order of their names.

    python3 tools/renumber.py --dry     # show the mapping only
    python3 tools/renumber.py           # do it

Updates, keeping every sheet's name, position, size and rotation:
  layout.js, layout.claude.js      id and the number at the start of `file`
  sheets/NN.jpg, sheets/NN-s.jpg   renamed to the new number
  input/<n> <name>.jpg             renamed to the new number
  tools/control_points.json        keys moved to the new number
  sheets/all-originals.zip         rebuilt
Writes tools/renumber-<time>.json with the old -> new mapping.
Reload every open map page afterwards: an old page would save its old numbers back.
"""
import json
import os
import re
import subprocess
import sys
import time
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MK = "абвгдѓежзѕијклљмнњопрстќуфхцчџш"     # same order as the viewer's sheet list
ROW = re.compile(r'\{ id: "(\d{2})", name: ("(?:[^"\\]|\\.)*"), file: ("(?:[^"\\]|\\.)*")')


def key(name):
    out = []
    for ch in unicodedata.normalize("NFC", name).lower():
        i = MK.find(ch)
        out.append(chr(0x100 + i) if i >= 0 else (" " if ch in " ," else ch))
    return "".join(out)


def nfc(s):
    return unicodedata.normalize("NFC", s)


def main():
    dry = "--dry" in sys.argv
    layout_path = os.path.join(ROOT, "layout.js")
    rows = [(m.group(1), json.loads(m.group(2)), json.loads(m.group(3)))
            for m in ROW.finditer(open(layout_path, encoding="utf-8").read())]
    order = sorted(rows, key=lambda r: key(r[1]))
    mapping = {old: f"{i + 1:02d}" for i, (old, _, _) in enumerate(order)}
    for old, name, _ in order:
        print(f"{int(old):>2} -> {int(mapping[old]):>2}  {name}")
    if dry:
        return
    if all(o == n for o, n in mapping.items()):
        print("already in order")
        return

    # 1. layout files: id and the leading number of `file`
    def fix(text):
        def sub(m):
            old = m.group(1)
            new = mapping[old]
            file = re.sub(r"^\d+ ", f"{int(new)} ", json.loads(m.group(3)))
            return f'{{ id: "{new}", name: {m.group(2)}, file: {json.dumps(file, ensure_ascii=False)}'
        return ROW.sub(sub, text)

    for fn in ("layout.js", "layout.claude.js"):
        p = os.path.join(ROOT, fn)
        if os.path.exists(p):
            text = open(p, encoding="utf-8").read()
            new = fix(text)
            # keep rows in the new numeric order
            head, body = new.split("[", 1)
            body, tail = body.rsplit("]", 1)
            lines = [l for l in body.strip("\n").split("\n") if l.strip()]
            lines = [l.rstrip(",") for l in lines]
            lines.sort(key=lambda l: re.search(r'id: "(\d{2})"', l).group(1))
            open(p, "w", encoding="utf-8").write(head + "[\n" + ",\n".join(lines) + "\n]" + tail)
            print(f"{fn} renumbered")

    # 2. files, in two steps so no name is overwritten mid-way
    sheets, inp = os.path.join(ROOT, "sheets"), os.path.join(ROOT, "input")
    moves = []
    for old, new in mapping.items():
        for suffix in (".jpg", "-s.jpg"):
            moves.append((os.path.join(sheets, old + suffix), os.path.join(sheets, new + suffix)))
    for f in os.listdir(inp):
        m = re.match(r"(\d+) (.*)", nfc(f))
        if m and f"{int(m.group(1)):02d}" in mapping:
            new = mapping[f"{int(m.group(1)):02d}"]
            moves.append((os.path.join(inp, f), os.path.join(inp, f"{int(new)} {m.group(2)}")))
    tmp = [(src, src + ".renumber-tmp", dst) for src, dst in moves if src != dst]
    for src, t, _ in tmp:
        os.rename(src, t)
    for _, t, dst in tmp:
        os.rename(t, dst)
    print(f"{len(tmp)} files renamed")

    # 3. control points
    cp = os.path.join(ROOT, "tools", "control_points.json")
    if os.path.exists(cp):
        d = json.load(open(cp, encoding="utf-8"))
        d = {mapping.get(k, k): v for k, v in d.items()}
        json.dump(dict(sorted(d.items())), open(cp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("control_points.json renumbered")

    # 4. mapping record + ZIP
    rec = os.path.join(ROOT, "tools", time.strftime("renumber-%Y%m%d-%H%M%S.json"))
    json.dump({"old_to_new": mapping, "names": {mapping[o]: n for o, n, _ in rows}},
              open(rec, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("mapping saved to", os.path.relpath(rec, ROOT))
    subprocess.run([sys.executable, os.path.join(ROOT, "make_zip.py")], check=True)


if __name__ == "__main__":
    main()
