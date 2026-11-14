#!/usr/bin/env python3
"""VMOS ROM 包 XOR 密钥恢复与验证
已恢复 K[0:12] = 25 7a 38 39 61 76 69 43 4d 30 4b 6b
待定 K[12:16]，通过 7z next-header 结构约束暴力校验
"""
import struct, sys

ROMDIR = '/tmp/rom12'
K12 = bytes.fromhex('257a3839 61766943 4d304b6b'.replace(' ', ''))

def xorr(data, key, offset):
    """data 在文件绝对偏移 offset 处，密钥按绝对偏移对齐"""
    return bytes(b ^ key[(offset + i) % len(key)] for i, b in enumerate(data))

def head(path, n=48):
    with open(path, 'rb') as f:
        return f.read(n)

rom = head(f'{ROMDIR}/rom.img')
rom1 = head(f'{ROMDIR}/rom1.img')
magisk = head(f'{ROMDIR}/magisk.zip')

print('=== 阶段1: 验证 K[0:12] ===')
key12 = K12
p = xorr(rom, key12 + b'\0'*4, 0)
print('rom.img  P[0:12]:', p[:12].hex(), '→ 7z 签名?', p[:6] == bytes.fromhex('377abcaf271c'))
p1 = xorr(rom1, key12 + b'\0'*4, 0)
print('rom1.img P[0:12]:', p1[:12].hex(), '→ 7z 签名?', p1[:6] == bytes.fromhex('377abcaf271c'))
pm = xorr(magisk, key12 + b'\0'*4, 0)
print('magisk.zip P[0:12]:', pm[:12].hex(), '→ PK?', pm[:4] == b'PK\x03\x04')
print('  version=%d flags=0x%x method=%d' % (pm[4] | pm[5]<<8, pm[6] | pm[7]<<8, pm[8] | pm[9]<<8))
print('  fnlen=%d (K[10:12]验证)' % (pm[26] | pm[27]<<8))

print()
print('=== 阶段2: magisk.zip 尾部 EOCD 验证（确定 K[14]、K[15]） ===')
import os
mag_path = f'{ROMDIR}/magisk.zip'
msize = os.path.getsize(mag_path)
# 假设明文是 zip：末尾为 EOCD "PK\x05\x06" + 18 字节固定字段 + 注释长度(常为0)
# EOCD 22 字节：50 4b 05 06 0000 0000 0000 0000 (4×uint16) + <cdsize 4B> <cdofs 4B> <commentlen 2B>
with open(mag_path, 'rb') as f:
    f.seek(msize - 64)
    tail = f.read(64)
# 尝试不同的 EOCD 长度假设（无注释）
for eocd_len in (22,):
    start = len(tail) - eocd_len
    # EOCD 明文首 4 字节 = PK\x05\x06, 末 2 字节 commentlen=0
    # K[(msize-22)%16 .. ]: msize=23933726 → (msize-22)%16 = ?
    base = msize - 22
    # 明文约束: tail[base-base0 ..] 解出 PK0506 ... 0000
    # K 索引对应：绝对偏移 base+j → K[(base+j)%16]
    known_plain = b'PK\x05\x06'
    idxs = [(base + j) % 16 for j in range(4)]
    print(f'EOCD 起始绝对偏移 {base}, mod16 索引 {idxs}')
    # 这些索引中若含 14/15 可直接解出 K[14]/K[15]
    cand = {}
    for j, ki in enumerate(idxs):
        if ki >= 12:
            cand[ki] = tail[start + j] ^ known_plain[j]
    print('  由 EOCD 签名解出的 K[12:16] 项:', {k: hex(v) for k, v in cand.items()})

# 再用「注释长度=0」约束最后两字节
last2_abs = msize - 2
print('最后两字节绝对偏移 mod16:', last2_abs % 16, (last2_abs+1) % 16)
c2 = tail[-2] ^ 0, tail[-1] ^ 0
print('  若注释为空: K[{}] = {:02x} (等待匹配), 原始末2字节: {} {}'.format(
    last2_abs % 16, tail[-2], hex(tail[-2]), hex(tail[-1])))

print()
print('=== 阶段3: K[12:16] 候选 × 7z next-header 结构校验 ===')
C_rom = rom[12:16]
C_rom1 = rom1[12:16]
filesz_rom = os.path.getsize(f'{ROMDIR}/rom.img')
filesz_rom1 = os.path.getsize(f'{ROMDIR}/rom1.img')

def try_parse_7z_header(path, abs_off, key, size=39):
    """在绝对偏移处读取并解密，检查是否为合法 7z properties 流"""
    with open(path, 'rb') as f:
        f.seek(abs_off)
        blob = f.read(size + 8)
    if len(blob) < size:
        return None
    p = xorr(blob, key, abs_off)
    return p

def valid_7z_props(p, size=39):
    """粗校验: 以 01 (kHeader) 开头, 结构可解析"""
    if p[0] != 0x01:
        return False
    # 常见: 01 04 06 ... (MainStreamsInfo) 或 01 04 ... 08 0a 00 ...
    if p[1] not in (0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08):
        return False
    if p[1] == 0x04:
        # MainStreamsInfo: PackInfo(06) UnpackInfo(07) SubStreamsInfo(08) [09 sizes] 00 end
        if p[2] not in (0x06, 0x07, 0x08):
            return False
        if p[2] == 0x06 and p[3] not in (0x00, 0x08, 0x01, 0x02, 0x04):  # PackPos 数字编码首字节
            return False
    return True

results = []
for k14 in range(256):
    key = key12 + bytes([0x62, 0x45, k14, 0x39])
    # rom.img: V_rom = C[12:16] ⊕ K[12:16] (LE32)
    v_rom = struct.unpack('<I', xorr(C_rom, bytes([0x62, 0x45, k14, 0x39]), 12))[0]
    v_rom1 = struct.unpack('<I', xorr(C_rom1, bytes([0x62, 0x45, k14, 0x39]), 12))[0]
    # 合法性: 32+V+39 <= filesize
    ok_rom = 32 + v_rom + 39 <= filesz_rom
    ok_rom1 = 32 + v_rom1 + 39 <= filesz_rom1
    if not (ok_rom and ok_rom1):
        continue
    # 结构校验
    p_rom = try_parse_7z_header(f'{ROMDIR}/rom.img', 32 + v_rom, key)
    p_rom1 = try_parse_7z_header(f'{ROMDIR}/rom1.img', 32 + v_rom1, key)
    if p_rom and p_rom1:
        vr = valid_7z_props(p_rom)
        vr1 = valid_7z_props(p_rom1)
        if vr and vr1:
            results.append((k14, v_rom, v_rom1, p_rom[:20].hex(), p_rom1[:20].hex()))

print('满足两文件结构校验的 K[14] 候选:')
for k14, v_rom, v_rom1, h, h1 in results:
    tail_rom = filesz_rom - (32 + v_rom + 39)
    tail_rom1 = filesz_rom1 - (32 + v_rom1 + 39)
    print(f'  K[14]=0x{k14:02x}: rom off={32+v_rom} tail_slack={tail_rom}, rom1 off={32+v_rom1} tail_slack={tail_rom1}')
    print(f'    rom  header[0:20] = {h}')
    print(f'    rom1 header[0:20] = {h1}')

if not results:
    print('无候选！放宽 K[12:14] 假设，尝试穷举 K[12:16] 中 K15=0x39 已定、K[12:14] 自由')
    # K15=0x39 固定; K12,K13,K14 自由 → 2^24 太大; 用「EOCD 尾部 + extralen=0 + moddate 合理」组合先打印候选
