#!/usr/bin/env python3
"""Derive and verify keystream for rom.img / rom1.img via 7z known-plaintext."""
import zipfile, struct, zlib, sys

ROM_ZIP = "/home/z/my-project/uploads/user_96C1AFCD7A714C55DE801AAE51EFEBFC_rom_default_12.1.0_1034.zip"
z = zipfile.ZipFile(ROM_ZIP)

MAGIC = b"7z\xbc\xaf\x27\x1c" + b"\x00\x04"  # signature + version 0.4

def analyze(name, size):
    with z.open(name) as f:
        head = f.read(64)
        f.seek(size - 64)
        tail = f.read(64)
    data = head
    # K[0..7] from magic
    K = bytearray(16)
    for i in range(8):
        K[i] = data[i] ^ MAGIC[i]
    print(f"=== {name} (size={size:,}) ===")
    print("K[0..7] =", bytes(K[0:8]).hex())
    # plain[16..19] = 0 (NextHeaderOffset high 4B) -> K[16..19]=K[0..3] must equal cipher[16..19]
    c1619 = data[16:20]
    print("K0..3 =", bytes(K[0:4]).hex(), " cipher[16..19] =", c1619.hex(),
          "-> P=16 consistent:", bytes(K[0:4]) == c1619)
    # NextHeaderOffset = size - 32 - NextHeaderSize ; NextHeaderSize unknown yet.
    # But K[8..11] = cipher[24..27] (NextHeaderSize high 4B = 0)
    K[8:12] = data[24:28]
    print("K[8..11] =", bytes(K[8:12]).hex())
    # try: NextHeaderSize = cipher[20..23] XOR K[4..7]
    size_bytes = bytes(data[20 + i] ^ K[(4 + i) % 16] for i in range(4))
    nh_size = struct.unpack("<I", size_bytes)[0]
    print("NextHeaderSize guess:", nh_size, size_bytes.hex())
    # NextHeaderOffset = filesize - 32 - nh_size
    off = size - 32 - nh_size
    print("NextHeaderOffset guess:", off, hex(off))
    ob = struct.pack("<I", off & 0xFFFFFFFF)
    # K[12..15] from plain[12..15] (offset low 4B)
    for i in range(4):
        K[12 + i] = data[12 + i] ^ ob[i]
    print("K[12..15] =", bytes(K[12:16]).hex())
    ks = bytes(K)
    # verify StartHeaderCRC
    dec = bytes(b ^ ks[i % 16] for i, b in enumerate(head))
    stored_crc = struct.unpack("<I", dec[8:12])[0]
    calc = zlib.crc32(dec[12:32]) & 0xFFFFFFFF
    print("StartHeaderCRC stored=%08x calc=%08x match=%s" % (stored_crc, calc, stored_crc == calc))
    # magic check
    print("decrypted magic:", dec[:8].hex(), "-> 7z ok:", dec[:8] == MAGIC)
    # read NextHeader (39 bytes at 32+off) from tail region
    with z.open(name) as f:
        f.seek(32 + off)
        nh_enc = f.read(nh_size)
    nh = bytes(b ^ ks[(32 + off + i) % 16] for i, b in enumerate(nh_enc))
    print("NextHeader bytes:", nh.hex())
    print("NextHeaderCRC stored=%08x calc=%08x" % (
        struct.unpack("<I", dec[28:32])[0], zlib.crc32(nh) & 0xFFFFFFFF))
    return ks

k0 = analyze("rom.img", 233815955)
print("\nROM.IMG KEYSTREAM:", k0.hex())
print()
# rom1.img: same derivation; K1[0..7] should equal K0[0..7]
import io
with z.open("rom1.img") as f:
    pass
k1 = analyze("rom1.img", 278213975)
print("\nROM1.IMG KEYSTREAM:", k1.hex())
