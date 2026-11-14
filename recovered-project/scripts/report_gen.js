// Generate the VMOS/Virtual Master reverse-engineering + AEmulator migration report (docx)
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, TableLayoutType,
  WidthType, BorderStyle, ShadingType, AlignmentType, HeadingLevel, Header, Footer,
  PageNumber, NumberFormat, SectionType, TableOfContents, PageBreak, VerticalAlign,
} = require("docx");
const fs = require("fs");
const P1 = require("./report_content_p1.js");
const P2 = require("./report_content_p2.js");

// ---------- Palette: Dawn Mist Tech (cool/light/active) ----------
const PAL = {
  primary: "0A1628", body: "1A2B40", secondary: "6878A0",
  accent: "5B8DB8", surface: "F4F8FC",
  cover: {
    bg: "0A1628", titleColor: "FFFFFF", subtitleColor: "B8C8DC",
    metaColor: "D5DFEA", accent: "6FA3CE", footerColor: "8FA8C4",
  },
};

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ---------- Cover helpers (from design-system.md) ----------
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."\uff0c\u3002\u3001\uff1b\uff1a\uff01\uff1f", ..."\u7684\u4e0e\u548c\u53ca\u4e4b\u5728\u4e8e\u4e3a", ..."-_\u2014\u2013\u00b7/", ..." \t"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) {
      breakAt = charsPerLine;
      const prevChar = remaining[breakAt - 1], nextChar = remaining[breakAt];
      if (prevChar && nextChar && !breakAfter.has(prevChar) && !breakAfter.has(nextChar) &&
          /[\u4e00-\u9fff]/.test(prevChar) && /[\u4e00-\u9fff]/.test(nextChar)) breakAt -= 1;
    }
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}

function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 20;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLines(title, charsPerLine(minPt));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0 } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

// ---------- Cover Recipe R1 (Pure Paragraph Left) ----------
function buildCoverR1(config) {
  const P = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "), size: 18, color: P.accent,
        font: { ascii: "Calibri", eastAsia: "SimHei" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true, color: P.titleColor,
        font: { eastAsia: "SimHei", ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: P.subtitleColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: P.metaColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: P.footerColor, font: { ascii: "Arial", eastAsia: "Microsoft YaHei" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: P.footerColor, font: { ascii: "Arial", eastAsia: "Microsoft YaHei" } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders,
        verticalAlign: VerticalAlign.TOP,
        children,
      })],
    })],
  })];
}

// ---------- Body builders ----------
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: PAL.primary,
      font: { eastAsia: "SimHei", ascii: "Times New Roman" } })],
  });
}

function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 312, after: 60 },
    children: [new TextRun({ text, size: 24, color: "000000",
      font: { eastAsia: "SimSun", ascii: "Times New Roman" } })],
  });
}

function tableBlock(t) {
  const els = [];
  els.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 160, after: 100, line: 312 },
    keepNext: true,
    children: [new TextRun({ text: t.caption, bold: true, size: 21, color: PAL.primary,
      font: { eastAsia: "SimHei", ascii: "Times New Roman" } })],
  }));
  const mkCell = (text, isHeader) => new TableCell({
    shading: { type: ShadingType.CLEAR, fill: isHeader ? PAL.primary : "FFFFFF" },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { line: 312 },
      children: [new TextRun({ text, bold: isHeader, size: 20,
        color: isHeader ? "FFFFFF" : "1A2B40",
        font: { eastAsia: isHeader ? "SimHei" : "SimSun", ascii: "Times New Roman" } })],
    })],
  });
  els.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 8, color: PAL.accent },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: PAL.accent },
      left: { style: BorderStyle.SINGLE, size: 2, color: "C9D6E4" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "C9D6E4" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "C9D6E4" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "C9D6E4" },
    },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true,
        children: t.header.map((h) => mkCell(h, true)) }),
      ...t.rows.map((r, idx) => new TableRow({ cantSplit: true,
        children: r.map((cell) => mkCell(cell, false)) })),
    ],
  }));
  els.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  return els;
}

function chapter(ch) {
  const els = [h1(ch.title)];
  for (const p of ch.paras) els.push(body(p));
  if (ch.table) els.push(...tableBlock(ch.table));
  return els;
}

function pageNumFooter() {
  return new Footer({ children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: PAL.secondary, font: { ascii: "Times New Roman" } })],
  })] });
}

function docHeader() {
  return new Header({ children: [new Paragraph({
    alignment: AlignmentType.RIGHT,
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: PAL.accent, space: 4 } },
    children: [new TextRun({ text: "Virtual Master \u9006\u5411\u5206\u6790\u4e0e AEmulator \u8fc1\u79fb\u65b9\u6848", size: 16, color: PAL.secondary,
      font: { eastAsia: "SimSun", ascii: "Times New Roman" } })],
  })] });
}

