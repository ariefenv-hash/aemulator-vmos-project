#!/usr/bin/env python3
"""docx 页脚字段后处理：Roman/arabic 格式开关 + 清除空 pgNumType（WPS 兼容）"""
import zipfile, shutil, re, sys, os

path = sys.argv[1]
tmp = path + '.tmp'
shutil.copy(path, tmp)

zin = zipfile.ZipFile(tmp)
names = zin.namelist()

# 找出 document.xml 中各节引用的 footer id → 判断 Roman(节2) / arabic(节3)
docxml = zin.read('word/document.xml').decode('utf-8')
rels = zin.read('word/_rels/document.xml.rels').decode('utf-8')

# footer rId → file 映射
fmap = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="(footer\d+\.xml)"', rels))

# 逐节找 footerReference
sects = re.findall(r'<w:sectPr.*?</w:sectPr>', docxml, re.S)
sect_footers = []
for s in sects:
    ids = re.findall(r'<w:footerReference[^>]*r:id="(rId\d+)"', s)
    fmt = re.search(r'<w:pgNumType[^>]*w:fmt="([^"]+)"', s)
    sect_footers.append((ids, fmt.group(1) if fmt else None))

roman_files, arabic_files = set(), set()
for ids, fmt in sect_footers:
    for i in ids:
        f = fmap.get(i)
        if not f:
            continue
        if fmt == 'upperRoman':
            roman_files.add('word/' + f)
        elif fmt in ('decimal', None):
            arabic_files.add('word/' + f)

print('Roman footers:', roman_files)
print('Arabic footers:', arabic_files)

out = zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED)
for item in zin.infolist():
    data = zin.read(item.filename)
    if item.filename == 'word/document.xml':
        x = data.decode('utf-8')
        x = x.replace('<w:pgNumType/>', '')
        data = x.encode('utf-8')
    elif item.filename in roman_files:
        x = data.decode('utf-8')
        x = re.sub(r'(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)',
                   r'\1 PAGE \\* ROMAN \\* MERGEFORMAT \2', x)
        data = x.encode('utf-8')
    elif item.filename in arabic_files:
        x = data.decode('utf-8')
        x = re.sub(r'(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)',
                   r'\1 PAGE \\* arabic \\* MERGEFORMAT \2', x)
        data = x.encode('utf-8')
    out.writestr(item, data)
out.close()
zin.close()
os.remove(tmp)
print('footer post-process done')
