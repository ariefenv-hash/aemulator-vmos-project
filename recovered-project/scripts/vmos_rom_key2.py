#!/usr/bin/env python3
"""VMOS ROM XOR 密钥最终恢复：用 magisk.zip EOCD 结构解 K[14]、K[15]"""
import os, struct

ROMDIR = '/tmp/rom12'
K12 = bytes.fromhex('257a3839' '61766943' '4d304b6b' '6245')  # 14 字节已定

mag_path = f'{ROMDIR}/magisk.zip'
msize = os.path.getsize(mag_path)
with open(mag_path, 'rb') as f:
    f.seek(msize - 64)
    tail = f.read(64)

def dec_at(abs_off, n, key_prefix):
    """解密文件绝对偏移处的 n 字节（密钥按绝对偏移对齐），K[14:16] 未知时用 None 占位"""
    out = []
    for i in range(n):
        j = abs_off + i
        ki = j % 16
        if ki < 14:
            out.append(tail[j - (msize-64)] ^ key_prefix[ki])
        else:
            out.append(None)
    return out

# EOCD 位于 msize-22
eocd_abs = msize - 22
tail_base = msize - 64

# 已知密钥段: K[0:14]（前14字节）
Kp = K12
def dec(abs_off, n):
    r = []
    for i in range(n):
        j = abs_off + i
        ki = j % 16
        r.append(tail[j - tail_base] ^ Kp[ki] if ki < 14 else None)
    return r

print('=== EOCD 字段逐个解密 ===')
print('签名 @%d (mod16 8..11):' % eocd_abs, bytes(dec(eocd_abs, 4)).hex(), '应为 504b0506')
disk = dec(eocd_abs + 4, 4)          # disk_num, disk_cd  (mod16 12,13,14,15)
print('disk_num/disk_cd:', [hex(b) if b is not None else '?' for b in disk])
ent_disk = dec(eocd_abs + 8, 2)      # mod16 14,15 → 未知密钥
ent_total = dec(eocd_abs + 10, 2)    # mod16 0,1 → 已知
print('entries_disk(密):', [hex(b) if b is not None else '?' for b in ent_disk])
print('entries_total(明):', [hex(b) if b is not None else '?' for b in ent_total])
cd_size = dec(eocd_abs + 12, 4)      # mod16 4..7 已知
cd_offs = dec(eocd_abs + 16, 4)      # mod16 8..11 已知
cd_size_v = struct.unpack('<H', bytes(cd_size[:2]))[0] | (struct.unpack('<H', bytes(cd_size[2:]))[0] << 16)
cd_offs_v = struct.unpack('<H', bytes(cd_offs[:2]))[0] | (struct.unpack('<H', bytes(cd_offs[2:]))[0] << 16)
et = struct.unpack('<H', bytes(ent_total))[0]
print(f'cd_size = 0x{cd_size_v:x} ({cd_size_v}), cd_offset = 0x{cd_offs_v:x} ({cd_offs_v}), entries_total = {et}')

# 修正 mod16 布局: msize ≡ 14 (mod 16)
# EOCD+4,5 disk_num     ≡ 12,13  → K12,K13（已验=0）
# EOCD+6,7 disk_cd      ≡ 14,15  → K14,K15（单盘 zip 应为 0）
# EOCD+8,9 entries_disk ≡ 0,1    → 已知密钥（=33 ✓）
c_disk_cd_lo = tail[eocd_abs + 6 - tail_base]
c_disk_cd_hi = tail[eocd_abs + 7 - tail_base]
k14 = c_disk_cd_lo  # disk_cd_start = 0x0000
k15 = c_disk_cd_hi
print(f'→ 由 disk_cd_start=0 推出 K[14] = 0x{k14:02x}, K[15] = 0x{k15:02x}')
ed = tail[eocd_abs+8-tail_base] ^ Kp[0] | ((tail[eocd_abs+9-tail_base] ^ Kp[1]) << 8)
print(f'   交叉验证 entries_disk = {ed} 应等于 entries_total {et}')