// ---------- Assemble ----------
const coverConfig = {
  title: "Virtual Master \u9006\u5411\u5206\u6790\u62a5\u544a\u4e0e AEmulator Root/Xposed \u8fc1\u79fb\u65b9\u6848",
  subtitle: "\u5b89\u5353\u5957\u5a03\u865a\u62df\u5316\u67b6\u6784\u3001ROM \u52a0\u5bc6\u683c\u5f0f\u7834\u89e3\u4e0e Root/\u6a21\u5757\u4f53\u7cfb\u5b8c\u6574\u8fd8\u539f",
  englishLabel: "REVERSE ENGINEERING REPORT",
  metaLines: [
    "\u5206\u6790\u5bf9\u8c61\uff1aVirtual Master - Android Clone 3.2.67\uff08com.clone.android.dual.space\uff09",
    "\u914d\u5957 ROM\uff1aAndroid 12.1.0 \u901a\u5237\u5305\uff08rom_default_12.1.0_1034\uff09",
    "\u76ee\u6807\u5e73\u53f0\uff1aAEmulator\uff08uxazu/AEmulator\uff09+ Android 15 AOSP GSI",
    "\u62a5\u544a\u65e5\u671f\uff1a2026 \u5e74 11 \u6708",
  ],
  footerLeft: "\u4ec5\u4f9b\u6280\u672f\u7814\u7a76\u4e0e\u5b66\u4e60\u4ea4\u6d41\u4f7f\u7528",
  footerRight: "Generated with Z.ai",
  palette: PAL.cover,
};

// Abstract + TOC section (Roman numerals)
const frontMatter = [];
frontMatter.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 240, after: 240 },
  children: [new TextRun({ text: "\u6458  \u8981", bold: true, size: 32, color: PAL.primary,
    font: { eastAsia: "SimHei", ascii: "Times New Roman" } })],
}));
for (const p of P1.abstractText) frontMatter.push(body(p));
frontMatter.push(new Paragraph({ children: [new PageBreak()] }));
frontMatter.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 480, after: 360 },
  children: [new TextRun({ text: "\u76ee  \u5f55", bold: true, size: 32, color: PAL.primary,
    font: { eastAsia: "SimHei", ascii: "Times New Roman" } })],
}));
frontMatter.push(new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }));
frontMatter.push(new Paragraph({
  spacing: { before: 200 },
  children: [new TextRun({
    text: "\u6ce8\uff1a\u672c\u76ee\u5f55\u7531\u57df\u4ee3\u7801\u751f\u6210\u3002\u5982\u9875\u7801\u672a\u66f4\u65b0\uff0c\u8bf7\u5728 Word/WPS \u4e2d\u53f3\u952e\u70b9\u51fb\u76ee\u5f55\u5e76\u9009\u62e9\u201c\u66f4\u65b0\u57df\u201d\u3002",
    italics: true, size: 18, color: "888888", font: { eastAsia: "SimSun", ascii: "Times New Roman" } })],
}));

// Body content
const bodyChildren = [];
for (const ch of [P1.ch1, P1.ch2, P1.ch3, P1.ch4, P2.ch5, P2.ch6, P2.ch7, P2.ch8, P2.ch9]) {
  bodyChildren.push(...chapter(ch));
}
bodyChildren.push(h1(P2.appendix.title));
for (const p of P2.appendix.paras) bodyChildren.push(body(p));

const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const doc = new Document({
  creator: "Z.ai",
  title: "Virtual Master \u9006\u5411\u5206\u6790\u62a5\u544a\u4e0e AEmulator Root/Xposed \u8fc1\u79fb\u65b9\u6848",
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimSun" }, size: 24, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
    },
  },
  features: { updateFields: true },
  sections: [
    { // Section 1: cover
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1(coverConfig),
    },
    { // Section 2: abstract + TOC, Roman numerals
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin,
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      headers: { default: docHeader() },
      footers: { default: pageNumFooter() },
      children: frontMatter,
    },
    { // Section 3: body, Arabic numerals restart at 1
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin,
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: docHeader() },
      footers: { default: pageNumFooter() },
      children: bodyChildren,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = "/home/z/my-project/download/VirtualMaster\u9006\u5411\u5206\u6790\u4e0eAEmulator\u8fc1\u79fb\u65b9\u6848.docx";
  fs.writeFileSync(out, buf);
  console.log("WROTE", out, buf.length, "bytes");
});
