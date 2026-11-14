#!/usr/bin/env python3
"""Fully decrypt rom.img / rom1.img from the VMOS ROM zip into 7z files."""
import zipfile, sys, os

ROM_ZIP = "/home/z/my-project/uploads/user_96C1AFCD7A714C55DE801AAE51EFEBFC_rom_default_12.1.0_1034.zip"
KEYSTREAM = bytes.fromhex("257a3839617669434d304b6b62457339")
OUT_DIR = "/home/z/my-project/extracted"
os.makedirs(OUT_DIR, exist_ok=True)

def decrypt_entry(z, name, out_path):
    total = 0
    klen = len(KEYSTREAM)
    with z.open(name) as fin, open(out_path, "wb") as fout:
        base = 0
        while True:
            chunk = fin.read(8 * 1024 * 1024)
            if not chunk:
                break
            fout.write(bytes(b ^ KEYSTREAM[(base + i) % klen] for i, b in enumerate(chunk)))
            base += len(chunk)
            total += base
            print(f"\r{name}: {total:,} bytes decrypted", end="", flush=True)
    print()
    return total

z = zipfile.ZipFile(ROM_ZIP)
name = sys.argv[1]
out = os.path.join(OUT_DIR, name.replace(".img", ".7z"))
n = decrypt_entry(z, name, out)
print(f"OK {name} -> {out} ({n:,} bytes)")
