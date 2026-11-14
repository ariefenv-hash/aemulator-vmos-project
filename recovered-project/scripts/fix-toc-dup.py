#!/usr/bin/env python3
"""fix-toc-dup.py — 删除 TOC 区域中脚本注入产生的重复首条目段落"""
import re
import shutil
import sys
import zipfile

path = sys.argv[1]
tmp = path + ".tmp"

with zipfile.ZipFile(path, "r") as zin:
    names = zin.namelist()
    doc = zin.read("word/document.xml").decode("utf-8")

    # 找到所有 TOC1/TOC2 样式段落
    para_spans = []
    for m in re.finditer(r"<w:p>(?:(?!</w:p>).)*?</w:p>", doc, re.S):
        seg = m.group(0)
        if 'w:val="TOC1"' in seg or 'w:val="TOC2"' in seg:
            para_spans.append((m.start(), m.end(), seg))

    if len(para_spans) < 2:
        print("TOC 段落不足 2 个，无需处理")
        sys.exit(0)

    # 保留第一个（字段缓存条目），检查第二个是否与第一个文本重复
    first_text = re.search(r"<w:t[^>]*>([^<]*)</w:t>", para_spans[0][2])
    second_text = re.search(r"<w:t[^>]*>([^<]*)</w:t>", para_spans[1][2])
    if first_text and second_text and first_text.group(1).strip() == second_text.group(1).strip():
        s, e, seg = para_spans[1]
        doc = doc[:s] + doc[e:]
        print(f"已删除重复 TOC 条目段落: {first_text.group(1)}")
    else:
        print("第二条目与首条目不重复，仅检查页码缓存")

    # 给 PAGEREF 字段注入缓存页码值（使 LibreOffice 预览也显示页码；Word 更新域后会覆盖）
    doc, n = re.subn(
        r'(<w:instrText[^>]*>PAGEREF _Toc1[^<]*</w:instrText><w:fldChar w:fldCharType="separate"/>)(<w:fldChar w:fldCharType="end"/>)',
        r'\1<w:r><w:t>1</w:t></w:r>\2',
        doc,
    )
    print(f"PAGEREF 缓存页码注入: {n} 处")

    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for name in names:
            if name == "word/document.xml":
                zout.writestr(name, doc)
            else:
                zout.writestr(name, zin.read(name))

shutil.move(tmp, path)
print("OK")