KEY = Kp + bytes([k14, k15])
print('完整 16 字节密钥:', KEY.hex())
print('ASCII:', ''.join(chr(b) if 32 <= b < 127 else '.' for b in KEY))

# 自校验: cd_offset + cd_size + 22(+comment) 应 = msize
calc = cd_offs_v + cd_size_v + 22
print(f'自校验: {cd_offs_v} + {cd_size_v} + 22 = {calc} vs 文件大小 {msize} → {"✓" if calc == msize else "差 " + str(msize - calc)}')

# 用完整密钥解密 magisk.zip 开头 160 字节看完整目录结构
with open(mag_path, 'rb') as f:
    f.seek(0)
    m0 = f.read(160)
pt = bytes(b ^ KEY[(i) % 16] for i, b in enumerate(m0))
print()
print('=== magisk.zip 明文前 160 字节解析 ===')
off = 0
while off < 96:
    if pt[off:off+4] == b'PK\x03\x04':
        fn = pt[off+30:off+30 + (pt[off+26] | pt[off+27]<<8)]
        cs = struct.unpack('<I', pt[off+18:off+22])[0]
        us = struct.unpack('<I', pt[off+22:off+26])[0]
        t = pt[off+10] | pt[off+11]<<8; d = pt[off+12] | pt[off+13]<<8
        hh, mm = t>>11, (t>>5)&63; yy, mo, dd = 1980+(d>>9), (d>>5)&15, d&31
        print(f'  @{off}: "{fn.decode(errors="replace")}" method={pt[off+8]|pt[off+9]<<8} csize={cs} usize={us} {yy}-{mo:02d}-{dd:02d} {hh:02d}:{mm:02d}')
        off = off + 30 + (pt[off+26] | pt[off+27]<<8) + (pt[off+28] | pt[off+29]<<8) + cs
    else:
        print(f'  @{off}: 非本地头 {pt[off:off+4].hex()}')
        off += 4

# 中央目录签名强验证: cd_offset 处应为 PK\x01\x02
# cd_offset ≡ 13 (mod16) → 签名 4 字节落在 K[13],K[14],K[15],K[0]
with open(mag_path, 'rb') as f:
    f.seek(cd_offs_v)
    cdb = f.read(64)
p_cd = bytes(b ^ KEY[(cd_offs_v + i) % 16] for i, b in enumerate(cdb))
print()
print('=== 中央目录首条目验证（独立确定 K[14],K[15]） ===')
print('CD 签名:', p_cd[:4].hex(), '→ PK\x01\x02?', p_cd[:4] == b'PK\x01\x02')
cfn_len = p_cd[46] | p_cd[47] << 8
print('首条 CD 文件名:', p_cd[46:46+cfn_len])
print('  （本地头首条目名应为 data/，若一致则密钥完全正确）')

# 验证 rom.img / rom1.img 的 next-header
print()
print('=== rom.img / rom1.img next-header 校验 ===')
for name in ('rom.img', 'rom1.img'):
    p = f'{ROMDIR}/{name}'
    fs = os.path.getsize(p)
    with open(p, 'rb') as f:
        f.seek(12); c = f.read(4)
    v = struct.unpack('<I', bytes(a ^ b for a, b in zip(c, KEY[12:16])))[0]
    slack = fs - 32 - v - 39
    with open(p, 'rb') as f:
        f.seek(32 + v); blob = f.read(48)
    pb = bytes(b ^ KEY[(32 + v + i) % 16] for i, b in enumerate(blob))
    print(f'{name}: next_hdr@{32+v} slack={slack} 明文[0:24]={pb[:24].hex()}')
    print(f'  首字节=0x{pb[0]:02x} (01=kHeader {"✓" if pb[0]==1 else "✗"})')
