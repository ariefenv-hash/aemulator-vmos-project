#!/usr/bin/env python3
"""Post-process report docx: patch footer PAGE fields (ROMAN/arabic) and strip empty pgNumType."""
import re, shutil, sys, zipfile, os

path = sys.argv[1]
tmp = path + ".tmp"
shutil.copy(path, tmp)

zin = zipfile.ZipFile(tmp, "r")
names = zin.namelist()

# document.xml: find section order -> footer rIds per section
doc = zin.read("word/document.xml").decode("utf-8")

# 1) remove empty pgNumType (cover section)
doc2 = re.sub(r"<w:pgNumType/>", "", doc)

# 2) map footers: identify footer files referenced by each section in order
sect_footers = re.findall(r'<w:footerReference w:type="default" r:id="(rId\d+)"/>', doc2)
rels = zin.read("word/_rels/document.xml.rels").decode("utf-8")
rid2file = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="(footer\d+\.xml)"', rels))

footer_files = [rid2file[r] for r in sect_footers if r in rid2file]
# section order: TOC section (roman) first, then body (arabic); cover has no footer
fmts = ["ROMAN"] + ["arabic"] * max(0, len(footer_files) - 1)

out = zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED)
for n in names:
    data = zin.read(n)
    if n == "word/document.xml":
        data = doc2.encode("utf-8")
    else:
        m = re.match(r"word/(footer\d+\.xml)$", n)
        if m and m.group(1) in footer_files:
            fx = data.decode("utf-8")
            fmt = fmts[footer_files.index(m.group(1))]
            fx = re.sub(r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
                        rf"\1 PAGE \\* {fmt} \\* MERGEFORMAT \2", fx)
            data = fx.encode("utf-8")
    out.writestr(n, data)
out.close(); zin.close(); os.remove(tmp)
print("footer files:", footer_files, "formats:", fmts)
print("pgNumType removed:", doc.count("<w:pgNumType/>") - doc2.count("<w:pgNumType/>"))
