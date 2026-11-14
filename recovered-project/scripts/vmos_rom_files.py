#!/usr/bin/env python3
"""列出 rom.img 中与 root/兼容性相关的关键文件"""
import py7zr, sys

with py7zr.SevenZipFile('/tmp/rom12/dec/rom.img') as z:
    entries = z.list()

dirs = {e.filename for e in entries if e.is_directory}
files = [e for e in entries if not e.is_directory]

def show(title, pred, limit=60):
    print(f'=== {title} ===')
    hits = [f for f in files if pred(f.filename)]
    for f in hits[:limit]:
        print(f'  {f.uncompressed:>10,}  {f.filename}')
    if len(hits) > limit:
        print(f'  ... 共 {len(hits)} 个')
    print()

show('su / magisk / superuser 二进制',
     lambda n: any(k in n.lower() for k in ('bin/su', '/su', 'magisk', 'superuser', 'busybox')))
show('init & rc 脚本',
     lambda n: ('/init' in n or n.endswith('.rc') or n.endswith('.sh')) and '/oat/' not in n)
show('属性 & SELinux',
     lambda n: n.endswith('.prop') or 'sepolicy' in n or 'selinux' in n or 'build.prop' in n)
show('bin 下的小工具 (root 常用)',
     lambda n: n.startswith('fs/system/bin/') and f.uncompressed < 200000 if False else
               (n.startswith('fs/system/bin/') and not n.startswith('fs/system/bin/oat')),
     200)
show('vmservice / vm 相关',
     lambda n: 'vm' in n.lower().split('/')[-1] or 'vmservice' in n)
