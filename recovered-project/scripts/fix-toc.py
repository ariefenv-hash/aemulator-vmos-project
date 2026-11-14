#!/usr/bin/env python3
"""TOC repair for the AEmulator report:
1. Ensure every Heading1/2 paragraph has a _Toc bookmark (add if missing).
2. Inside the TOC <w:sdt>, drop ALL existing entry paragraphs and rebuild
   hyperlink+PAGEREF entries (with cached page numbers) for every heading.
"""
import re, shutil, sys, zipfile, os
from lxml import etree

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

def q(tag): return f"{{{W}}}{tag}"

path = sys.argv[1]
pages = {
  "一、执行摘要": "1", "二、背景与升级目标": "1", "2.1 参照对象的真身确认": "1",
  "2.2 AEmulator 现状与四项升级目标": "2", "三、实施依据与方法": "2",
  "四、实现一：应用导入失败的修复": "2", "4.1 根因定位": "2", "4.2 修复方案": "3",
  "五、实现二：Root 体系与超级用户开关管理": "3", "5.1 总体架构": "3",
  "5.2 授权策略与超级用户面板": "3", "六、实现三：Xposed 模块管理与兼容标记": "4",
  "七、安卓 15 AOSP GSI 基线的适配说明": "5", "八、构建验证与交付物": "5",
  "8.1 验证结果": "5", "8.2 交付物清单": "5", "九、已知限制与第二阶段路线": "6",
  "十、结论与建议": "6",
}

zin = zipfile.ZipFile(path, "r")
doc = etree.fromstring(zin.read("word/document.xml"))

# 1) bookmarks on headings
bmid = 900000
headings = []  # (level, text, bm)
for para in doc.iter(q("p")):
    ppr = para.find(q("pPr"))
    if ppr is None: continue
    ps = ppr.find(q("pStyle"))
    if ps is None: continue
    m = re.match(r"Heading([12])$", ps.get(q("val"), ""))
    if not m: continue
    text = "".join(t.text or "" for t in para.iter(q("t"))).strip()
    if not text: continue
    if para.find(q("bookmarkStart")) is None:
        b = etree.Element(q("bookmarkStart")); b.set(q("id"), str(bmid)); b.set(q("name"), f"_Toc{bmid}")
        e = etree.Element(q("bookmarkEnd")); e.set(q("id"), str(bmid))
        ppr.addnext(b); para.append(e)
        bmid += 1
    bs = para.find(q("bookmarkStart"))
    headings.append((int(m.group(1)), text, bs.get(q("name"))))
print("headings with bookmarks:", len(headings))

# 2) rebuild TOC entries inside the sdt (identified by its alias)
sdt_content = None
for sdt in doc.iter(q("sdt")):
    alias = sdt.find(f"{q('sdtPr')}/{q('alias')}")
    if alias is not None and alias.get(q("val")) == "Table of Contents":
        sdt_content = sdt.find(q("sdtContent")); break
assert sdt_content is not None, "TOC sdt not found"

children = list(sdt_content)
# locate field paragraph (contains instrText TOC) and the end paragraph (fldChar end, no instr TOC)
field_para = next(p for p in children if p.find(f".//{q('instrText')}") is not None and "TOC" in (p.find(f".//{q('instrText')}").text or ""))
# strip leftover cached-entry runs inside the field paragraph: keep runs up to the separate fldChar
seen_sep = False
for r in list(field_para):
    if r.tag == q("r") and any(fc.get(q("fldCharType")) == "separate" for fc in r.iter(q("fldChar"))):
        seen_sep = True
        continue
    if seen_sep:
        field_para.remove(r)
# drop every entry paragraph after field_para except the final end-para
end_para = None
for p in reversed(children):
    if any(fc.get(q("fldCharType")) == "end" for fc in p.iter(q("fldChar"))) and p.find(f".//{q('instrText')}") is None:
        end_para = p; break
idx_f = children.index(field_para); idx_e = children.index(end_para)
for el in children[idx_f + 1:idx_e]:
    sdt_content.remove(el)

insert_at = idx_f + 1
for level, text, bm in headings:
    p = etree.Element(q("p"))
    ppr = etree.SubElement(p, q("pPr"))
    ps = etree.SubElement(ppr, q("pStyle")); ps.set(q("val"), f"TOC{level}")
    if level >= 2:
        ind = etree.SubElement(ppr, q("ind")); ind.set(q("left"), "360")
    tabs = etree.SubElement(ppr, q("tabs")); tab = etree.SubElement(tabs, q("tab"))
    tab.set(q("val"), "right"); tab.set(q("leader"), "dot"); tab.set(q("pos"), "8788")
    sp = etree.SubElement(ppr, q("spacing")); sp.set(q("before"), "120"); sp.set(q("after"), "60")

    h = etree.SubElement(p, q("hyperlink")); h.set(q("anchor"), bm); h.set(q("history"), "1")
    r1 = etree.SubElement(h, q("r")); t1 = etree.SubElement(r1, q("t")); t1.text = text
    r2 = etree.SubElement(h, q("r")); etree.SubElement(r2, q("tab"))
    rb = etree.SubElement(h, q("r")); etree.SubElement(rb, q("fldChar")).set(q("fldCharType"), "begin")
    ri = etree.SubElement(h, q("r")); it = etree.SubElement(ri, q("instrText"))
    it.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    it.text = f" PAGEREF {bm} \\h "
    rs = etree.SubElement(h, q("r")); etree.SubElement(rs, q("fldChar")).set(q("fldCharType"), "separate")
    rp = etree.SubElement(h, q("r")); tp = etree.SubElement(rp, q("t")); tp.text = pages.get(text, "1")
    re_ = etree.SubElement(h, q("r")); etree.SubElement(re_, q("fldChar")).set(q("fldCharType"), "end")

    sdt_content.insert(insert_at, p); insert_at += 1
print("rebuilt TOC entries:", len(headings))

tmp = path + ".tmp"
with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as out:
    for n in zin.namelist():
        out.writestr(n, etree.tostring(doc, xml_declaration=True, encoding="UTF-8", standalone=True) if n == "word/document.xml" else zin.read(n))
zin.close()
os.remove(path)
shutil.move(tmp, path)
print("OK")
