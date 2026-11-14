#!/usr/bin/env python3
"""从 libEPIC.so 提取 protection key 相关数据"""
import re

data = open('/home/z/my-project/analysis/lib/arm64-v8a/libEPIC.so', 'rb').read()
print(f'libEPIC.so 大小: {len(data):,}')

names = [
    'dex_protection_rc4_key', 'dex_protection_xor_key',
    'epic_meta_rc4_key', 'epic_meta_xor_key',
    'vm_protection_rc4_key', 'vm_protection_xor_key',
    'asset_protection_rc4_key', 'asset_protection_xor_key',
    'axml_protection_rc4_key', 'axml_protection_xor_key',
    'resource_string_protection_rc4_key', 'resource_string_protection_xor_key',
]

for n in names:
    nb = n.encode()
    idxs = []
    start = 0
    while True:
        i = data.find(nb, start)
        if i < 0:
            break
        idxs.append(i)
        start = i + 1
    for i in idxs:
        # 字符串前后各取 80 字节
        lo, hi = max(0, i - 96), min(len(data), i + len(nb) + 96)
        ctx = data[lo:hi]
        printable = ''.join(chr(b) if 32 <= b < 127 else '.' for b in ctx)
        print(f'{n} @ {i:#x}:')
        print(f'  hex: {ctx.hex()}')
        print(f'  asc: {printable}')
        print()
