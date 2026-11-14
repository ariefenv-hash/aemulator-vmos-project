#!/usr/bin/env python3
"""Try candidate RC4 keys on the encrypted plugin zips (first 32 bytes)."""
import zipfile, itertools

APK = "/home/z/my-project/uploads/虚拟大师_3.2.67.apk"

def rc4(key: bytes, data: bytes) -> bytes:
    S = list(range(256))
    j = 0
    klen = len(key)
    for i in range(256):
        j = (j + S[i] + key[i % klen]) & 0xFF
        S[i], S[j] = S[j], S[i]
    i = j = 0
    out = bytearray()
    for b in data:
        i = (i + 1) & 0xFF
        j = (j + S[i]) & 0xFF
        S[i], S[j] = S[j], S[i]
        out.append(b ^ S[(S[i] + S[j]) & 0xFF])
    return bytes(out)

z = zipfile.ZipFile(APK)
targets = {}
for name in ["assets/plugins/superuser.zip", "assets/plugins/xposed.zip", "assets/plugins/magisk.zip", "assets/EPIC/Y1bHf.Epic"]:
    targets[name] = z.read(name)[:32]

print("=== cipher heads ===")
for n, d in targets.items():
    print(f"{n}: {d[:16].hex()}")

# candidate keys
candidates = [
    b"Epic_", b"epic", b"EPIC", b"ProtectApp", b"com.clone.android.dual.space",
    b"dual.space", b"vmapp", b"clone.android", b"VirtualMaster", b"virtual master",
    b"Eden", b"eden", b"vm", b"superuser", b"magisk", b"xposed", b"plugin",
    b"asset_protection_rc4_key", b"dex_protection_rc4_key", b"epic_meta_rc4_key",
    b"vm_protection_rc4_key", b"axml_protection_rc4_key",
    b"Epic\x1f", b"e=x", b"c=v2", b"v2", b"vmos", b"VMOS",
]
# also add printable strings 8-24 chars from libEPIC.so .rodata? too many; start with handpicked

for name, cipher in targets.items():
    print(f"\n=== trying keys on {name} ===")
    for key in candidates:
        dec = rc4(key, cipher[:16])
        tag = ""
        if dec[:4] in (b"PK\x03\x04", b"PK\x05\x06"):
            tag = "  <-- ZIP!"
        elif dec[:6] == b"7z\xbc\xaf\x27\x1c":
            tag = "  <-- 7Z!"
        elif dec[:4] == b"\x7fELF":
            tag = "  <-- ELF!"
        elif dec[:3] == b"dex":
            tag = "  <-- DEX!"
        elif dec[:5] == b"Epic_":
            tag = "  <-- EPIC!"
        if tag or all(32 <= c < 127 for c in dec[:8]):
            print(f"key={key!r:40s} -> {dec[:16].hex()}{tag}")
    # also try single-byte XOR sweep for completeness
    for k in range(256):
        dec = bytes(c ^ k for c in cipher[:8])
        if dec[:4] in (b"PK\x03\x04", b"PK\x05\x06") or dec[:6] == b"7z\xbc\xaf\x27\x1c" or dec[:4] == b"\x7fELF" or dec[:3] == b"dex" or dec[:5] == b"Epic_":
            print(f"xor key 0x{k:02x} -> {dec.hex()}")
