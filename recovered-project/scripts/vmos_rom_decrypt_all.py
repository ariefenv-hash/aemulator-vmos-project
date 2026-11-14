#!/usr/bin/env python3
"""用恢复的 XOR 密钥解密 VMOS ROM 包全部文件"""
import os, sys

KEY = bytes.fromhex('257a3839617669434d304b6b62457339')
ROMDIR = '/tmp/rom12'
OUT = '/tmp/rom12/dec'
os.makedirs(OUT, exist_ok=True)

def decrypt(src, dst):
    size = os.path.getsize(src)
    with open(src, 'rb') as f, open(dst, 'wb') as o:
        chunk = 4 * 1024 * 1024
        pos = 0
        while True:
            data = f.read(chunk)
            if not data:
                break
            # 密钥按文件绝对偏移对齐
            off = pos % 16
            keybuf = (KEY[off:] + KEY[:off]) * ((len(data) // 16) + 2)
            o.write(bytes(b ^ k for b, k in zip(data, keybuf)))
            pos += len(data)
    print(f'{src.split("/")[-1]:16s} → {dst}  ({size:,} bytes)')
    return dst

for name in ('rom.img', 'rom1.img', 'magisk.zip', 'superuser.zip'):
    decrypt(f'{ROMDIR}/{name}', f'{OUT}/{name}')

# 验证
print()
for name in ('rom.img', 'rom1.img', 'magisk.zip', 'superuser.zip'):
    with open(f'{OUT}/{name}', 'rb') as f:
        h = f.read(8)
    print(f'{name:16s} 头部: {h.hex()}  {"7z ✓" if h[:6] == bytes.fromhex("377abcaf271c") else "ZIP ✓" if h[:4] == b"PK\x03\x04" else h[:4]}')
