#!/usr/bin/env python3
"""Inspect the VMOS ROM package: entry flags, encryption, magic bytes."""
import zipfile, struct, sys, os

ROM = "/home/z/my-project/uploads/user_96C1AFCD7A714C55DE801AAE51EFEBFC_rom_default_12.1.0_1034.zip"

z = zipfile.ZipFile(ROM)
print("=== entries ===")
for i in z.infolist():
    enc = "ENCRYPTED" if i.flag_bits & 0x1 else "plain"
    comp = {zipfile.ZIP_STORED: "stored", zipfile.ZIP_DEFLATED: "deflate"}.get(i.compress_type, str(i.compress_type))
    print(f"  {i.filename:20s} size={i.file_size:>12,} csize={i.compress_size:>12,} flag=0x{i.flag_bits:04x} {enc} {comp}")

print("\n=== archive comment ===")
print(repr(z.comment[:500]))

print("\n=== try read manifest.json ===")
try:
    data = z.read("manifest.json")
    print(data.decode("utf-8", errors="replace"))
except Exception as e:
    print("READ FAILED:", type(e).__name__, e)

print("\n=== try read first 512 bytes of rom.img ===")
try:
    with z.open("rom.img") as f:
        head = f.read(512)
    print("first 64 bytes:", head[:64].hex())
    print("ascii:", repr(head[:64]))
except Exception as e:
    print("READ FAILED:", type(e).__name__, e)

print("\n=== try read first 256 bytes of rom1.img ===")
try:
    with z.open("rom1.img") as f:
        head = f.read(256)
    print("first 64 bytes:", head[:64].hex())
    print("ascii:", repr(head[:64]))
except Exception as e:
    print("READ FAILED:", type(e).__name__, e)

print("\n=== try read magisk.zip head ===")
try:
    with z.open("magisk.zip") as f:
        head = f.read(256)
    print("first 64 bytes:", head[:64].hex())
    print("ascii:", repr(head[:64]))
except Exception as e:
    print("READ FAILED:", type(e).__name__, e)

print("\n=== try read superuser.zip head ===")
try:
    with z.open("superuser.zip") as f:
        head = f.read(256)
    print("first 64 bytes:", head[:64].hex())
    print("ascii:", repr(head[:64]))
except Exception as e:
    print("READ FAILED:", type(e).__name__, e)

# local header check for rom.img (raw bytes on disk, find its offset)
print("\n=== raw local header check ===")
with open(ROM, "rb") as f:
    f.seek(0)
    sig = f.read(4)
    print("file starts with:", sig.hex(), "(PK\\x03\\x04 =", b"\x50\x4b\x03\x04".hex(), ")")
