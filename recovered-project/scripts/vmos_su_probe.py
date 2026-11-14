#!/usr/bin/env python3
"""superuser.zip 加密格式分析"""
import os, math

def entropy(b):
    if not b:
        return 0
    freq = [0] * 256
    for x in b:
        freq[x] += 1
    n = len(b)
    return -sum((c / n) * math.log2(c / n) for c in freq if c)

ROM = '/tmp/rom12'
f = f'{ROM}/superuser.zip'
size = os.path.getsize(f)
print(f'superuser.zip 大小: {size:,}')

with open(f, 'rb') as fp:
    data = fp.read()

# 分段熵
print('分段熵 (0=纯文本 8=随机):')
for off in range(0, min(size, 0x200000), 0x40000):
    seg = data[off:off + 0x40000]
    print(f'  {off:#09x}: {entropy(seg):.3f}')

# 全文签名扫描:找任何已知 magic
magics = {
    b'PK\x03\x04': 'ZIP local', b'PK\x01\x02': 'CD', b'PK\x05\x06': 'EOCD',
    b'\x7fELF': 'ELF', b'\x53\xef': 'ext4 sb?', b'hsqs': 'squashfs LE',
    b'qshh': 'squashfs BE', b'070701': 'cpio newc', b'\x89PNG': 'PNG',
    b'\x1f\x8b': 'gzip', b'ustar': 'tar', b'BZh': 'bzip2', b'\x28\xb5\x2f\xfd': 'zstd',
}
print('\n已知 magic 扫描:')
found = 0
for m, name in magics.items():
    start = 0
    cnt = 0
    while cnt < 5:
        i = data.find(m, start)
        if i < 0:
            break
        print(f'  {name} @ {i:#x}')
        start = i + 1
        cnt += 1
        found += 1
if not found:
    print('  （未发现任何已知 magic — 全文加密或压缩）')

# RC4 测试:用已恢复的 XOR key 作为 RC4 key
def rc4(key, data):
    S = list(range(256))
    j = 0
    out = bytearray()
    for i in range(256):
        j = (j + S[i] + key[i % len(key)]) & 0xFF
        S[i], S[j] = S[j], S[i]
    i = j = 0
    for b in data:
        i = (i + 1) & 0xFF
        j = (j + S[i]) & 0xFF
        S[i], S[j] = S[j], S[i]
        out.append(b ^ S[(S[i] + S[j]) & 0xFF])
    return bytes(out)

K = bytes.fromhex('257a3839617669434d304b6b62457339')
for name, key in [
    ('xor-key-as-rc4', K),
    ('xor-key-ascii-as-rc4', b'%z89aviCM0KkbEs9'),
    ('epic', b'Epic'), ('epic_rc4', b'epic_rc4'),
    ('asset', b'asset'), ('superuser', b'superuser'), ('vmos', b'vmos'),
]:
    head = rc4(key, data[:16])
    mark = 'ZIP!' if head[:4] == b'PK\x03\x04' else ('7z!' if head[:6] == bytes.fromhex('377abcaf271c') else head[:8].hex())
    print(f'RC4[{name}]: {mark}')
