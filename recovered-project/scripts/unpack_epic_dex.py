#!/usr/bin/env python3
"""Unpack all EPIC-encrypted dex files from the Virtual Master APK."""
import zipfile, os

APK = "/home/z/my-project/uploads/虚拟大师_3.2.67.apk"
OUT = "/home/z/my-project/analysis/epic_dex"
os.makedirs(OUT, exist_ok=True)

z = zipfile.ZipFile(APK)
KEY = 0x46
for name in z.namelist():
    if name.startswith("assets/EPIC/") and name.endswith(".Epic"):
        data = z.read(name)
        dec = bytes(b ^ KEY for b in data)
        magic = dec[:8]
        out_name = name.split("/")[-1].replace(".Epic", "") + ".dex"
        ok = magic.startswith(b"dex\n")
        with open(os.path.join(OUT, out_name), "wb") as f:
            f.write(dec)
        print(f"{name}: {len(dec):,} bytes -> {out_name} magic={magic!r} {'OK' if ok else 'FAIL'}")

print("\ndone")
