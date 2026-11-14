#!/usr/bin/env python3
"""Inspect the decrypted 7z rootfs: list key entries, extract a few small ones."""
import py7zr, sys, os

OUT = "/home/z/my-project/extracted/peek"
os.makedirs(OUT, exist_ok=True)

def find_entries(z, *keywords, limit=40):
    res = []
    for f in z.list():
        n = f.filename.lower()
        if any(k in n for k in keywords):
            res.append(f)
            if len(res) >= limit:
                break
    return res

with py7zr.SevenZipFile("/home/z/my-project/extracted/rom.7z") as z:
    print("=== init scripts ===")
    for f in find_entries(z, "init.rc", "init.zygote", "init.usb", "ueventd", "init.environ"):
        print("  ", f.filename, f.uncompressed)
    print("=== su / daemonsu / magisk ===")
    for f in find_entries(z, "/su", "daemonsu", "magisk", "superuser", "xposed", limit=60):
        print("  ", f.filename, f.uncompressed)
    print("=== build.prop / default.prop ===")
    for f in find_entries(z, "build.prop", "default.prop"):
        print("  ", f.filename, f.uncompressed)
    print("=== system/bin top ===")
    for f in find_entries(z, "system/bin/su", "system/bin/init", "system/bin/app_process", "system/bin/linker", limit=20):
        print("  ", f.filename, f.uncompressed)
    print("=== system/etc/init (hw) ===")
    for f in find_entries(z, "system/etc/init/hw", limit=30):
        print("  ", f.filename, f.uncompressed)
