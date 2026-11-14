#!/usr/bin/env python3
"""去除 TOC 字段段落内残留的 docx-js 缓存条目（避免与占位符条目重复）"""
import zipfile, shutil, re, sys, os

path = sys.argv[1]
tmp = path + '.tmp'
shutil.copy(path, tmp)
zin = zipfile.ZipFile(tmp)
out = zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED)

for item in zin.infolist():
    data = zin.read(item.filename)
    if item.filename == 'word/document.xml':
        x = data.decode('utf-8')
        # sdt 内第一个字段段落: 含 fldCharType="separate" 且同段落含 hyperlink _TocN
        # 该段落结构: <w:p>(无 TOC pStyle) <w:r>begin</w:r><w:r>instrText</w:r><w:r>separate</w:r><w:hyperlink _TocN>...</w:hyperlink></w:p>
        m = re.search(
            r'(<w:fldChar w:fldCharType="separate"/></w:r>)<w:hyperlink [^>]*w:anchor="_Toc\d+"[^>]*>.*?</w:hyperlink>(</w:p>)',
            x, re.S)
        if m:
            x = x[:m.start()] + m.group(1) + m.group(2) + x[m.end():]
            print('removed docx-js cached TOC entry (duplicate)')
        else:
            print('no cached entry found (nothing to dedupe)')
        data = x.encode('utf-8')
    out.writestr(item, data)
out.close()
zin.close()
os.remove(tmp)
print('dedupe done')
