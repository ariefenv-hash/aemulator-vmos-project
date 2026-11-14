#!/usr/bin/env python3
"""最小 7z 头解析器：解析 VMOS rom.img/rom1.img 的打包流布局"""
import struct, sys

class NumReader:
    """7z 变长数字解码"""
    def __init__(self, data):
        self.d = data
        self.p = 0
    def num(self):
        first = self.d[self.p]; self.p += 1
        # 7z 变长数字: 前导 1 的个数 k 表示后跟 k 个字节
        # 值 = (first & mask) << (8*k) | Σ b[j] << (8*(k-1-j))  （大端续字节）
        k = 0
        for bit in range(7, -1, -1):
            if first & (1 << bit):
                k += 1
            else:
                break
        if k == 8:
            raise ValueError('bad number')
        if k == 0:
            return first
        mask = (0xFF >> k)
        v = (first & mask) << (8 * k)
        for j in range(k):
            v |= self.d[self.p + j] << (8 * (k - 1 - j))
        self.p += k
        return v

def parse_next_header(path):
    fsz = __import__('os').path.getsize(path)
    with open(path, 'rb') as f:
        f.seek(12)
        crc_start = f.read(20)
        f.seek(fsz - 64)
        tail = f.read(64)
    # 签名头: 8字节签名+版本, 4字节 StartHeaderCRC, 然后是 20 字节 start header:
    # NextHeaderOffset(8) NextHeaderSize(8) NextHeaderCRC(4)
    # 但注意 start header 位于偏移 12..31
    with open(path, 'rb') as f:
        f.seek(0)
        hdr = f.read(32)
    nh_off = struct.unpack('<Q', hdr[12:20])[0]
    nh_size = struct.unpack('<Q', hdr[20:28])[0]
    print(f'{path}: NextHeaderOffset={nh_off:,} Size={nh_size} abs={32+nh_off:,} file={fsz:,}')
    with open(path, 'rb') as f:
        f.seek(32 + nh_off)
        nh = f.read(nh_size)
    return nh

def parse_streams_info(d, label):
    p = 0
    print(f'--- {label} ---')
    while p < len(d):
        b = d[p]; p += 1
        if b == 0x00:
            print('  00 END'); break
        elif b == 0x06:
            r = NumReader(d[p:]); pos = r.num(); p += r.p
            r = NumReader(d[p:]); nps = r.num(); p += r.p
            print(f'  06 PackInfo: packPos={pos:,} numStreams={nps}')
            sizes = []
            for _ in range(nps):
                r = NumReader(d[p:]); sizes.append(r.num()); p += r.p
            print(f'     packSizes={[f"{s:,}" for s in sizes]}')
            while p < len(d) and d[p] == 0x09:
                p += 1
                r = NumReader(d[p:]); p += r.p
                print('     (kPad)')
        elif b == 0x07:
            p += 1  # 0x0B kFolder
            r = NumReader(d[p:]); nf = r.num(); p += r.p
            ext = d[p]; p += 1
            print(f'  07 UnpackInfo: folders={nf} external={ext}')
            for fi in range(nf):
                nc = d[p]; p += 1
                print(f'    folder{fi}: numCoders={nc}')
                for ci in range(nc):
                    flags = d[p]; p += 1
                    idlen = flags & 0x0F
                    cid = d[p:p+idlen]; p += idlen
                    is_complex = flags & 0x10
                    attrs = flags & 0x20
                    print(f'      coder id={cid.hex()} complex={bool(is_complex)} attrs={attrs:#04x}')
                    if is_complex:
                        r = NumReader(d[p:]); nin = r.num(); p += r.p
                        r = NumReader(d[p:]); nout = r.num(); p += r.p
                        print(f'        inStreams={nin} outStreams={nout}')
                    if attrs:
                        propsize = d[p]; p += 1
                        props = d[p:p+propsize]; p += propsize
                        print(f'        props={props.hex()}')
                # out streams: unpack sizes
                for oi in range(1 if not is_complex else nout):
                    r = NumReader(d[p:]); us = r.num(); p += r.p
                    print(f'      unpackSize={us:,}')
                if attrs:
                    has_crc = d[p]; p += 1
                    print(f'      hasCrc={has_crc}')
                    if has_crc:
                        crc = d[p:p+4]; p += 4
                        print(f'      crc={crc.hex()}')
            # unpacksizes 可能在外部
        elif b == 0x08:
            p += 1
            print('  08 SubStreamsInfo')
            # 粗略跳过: numunpackstreams / sizes / crcs 直到 00
            while p < len(d) and d[p] != 0x00:
                p += 1
            p += 1
        else:
            print(f'  ?? 未知属性 {b:#04x} @ {p-1}')
            break
    return d

if __name__ == '__main__':
    for f in sys.argv[1:]:
        nh = parse_next_header(f)
        print('  next-header 明文:', nh.hex())
        parse_streams_info(nh[1:], f.split('/')[-1])  # 跳过 0x17 kEncodedHeader
        print()
