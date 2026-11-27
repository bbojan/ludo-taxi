#!/usr/bin/env python3
"""Pack all original scans from input/ into sheets/all-originals.zip.

Files are stored unchanged (no recompression) under their original Cyrillic names,
so the ZIP opens correctly on macOS, Windows and Linux.

    python3 make_zip.py
"""
import os
import re
import unicodedata
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "input")
OUT = os.path.join(ROOT, "sheets", "all-originals.zip")
FOLDER = "Лудо Такси - мапи на Скопје"


def number(name):
    m = re.match(r"(\d+)", name)
    return int(m.group(1)) if m else 10**6


files = sorted((f for f in os.listdir(SRC) if f.lower().endswith(".jpg")), key=number)
tmp = OUT + ".tmp"
with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_STORED) as z:
    for f in files:
        # macOS stores names decomposed (NFD); use composed (NFC) so ѓ/ќ show right on Windows
        arc = f"{FOLDER}/{unicodedata.normalize('NFC', f)}"
        z.write(os.path.join(SRC, f), arc)
os.replace(tmp, OUT)
print(f"{len(files)} files -> {os.path.relpath(OUT, ROOT)} ({os.path.getsize(OUT) / 1e6:.1f} MB)")
