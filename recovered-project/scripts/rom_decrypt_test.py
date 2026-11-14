#!/usr/bin/env python3
"""Decrypt rom.img header with derived keystream and parse the 7z header info."""
import zipfile, struct, sys

ROM_ZIP = "/home/z/my-project/uploads/user_96C1AFCD7A714C55DE801AAE51EFEBFC_rom_default_12.1.0_1034.zip"

KEYSTREAM = bytes([0x25, 0x7A, 0x38, 0x39, 0x61, 0x56, 0x69, 0x43,
                   0x4D, 0x30, 0x4B, 0x6B, 0x0E, 0x2E, 0xFA, 0x34])

z = zipfile.ZipFile(ROM_ZIP)
with z.open("rom.img") as f:
    head = f.read(65536)

dec = bytes(b ^ KEYSTREAM[i % 16] for i, b in enumerate(head))

magic = dec[:6]
ver = dec[6:8]
crc = struct.unpack("<I", dec[8:12])[0]
next_off = struct.unpack("<Q", dec[12:20])[0]
next_size = struct.unpack("<Q", dec[20:28])[0]
next_crc = struct.unpack("<I", dec[28:32])[0]

print("magic:", magic, "expected 7z:", magic == b"7z\xbc\xaf\x27\x1c")
print("version:", ver.hex())
print("start header crc: %08x" % crc)
print("next header offset:", next_off, " size:", next_size, " crc: %08x" % next_crc)

# verify CRC32 of start header
import zlib
calc = zlib.crc32(dec[12:32]) & 0xFFFFFFFF
print("start header crc32 calc: %08x  ->  match:", hex(calc), calc == crc)

# next header located at 32 + next_off
nh_start = 32 + next_off
nh = dec[nh_start : nh_start + next_size]
print("\n=== next header (first 256 bytes) ===")
print(nh[:256].hex())

# try parse kHeader (0x01) / kEncodedHeader etc.
import io
def parse_props(buf):
    pos = 0
    out = []
    while pos < len(buf):
        t = buf[pos]
        if t == 0x01:  # kHeader
            out.append(("kHeader", buf[pos+1:pos+40].hex()))
            break
        elif t == 0x17:  # kEncodedHeader
            out.append(("kEncodedHeader", buf[pos+1:pos+12].hex()))
            break
        elif t == 0x00:  # kEnd
            out.append(("kEnd", ""))
            pos += 1
            break
        else:
            out.append((hex(t), ""))
            break
    return out

print("props:", parse_props(nh))
