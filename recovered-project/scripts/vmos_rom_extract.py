#!/usr/bin/env python3
"""定向提取 VMOS ROM 关键文件"""
import py7zr, os
# Android rootfs 含绝对路径符号链接（如 /system/bin → /system/bin），
# 放宽 py7zr 安全校验以保留符号链接信息（悬空链接对分析无害）
import py7zr.py7zr as _pz
_pz.is_path_valid = lambda *a, **k: True

OUT = '/tmp/rom12/x'
os.makedirs(OUT, exist_ok=True)

# rom.img 关键目标
rom_targets = [
    'fs/init', 'fs/init.environ.rc',
    'fs/system/build.prop',
    'fs/system/etc/init/hw/init.rc',
    'fs/system/etc/init/hw/init.zygote64_32.rc',
    'fs/system/etc/init/hw/init.zygote64.rc',
    'fs/system/priv-app/vmservice/vmservice.apk',
    'fs/system/etc/selinux/plat_sepolicy.cil',
    'fs/system/etc/selinux/plat_file_contexts',
    'fs/system/etc/selinux/plat_property_contexts',
    'fs/system/etc/selinux/plat_seapp_contexts',
    'fs/system/bin/init',
    'fs/system/bin/app_process64',
    'fs/system/bin/linker64',
    'fs/system/bin/sh',
    'fs/system/bin/ip',
    'fs/system/bin/iptables',
]
print('提取 rom.img ...')
with py7zr.SevenZipFile('/tmp/rom12/dec/rom.img') as z:
    names = {e.filename for e in z.list()}
    real = [t for t in rom_targets if t in names]
    miss = [t for t in rom_targets if t not in names]
    if miss:
        print('  rom.img 中不存在:', miss)
    z.extract(path=OUT, targets=real)
print('  完成:', len(real), '个')

# rom1.img 关键目标
r1_targets = [
    'fs/vendor/etc/selinux/precompiled_sepolicy',
    'fs/vendor/etc/selinux/vendor_sepolicy.cil',
    'fs/vendor/etc/init/hw/init.rc',
    'fs/vendor/build.prop',
    'fs/vendor/lib64/hw/hwcomposer.master.so',
    'fs/vendor/lib64/hw/camera.master.so',
    'fs/vendor/bin/hw/android.hardware.wifi@1.0-service',
]
print('提取 rom1.img ...')
with py7zr.SevenZipFile('/tmp/rom12/dec/rom1.img') as z:
    names1 = {e.filename for e in z.list()}
    real1 = [t for t in r1_targets if t in names1]
    miss1 = [t for t in r1_targets if t not in names1]
    if miss1:
        print('  rom1.img 中不存在:', miss1)
        # 找 vendor/etc 下的 rc
        vrc = [n for n in names1 if n.startswith('fs/vendor/etc/') and (n.endswith('.rc') or '/init' in n)]
        print('  vendor etc rc 候选:', vrc[:20])
        vinit = [n for n in names1 if '/init' in n and n.endswith('.rc')]
        print('  vendor init rc:', vinit[:20])
    z.extract(path=OUT, targets=real1)
print('  完成:', len(real1), '个')
