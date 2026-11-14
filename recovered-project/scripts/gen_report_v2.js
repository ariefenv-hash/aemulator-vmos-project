/* 虚拟大师逆向分析报告 v2 —— ROM 包 + Root 方案 + 兼容架构 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Header, Footer,
  AlignmentType, HeadingLevel, PageNumber, BorderStyle, WidthType, ShadingType,
  TableLayoutType, SectionType, NumberFormat, TableOfContents, PageBreak, VerticalAlign,
} = require("docx");
const fs = require("fs");

/* ---------- 调色板 DS-1 Deep Sea ---------- */
const PAL = {
  bg: "0B1C2C", primary: "0B1C2C", accent: "529286",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "529286", headerText: "FFFFFF", accentLine: "529286", innerLine: "BECFCC", surface: "E8ECEB" },
};

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { ...noBorders, insideHorizontal: NB, insideVertical: NB };

/* ---------- 封面工具函数 ---------- */
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."\uff0c\u3002\u3001\uff1b\uff1a\uff01\uff1f", ..."\u7684\u4e0e\u548c\u53ca\u4e4b\u5728\u4e8e\u4e3a", ..."-_\u2014\u2013\u00b7/", ..." \t", ..."\uff08\uff09()"]);
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
  if (lines.length >= 2 && lines[lines.length - 1].length === 1) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}

function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / (pt * 20));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) { lines = splitTitleLines(title, charsPerLine(minPt)); titlePt = minPt; }
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
  const safeRemaining = Math.max(usableHeight - contentHeight, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45), rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, bottomSpacing };
}

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
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true,
        color: P.cover.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: P.cover.subtitleColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: P.cover.metaColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: P.cover.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: P.cover.footerColor, font: { ascii: "Arial" } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders, children })],
    })],
  })];
}

/* ---------- 正文构件（Profile A: SimHei 标题 / SimSun 正文 / Times EN） ---------- */
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: "000000", font: { eastAsia: "SimHei", ascii: "Times New Roman" } })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 30, color: "000000", font: { eastAsia: "SimHei", ascii: "Times New Roman" } })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 220, after: 100, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: "000000", font: { eastAsia: "SimHei", ascii: "Times New Roman" } })],
  });
}
function body(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 312, after: opts.after ?? 60 },
    children: [new TextRun({ text, size: 24, color: "000000", font: { eastAsia: "SimSun", ascii: "Times New Roman" } })],
  });
}
function bodyRuns(runs, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 312, after: opts.after ?? 60 },
    children: runs.map(r => new TextRun({ size: 24, color: "000000", font: { eastAsia: r.bold ? "SimHei" : "SimSun", ascii: "Times New Roman" }, ...r, bold: !!r.bold, font: r.mono ? { ascii: "Consolas", eastAsia: "SimSun" } : undefined })),
  });
}
function mono(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: 480 },
    spacing: { line: 312, after: opts.after ?? 40 },
    shading: { type: ShadingType.CLEAR, fill: "F2F4F6" },
    children: [new TextRun({ text, size: 20, color: "1A2B40", font: { ascii: "Consolas", eastAsia: "SimSun" } })],
  });
}
function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER, keepNext: true,
    spacing: { before: 160, after: 80, line: 312 },
    children: [new TextRun({ text, size: 21, bold: true, color: "000000", font: { eastAsia: "SimHei", ascii: "Times New Roman" } })],
  });
}
function tbl(headers, rows, widths) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: PAL.table.accentLine };
  const inner = { style: BorderStyle.SINGLE, size: 2, color: PAL.table.innerLine };
  const mkCell = (text, isHeader, w, i) => new TableCell({
    width: w ? { size: w, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    shading: { type: ShadingType.CLEAR, fill: isHeader ? PAL.table.headerBg : (i % 2 === 1 ? PAL.table.surface : "FFFFFF") },
    children: [new Paragraph({
      alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { line: 312 },
      children: [new TextRun({ text, size: isHeader ? 21 : 20, bold: isHeader,
        color: isHeader ? PAL.table.headerText : "000000",
        font: { eastAsia: isHeader ? "SimHei" : "SimSun", ascii: "Times New Roman" } })],
    })],
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: { top: border, bottom: border, left: inner, right: inner, insideHorizontal: inner, insideVertical: inner },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((t, j) => mkCell(t, true, widths?.[j], 0)) }),
      ...rows.map((r, i) => new TableRow({ cantSplit: true, children: r.map((t, j) => mkCell(t, false, widths?.[j], i)) })),
    ],
  });
}
function pageNumFooter() {
  return new Footer({ children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "505050", font: { ascii: "Times New Roman" } })],
  })] });
}
function docHeader() {
  return new Header({ children: [new Paragraph({
    alignment: AlignmentType.RIGHT,
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: PAL.table.innerLine, space: 4 } },
    children: [new TextRun({ text: "VMOS \u9006\u5411\u5206\u6790\u62a5\u544a v2", size: 16, color: "8090A0", font: { eastAsia: "SimSun", ascii: "Times New Roman" } })],
  })] });
}

/* ---------- 正文内容 ---------- */
const bodyChildren = [];

/* ============ 一、分析背景与结论总览 ============ */
bodyChildren.push(h1("\u4e00\u3001\u5206\u6790\u80cc\u666f\u4e0e\u7ed3\u8bba\u603b\u89c8"));
bodyChildren.push(body("\u672c\u62a5\u544a\u662f\u5bf9\u7528\u6237\u63d0\u4f9b\u7684\u865a\u62df\u5927\u5e08\uff08VMOS\uff09\u7834\u89e3\u7248 3.2.67 APK \u4e0e\u5176\u914d\u5957 Android 12 ROM \u6570\u636e\u5305\u7684\u5168\u91cf\u9006\u5411\u5206\u6790\u3002\u5206\u6790\u76ee\u6807\u6709\u4e24\u4e2a\uff1a\u5176\u4e00\uff0c\u641e\u6e05\u8be5\u8f6f\u4ef6\u5728\u7528\u6237\u6001\u4e0b\u5b9e\u73b0 root \u7684\u5b8c\u6574\u65b9\u6848\uff1b\u5176\u4e8c\uff0c\u641e\u6e05\u5b83\u5728\u5b89\u5353\u7cfb\u7edf\u4e0a\u518d\u5957\u4e00\u5c42\u5b89\u5353\u7cfb\u7edf\uff08Android-on-Android\uff09\u7684\u517c\u5bb9\u673a\u5236\u3002\u5206\u6790\u7ed3\u679c\u5c06\u7528\u4e8e\u4e3a\u5f00\u6e90\u9879\u76ee AEmulator \u7684 adb shell \u6b8b\u7f3a\u95ee\u9898\u4e0e root \u7ba1\u7406\u80fd\u529b\u63d0\u4f9b\u53ef\u843d\u5730\u7684\u53c2\u8003\u65b9\u6848\u3002"));
bodyChildren.push(body("\u672c\u8f6e\u5206\u6790\u7684\u6838\u5fc3\u589e\u91cf\u662f\u5b8c\u6210\u4e86 ROM \u5206\u53d1\u5305\u7684\u52a0\u5bc6\u4f53\u7cfb\u7834\u89e3\uff1a\u5b98\u65b9\u5206\u53d1\u7684 rom.img\u3001rom1.img\u3001magisk.zip \u5747\u4ee5 16 \u5b57\u8282\u5faa\u73af\u5f02\u6216\u52a0\u5bc6\uff0c\u672c\u6b21\u901a\u8fc7\u5df2\u77e5\u660e\u6587\u653b\u51fb\u5b8c\u6574\u6062\u590d\u51fa\u5bc6\u94a5\u5e76\u5168\u91cf\u89e3\u5bc6\uff0c\u62ff\u5230\u4e86\u5b8c\u6574\u7684 Android 12 \u6839\u6587\u4ef6\u7cfb\u7edf\u6811\u4e0e\u5b98\u65b9 Magisk v27.0 \u5237\u5165\u5305\uff0c\u4ece\u800c\u4f7f root \u65b9\u6848\u4ece\u63a8\u6d4b\u5347\u7ea7\u4e3a\u5b9e\u8bc1\u3002"));
bodyChildren.push(bodyRuns([
  { text: "\u7ed3\u8bba\u4e00\uff08root\uff09\uff1a", bold: true },
  { text: "VMOS \u4e0d\u81ea\u7814 root\uff0c\u800c\u662f\u968f ROM \u5206\u53d1\u5b98\u65b9 Magisk v27.0\uff08\u7f16\u53f7 27000\uff0c\u6784\u5efa\u53f7 2c6adbc6\uff09\u5b8c\u6574\u5237\u5165\u5305\uff0c\u5305\u542b magiskd \u5b88\u62a4\u8fdb\u7a0b\u3001su \u53ef\u6267\u884c\u4f53\u3001magiskpolicy\u3001busybox \u4e0e Magisk Manager \u5e94\u7528\u3002\u5176 root \u80fd\u529b\u7684\u672c\u8d28\u662f\u5bb9\u5668\u5185\u6240\u6709\u8fdb\u7a0b\u5171\u4eab\u5bbf\u4e3b\u5e94\u7528\u7684 Linux uid\uff0c\u5bb9\u5668\u8fd0\u884c\u65f6\uff08libkr \u5185\u6838\u63a5\u53e3\u5e93\uff09\u5bf9\u8bbf\u5ba2\u5185\u8fdb\u7a0b\u62e6\u622a\u4f2a\u9020 uid=0\uff0c\u4ece\u800c\u8ba9 magiskd \u4ee5\u5bb9\u5668\u5185 root \u8eab\u4efd\u63d0\u4f9b su \u6388\u6743\u3002" },
]));
bodyChildren.push(bodyRuns([
  { text: "\u7ed3\u8bba\u4e8c\uff08\u517c\u5bb9\uff09\uff1a", bold: true },
  { text: "VMOS \u4e0d\u8dd1\u7b2c\u4e8c\u5185\u6838\uff0c\u4e5f\u4e0d\u7528 QEMU \u6307\u4ee4\u6a21\u62df\uff0c\u800c\u662f\u628a\u5b8c\u6574\u7684 AOSP 12 \u7528\u6237\u6001\uff08init\u3001zygote\u3001system_server\u3001adbd\u3001toybox\uff09\u4ee5\u76ee\u5f55\u6811\u5f62\u5f0f\u653e\u8fdb\u5bbf\u4e3b\u5e94\u7528\u79c1\u6709\u76ee\u5f55\u4e0b\u7684 vm/vm<id>/fs\uff0c\u518d\u7531 libkrloader \u5f15\u5bfc\u5668 + \u5206\u7248\u672c\u7684 libkr64.11/.12 \u5185\u6838\u63a5\u53e3\u5e93\uff0c\u501f\u52a9 linker \u547d\u540d\u7a7a\u95f4\u4e0e shadowhook \u8def\u5f84\u91cd\u5b9a\u5411\uff0c\u8ba9 guest \u8fdb\u7a0b\u5728\u5bbf\u4e3b\u5185\u6838\u4e0a\u4ee5\u72ec\u7acb\u7cfb\u7edf\u7684\u5f62\u6001\u8fd0\u884c\u3002\u5b83\u80fd\u517c\u5bb9\u5927\u591a\u6570\u539f\u751f\u56fa\u4ef6\u7684\u5173\u952e\uff0c\u5728\u4e8e guest \u62e5\u6709\u771f\u5b9e\u5b8c\u6574\u7684\u7528\u6237\u6001\u6808\u800c\u4e0d\u662f\u6b8b\u7f3a\u7684\u6a21\u62df\u73af\u5883\u3002" },
]));
bodyChildren.push(bodyRuns([
  { text: "\u7ed3\u8bba\u4e09\uff08\u53ef\u501f\u9274\u6027\uff09\uff1a", bold: true },
  { text: "AEmulator \u7684 adb shell \u6b8b\u7f3a\u95ee\u9898\uff0c\u672c\u8d28\u662f\u7f3a\u5c11\u4e00\u5957\u5b8c\u6574\u7684\u7528\u6237\u6001\u670d\u52a1\u6808\uff1bVMOS \u7684\u505a\u6cd5\u8bc1\u660e\uff0c\u5728\u4e0d\u9700\u8981 root \u5bbf\u4e3b\u8bbe\u5907\u7684\u524d\u63d0\u4e0b\uff0c\u53ea\u8981\u628a\u5b8c\u6574 rootfs + \u5f15\u5bfc\u94fe + su \u7ba1\u7406\u4e09\u4ef6\u4e8b\u505a\u9f50\uff0c\u5bb9\u5668\u5185\u5c31\u80fd\u62e5\u6709\u771f\u6b63\u53ef\u7528\u7684 root shell\u3002\u5177\u4f53\u53ef\u64cd\u4f5c\u7684\u501f\u9274\u65b9\u6848\u89c1\u7b2c\u516d\u7ae0\u3002" },
]));

/* ============ 二、ROM 分发格式与加密体系破解 ============ */
bodyChildren.push(h1("\u4e8c\u3001ROM \u5206\u53d1\u683c\u5f0f\u4e0e\u52a0\u5bc6\u4f53\u7cfb\u7834\u89e3"));
bodyChildren.push(h2("2.1 \u5206\u53d1\u534f\u8bae\u4e0e manifest.json"));
bodyChildren.push(body("\u7528\u6237\u4e0a\u4f20\u7684 ROM \u6570\u636e\u5305\u4e3a 537,330,178 \u5b57\u8282\u7684 ZIP \u5bb9\u5668\uff0c\u5185\u542b 5 \u4e2a\u6587\u4ef6\u3002\u5305\u5185 manifest.json \u662f\u6574\u4e2a\u5206\u53d1\u4f53\u7cfb\u7684\u5165\u53e3\uff0c\u5b83\u58f0\u660e\u4e86 ROM \u7248\u672c\u3001\u67b6\u6784\u652f\u6301\u8303\u56f4\u3001\u5404\u7ec4\u4ef6\u7684\u4e0b\u8f7d\u53c2\u6570\uff0c\u5176\u4e2d e=x \u6807\u8bb0\u52a0\u5bc6\u3001c=v2 \u6807\u8bb0\u5bb9\u5668\u538b\u7f29\u683c\u5f0f\u7248\u672c\u3002"));
bodyChildren.push(caption("\u8868 2-1  ROM \u6570\u636e\u5305\u6587\u4ef6\u6e05\u5355"));
bodyChildren.push(tbl(
  ["\u6587\u4ef6", "\u5927\u5c0f\uff08\u5b57\u8282\uff09", "\u771f\u5b9e\u683c\u5f0f", "\u52a0\u5bc6\u72b6\u6001", "\u89e3\u5bc6\u7ed3\u679c"],
  [
    ["manifest.json", "362", "JSON \u660e\u6587", "\u660e\u6587", "\u5b8c\u6574\u8bfb\u53d6"],
    ["rom.img", "233,815,955", "7z\uff08LZMA\uff09", "XOR-16 \u5bc6\u94a5", "\u89e3\u51fa 726.0 MB system \u6811"],
    ["rom1.img", "278,213,975", "7z\uff08LZMA\uff09", "XOR-16 \u5bc6\u94a5", "\u89e3\u51fa 798.6 MB product/vendor \u6811"],
    ["magisk.zip", "23,933,726", "ZIP", "XOR-16 \u5bc6\u94a5", "\u5b98\u65b9 Magisk v27.0 \u5237\u5165\u5305"],
    ["superuser.zip", "1,366,160", "\u672a\u77e5\uff08\u7135 7.999\uff09", "\u72ec\u7acb\u52a0\u5bc6\uff08\u63a8\u6d4b RC4\uff09", "\u5bc6\u94a5\u5728 Epic.vm \u5185\u5c42\uff0c\u5f85\u52a8\u6001\u6293\u53d6"],
  ],
  [22, 18, 20, 18, 22]
));
bodyChildren.push(caption("\u8868 2-2  manifest.json \u5b57\u6bb5\u89e3\u6790"));
bodyChildren.push(tbl(
  ["\u5b57\u6bb5", "\u503c", "\u542b\u4e49"],
  [
    ["id", "user_96C1...rom_default_12.1.0", "\u7528\u6237\u7ed1\u5b9a\u7684 ROM \u5b9e\u4f8b ID\uff08\u6bcf\u53f0\u8bbe\u5907\u4e00\u4efd\uff09"],
    ["display_name / os_version", "Android 12.1.0 / 12", "\u5bf9\u5916\u5c55\u793a\u540d\u4e0e\u5185\u6838\u5bf9\u5e94\u7684\u7cfb\u7edf\u7248\u672c"],
    ["rom_version", "1034", "ROM \u6784\u5efa\u53f7\uff0c\u7528\u4e8e\u5347\u7ea7\u5224\u65ad"],
    ["support_a32 / support_a64", "false / true", "\u6b64 ROM \u4ec5\u652f\u6301 64 \u4f4d\uff08\u4e0e\u6e90\u7801\u68c0\u9a8c\u4e00\u81f4\uff09"],
    ["minimum_app_ver", "3.2.66", "\u8981\u6c42\u5bbf\u4e3b App \u6700\u4f4e\u7248\u672c\uff0c\u9632\u65b0 ROM \u88c5\u5728\u65e7\u5bb9\u5668\u4e0a"],
    ["rom_uri", "rom.img?e=x&c=v2 \u00d72", "\u7cfb\u7edf\u6811\u5206\u4e24\u4e2a\u5bb9\u5668\u4e0b\u53d1\uff0ce=x \u8868\u5f02\u6216\u52a0\u5bc6"],
    ["magisk_uri", "magisk.zip?v=27000&e=x", "Magisk \u7248\u672c\u53f7\u968f\u4e0b\u53d1\u53c2\u6570\u540c\u6b65"],
    ["su_uri", "superuser.zip", "su \u7ba1\u7406\u5668\u5305\uff08\u65e0 e=x \u6807\u8bb0\u4f46\u5b9e\u9645\u4ecd\u52a0\u5bc6\uff09"],
    ["xposed_uri / play_uri", "\u7a7a", "\u672c ROM \u672a\u914d\u4e0b Xposed \u4e0e GApps \u5b89\u88c5\u5668\uff08\u5185\u5d4c\u5728 rom1 \u4e2d\uff09"],
  ],
  [24, 34, 42]
));
bodyChildren.push(h2("2.2 16 \u5b57\u8282\u5f02\u6216\u5bc6\u94a5\u7684\u5b8c\u6574\u6062\u590d\u8fc7\u7a0b"));
bodyChildren.push(body("\u5bc6\u6587\u4e2d\u51fa\u73b0\u7684\u91cd\u590d ASCII \u7247\u6bb5\uff08%z89\u3001viCM0\uff09\u662f\u5b9a\u4f4d\u5f02\u6216\u52a0\u5bc6\u7684\u7b2c\u4e00\u6761\u7ebf\u7d22\uff1a\u5bc6\u6587\u4fdd\u7559\u4e86\u660e\u6587\u7684\u7ed3\u6784\u6027\u3002\u6062\u590d\u5206\u4e09\u6b65\u5b8c\u6210\uff0c\u5168\u7a0b\u65e0\u9700\u66b4\u529b\u7834\u89e3\u3002"));
bodyChildren.push(bodyRuns([
  { text: "\u7b2c\u4e00\u6b65\uff0c\u5df2\u77e5\u660e\u6587\u5bf9\u9f50\u3002", bold: true },
  { text: "\u5047\u8bbe rom.img \u660e\u6587\u4ee5 7z \u7b7e\u540d 37 7A BC AF 27 1C 00 04 \u5f00\u5934\uff0c\u4e0e\u5bc6\u6587\u524d 8 \u5b57\u8282\u9010\u5b57\u8282\u5f02\u6216\uff0c\u5f97\u5230\u5bc6\u94a5\u524d 8 \u5b57\u8282 25 7A 38 39 61 76 69 43\uff1b\u540c\u4e00\u5bc6\u94a5\u65bd\u52a0\u5230 magisk.zip \u5bc6\u6587\u540e\uff0c\u524d 4 \u5b57\u8282\u6070\u597d\u89e3\u51fa 50 4B 03 04\uff08ZIP \u7b7e\u540d\uff09\uff0c\u4ea4\u53c9\u9a8c\u8bc1\u6210\u7acb\uff0c\u786e\u8ba4\u4e24\u7c7b\u6587\u4ef6\u5171\u7528\u540c\u4e00\u5bc6\u94a5\u4e14\u5bc6\u94a5\u5468\u671f\u4e3a 16 \u5b57\u8282\u3002\u7ee7\u7eed\u5229\u7528 magisk.zip \u9996\u4e2a\u76ee\u5f55\u9879 csize/usize \u5fc5\u4e3a\u96f6\u7684 ZIP \u7ed3\u6784\u7ea6\u675f\uff0c\u518d\u63a8\u51fa\u5bc6\u94a5\u7b2c 9 \u81f3 14 \u5b57\u8282\u3002" },
]));
bodyChildren.push(bodyRuns([
  { text: "\u7b2c\u4e8c\u6b65\uff0cEOCD \u5c3e\u5757\u8865\u5168\u3002", bold: true },
  { text: "ZIP \u7ed3\u675f\u5b9a\u4f4d\u7b26\u5f55\uff08EOCD\uff09\u5b57\u6bb5\u4f4d\u7f6e\u56fa\u5b9a\uff1a\u76d8\u53f7\u5b57\u6bb5\u5fc5\u4e3a 0\uff0c\u4e2d\u592e\u76ee\u5f55\u504f\u79fb + \u5927\u5c0f + 22 \u5b57\u8282\u5e94\u7cbe\u786e\u7b49\u4e8e\u6587\u4ef6\u5927\u5c0f\u3002\u5229\u7528\u8fd9\u4e9b\u786c\u7ea6\u675f\u4ece\u5bc6\u6587\u76f4\u63a5\u89e3\u51fa\u5bc6\u94a5\u6700\u540e 2 \u5b57\u8282\uff08disk_cd_start=0 \u5904\u7684\u4e24\u5b57\u8282\uff09\uff0c\u5e76\u5f97\u5230 entries=33\u3001cd_offset=23930237 \u7b49\u5143\u6570\u636e\u3002" },
]));
bodyChildren.push(bodyRuns([
  { text: "\u7b2c\u4e09\u6b65\uff0c\u5168\u94fe\u8def\u81ea\u6821\u9a8c\u3002", bold: true },
  { text: "\u7528\u5b8c\u6574\u5bc6\u94a5\u89e3\u5bc6\u540e\uff0c\u4ee5\u4e0b\u68c0\u67e5\u5168\u90e8\u901a\u8fc7\uff1aEOCD \u7b7e\u540d 50 4B 05 06\uff1b\u4e2d\u592e\u76ee\u5f55\u7b7e\u540d 50 4B 01 02\uff1b\u9996\u6761\u76ee\u5f55\u540d data/\uff1b\u65f6\u95f4\u6233 2025-01-16\uff1b\u4e24\u4e2a 7z \u7684 NextHeaderOffset \u7cbe\u786e\u7b49\u4e8e\u6587\u4ef6\u5927\u5c0f\u51cf 71\uff08slack=0\uff09\u3002\u636e\u6b64\u5b8c\u5168\u6392\u9664\u78b0\u649e\u53ef\u80fd\u3002" },
]));
bodyChildren.push(caption("\u8868 2-3  \u5bc6\u94a5\u6062\u590d\u9a8c\u8bc1\u8bb0\u5f55"));
bodyChildren.push(tbl(
  ["\u9a8c\u8bc1\u9879", "\u9884\u671f\u503c", "\u5b9e\u6d4b\u503c", "\u7ed3\u679c"],
  [
    ["rom.img \u7b7e\u540d", "37 7A BC AF 27 1C 00 04", "\u4e00\u81f4", "\u901a\u8fc7"],
    ["rom1.img \u7b7e\u540d", "\u540c\u4e0a", "\u4e00\u81f4", "\u901a\u8fc7"],
    ["magisk.zip \u7b7e\u540d", "50 4B 03 04", "\u4e00\u81f4", "\u901a\u8fc7"],
    ["EOCD \u7b7e\u540d", "50 4B 05 06", "\u4e00\u81f4", "\u901a\u8fc7"],
    ["cd_offset+cd_size+22", "= \u6587\u4ef6\u5927\u5c0f 23,933,726", "23,933,726", "\u7cbe\u786e\u76f8\u7b49"],
    ["\u76ee\u5f55\u6761\u76ee\u6570", "entries_disk = entries_total", "33 = 33", "\u901a\u8fc7"],
    ["\u4e2d\u592e\u76ee\u5f55\u9996\u9879", "data/", "data/", "\u901a\u8fc7"],
    ["7z NextHeaderOffset", "\u6587\u4ef6\u5927\u5c0f - 71", "\u4e24\u6587\u4ef6\u5747\u7cbe\u786e", "\u901a\u8fc7"],
  ],
  [30, 28, 26, 16]
));
bodyChildren.push(bodyRuns([
  { text: "\u6700\u7ec8\u5bc6\u94a5\uff1a", bold: true },
  { text: "25 7A 38 39 61 76 69 43 4D 30 4B 6B 62 45 73 39\uff0c\u5373 ASCII \u4e32 %z89aviCM0KkbEs9\u3002\u5bc6\u94a5\u6309\u6587\u4ef6\u7edd\u5bf9\u504f\u79fb\u4ee5 16 \u5b57\u8282\u4e3a\u5468\u671f\u5faa\u73af\uff0c\u4e0e\u6587\u4ef6\u5185\u5bb9\u65e0\u5173\uff0c\u5c5e\u4e8e\u9759\u6001\u5bc6\u94a5\u3002\u8fd9\u610f\u5473\u7740\u540c\u4e00\u6e20\u9053\u4e0b\u53d1\u7684\u4efb\u610f ROM \u5747\u53ef\u7528\u540c\u4e00\u65b9\u6cd5\u89e3\u5bc6\u3002" },
]));
bodyChildren.push(h2("2.3 7z \u5bb9\u5668\u7ed3\u6784\u4e0e\u89e3\u538b\u4ea7\u7269"));
bodyChildren.push(body("rom.img \u4e0e rom1.img \u89e3\u5bc6\u540e\u5747\u4e3a\u6807\u51c6 7z \u5f52\u6863\uff1a\u5934\u90e8 StartHeader \u6307\u5411\u672b\u5c3e 39 \u5b57\u8282\u7684 kEncodedHeader\uff0c\u5185\u5d4c LZMA\uff08\u7f16\u7801\u5668 ID 0x030101\uff0c\u53c2\u6570 lc=3/lp=0/pb=2\uff0c\u5b57\u5178 384 KB\uff09\u538b\u7f29\u7684\u76ee\u5f55\u6d41\u3002\u8fd9\u4e2a c=v2 \u5bb9\u5668\u7684\u7279\u70b9\u662f\uff1a\u5f52\u6863\u5185\u4e0d\u662f\u78c1\u76d8\u955c\u50cf\uff0c\u800c\u662f\u76f4\u63a5\u5b58\u653e\u4ee5 fs/ \u4e3a\u6839\u7684\u6587\u4ef6\u6811\uff0c\u5b89\u88c5\u65f6\u65e0\u9700 mount \u78c1\u76d8\u955c\u50cf\uff0c\u76f4\u63a5\u89e3\u6811\u5230\u5bb9\u5668\u76ee\u5f55\u5373\u53ef\u3002"));
bodyChildren.push(h2("2.4 Epic \u58f3\u52a0\u5bc6\u4f53\u7cfb\u4e0e\u5c1a\u672a\u89e3\u5bc6\u9879"));
bodyChildren.push(body("\u5bbf\u4e3b APK \u91c7\u7528\u540d\u4e3a Epic \u7684 VMP \u58f3\u4fdd\u62a4\uff1aApplication \u5165\u53e3 Epic.ProtectApp \u7684 attachBaseContext/onCreate \u5168\u90e8\u4e3a native \u65b9\u6cd5\uff0c\u4e1a\u52a1\u903b\u8f91\u7ecf VmVoid/VmObject(int, Object[]) \u7cfb\u5217 native \u65b9\u6cd5\u5206\u53d1\uff0cclasses.dex \u4ec5 3.3 KB\u3002libEPIC.so \u4e2d\u66b4\u9732\u4e86\u5206\u5c42\u52a0\u5bc6\u4f53\u7cfb\u7684\u914d\u7f6e\u952e\u540d\uff1adex\u3001epic_meta\u3001vm\u3001asset\u3001axml\u3001resource_string \u5404\u81ea\u62e5\u6709 rc4_key \u4e0e xor_key\u3002\u58f3\u5143\u6570\u636e\u6587\u4ef6 Epic.vm\uff0898 KB\uff09\u5df2\u786e\u8ba4\u4e3a\u5355\u5b57\u8282 0x1F \u5f02\u6216\uff0c\u89e3\u51fa Epic_ \u9b54\u6570\u4e0e\u8282\u8868\uff0c\u4f46\u5185\u5c42\u7684\u5bc6\u94a5\u6bb5\u4ecd\u7531 VMP \u4ee3\u7801\u6d3e\u751f\uff0c\u9759\u6001\u62ff\u4e0d\u5230\u3002"));
bodyChildren.push(body("\u7531\u6b64\u4e5f\u89e3\u91ca\u4e86 superuser.zip \u4e0e xposed.zip \u7684\u72b6\u6001\uff1a\u4e24\u8005\u5168\u6587\u7135\u63a5\u8fd1 8.0\uff0c\u5bf9\u6bd4\u4e24\u4e2a\u6e20\u9053\uff08APK \u5185\u5d4c\u4e0e ROM \u5305\uff09\u7684 superuser.zip \u53d1\u73b0\u504f\u79fb 16 \u5904 16 \u5b57\u8282\u5b8c\u5168\u76f8\u540c\u3001\u524d 16 \u5b57\u8282\u4e0d\u540c\uff0c\u7b26\u5408\u5757\u5bc6\u7801\u6216\u56fa\u5b9a\u5bc6\u94a5\u6d41\u5bc6\u7801\u7684\u7279\u5f81\uff1b\u5bf9\u5176\u505a ZIP \u7ed3\u6784\u5bf9\u9f50\u5206\u6790\u53ef\u6392\u9664\u4e0e ROM \u540c\u6b3e XOR\u3002\u7efc\u5408\u5224\u65ad\u4e3a RC4\uff0c\u5bc6\u94a5\u5c5e\u4e8e asset_protection_rc4_key \u4f53\u7cfb\uff0c\u5b58\u4e8e Epic.vm \u52a0\u5bc6\u8282\u4e2d\u3002\u8981\u62ff\u5230\u5b83\u9700\u8981\u5728\u771f\u673a/\u6a21\u62df\u5668\u4e0a\u8fd0\u884c\u5e94\u7528\u540e\u7528 Frida \u5728\u89e3\u5bc6\u51fd\u6570\u51fa\u53e3\u6293\u53d6\u660e\u6587\uff0c\u5c5e\u4e8e\u52a8\u6001\u5206\u6790\u8303\u7574\uff0c\u4e0d\u5f71\u54cd\u672c\u62a5\u544a\u5bf9 root \u65b9\u6848\u7684\u7ed3\u8bba\uff08magisk.zip \u5df2\u5b8c\u6574\u89e3\u5bc6\uff0csu \u80fd\u529b\u4e3b\u4f53\u5b8c\u5907\uff09\u3002"));

/* ============ 三、Guest 根文件系统解析 ============ */
bodyChildren.push(h1("\u4e09\u3001Guest \u6839\u6587\u4ef6\u7cfb\u7edf\u5168\u89e3\u6790"));
bodyChildren.push(h2("3.1 \u4e24\u4e2a\u955c\u50cf\u7684\u5206\u5de5\u4e0e\u603b\u4f53\u89c4\u6a21"));
bodyChildren.push(body("rom.img \u89e3\u538b\u540e\u4e3a 726.0 MB\u30012526 \u4e2a\u6587\u4ef6\uff0c\u4e3b\u8981\u662f fs/system/ \u6811\uff1a\u6846\u67b6 jar\u3001APEX\uff08ART\u3001adbd\u3001i18n\u7b49\uff09\u3001\u5e93\u6587\u4ef6\u4e0e\u7cfb\u7edf\u5e94\u7528\u3002rom1.img \u89e3\u538b\u540e\u4e3a 798.6 MB\u30011189 \u4e2a\u6587\u4ef6\uff0c\u4e3b\u8981\u662f fs/product/ \u4e0e fs/system_ext/ \u6811\uff1aGmsCore\uff08220.8 MB\uff09\u3001webview\uff08168.3 MB\uff09\u3001Phonesky \u5373 Play \u5546\u5e97\uff0878.7 MB\uff09\u3001Settings\u3001SystemUI\u3001Launcher3 \u4ee5\u53ca\u6574\u5957 fs/vendor/ \u5b9a\u5236 HAL\u3002\u4e24\u6811\u5408\u5e76\u540e\u5373\u4e3a\u5b8c\u6574\u7684 guest \u6839\u6587\u4ef6\u7cfb\u7edf\uff0c\u89e3\u538b\u603b\u91cf\u7ea6 1.5 GB\uff0c\u6d89\u53ca 3715 \u4e2a\u6587\u4ef6\u3002"));
bodyChildren.push(h2("3.2 \u7cfb\u7edf\u955c\u50cf\u6784\u6210\uff1aAOSP 12 + marlin \u6307\u7eb9"));
bodyChildren.push(body("build.prop \u663e\u793a guest \u6307\u7eb9\u4e3a google/marlin/marlin:12/SP2A.220505.008/6934943:user/release-keys\uff08Pixel XL \u5b98\u65b9\u56fa\u4ef6\u6307\u7eb9\uff09\uff0cSDK 32\uff0c\u5b89\u5168\u8865\u4e01\u7ea7 2022-05-05\uff0c\u4ec5 arm64-v8a\uff08\u4e0e manifest \u7684 support_a64 \u4e00\u81f4\uff09\uff0cro.build.date \u4e3a 2026-06-02\uff0c\u8bf4\u660e\u8fd9\u662f VMOS \u56e2\u961f\u5728 AOSP SP2A.220505.008 \u57fa\u7ebf\u4e0a\u91cd\u65b0\u6784\u5efa\u7684\u4ea7\u54c1\uff0c\u800c\u975e\u63d0\u53d6\u81ea\u771f\u673a\u3002\u6307\u7eb9\u4e2d\u7684 marlin \u4e0e libkrloader64.so \u5185\u5d4c\u7684\u6784\u5efa\u8def\u5f84 out_gp/target/product/marlin/... \u4e92\u76f8\u5370\u8bc1\uff1a\u5bb9\u5668\u8fd0\u884c\u65f6\u548c guest \u7cfb\u7edf\u662f\u5728\u540c\u4e00\u4e2a AOSP \u4ea7\u54c1\u6811\u91cc\u4e00\u4f53\u5316\u6784\u5efa\u7684\uff0c\u8fd9\u662f\u5176\u9ad8\u5ea6\u517c\u5bb9\u7684\u6839\u57fa\u3002"));
bodyChildren.push(h2("3.3 vendor \u5206\u533a\u4e0e master HAL \u4f53\u7cfb"));
bodyChildren.push(body("fs/vendor/ \u63d0\u4f9b\u4e86\u4e00\u5957\u4e13\u4e3a\u5bb9\u5668\u73af\u5883\u6539\u5199\u7684 HAL\uff1a\u540d\u5b57\u5e26 master \u540e\u7f00\u7684\u670d\u52a1\uff08gnss@2.0-service.master\u3001hwcomposer.master.so\u3001camera.master.so\uff09\u4e0e\u84dd\u7259 bluetooth@1.1-service.sim\uff0c\u518d\u914d\u4e0a\u4ece\u5b89\u5353\u6a21\u62df\u5668\u79fb\u690d\u7684 media.c2@1.0-service-goldfish\uff0c\u4ee5\u53ca rild\u3001wpa_supplicant\u3001hostapd \u7b49\u5b8c\u6574\u901a\u4fe1/WiFi \u6808\u3002\u8fd9\u4e9b HAL \u7684\u804c\u8d23\u662f\u628a guest \u7684\u6807\u51c6\u786c\u4ef6\u8bf7\u6c42\u8f6c\u8bd1\u5230\u5bbf\u4e3b\u4fa7\uff1a\u5b9a\u4f4d\u4f2a\u9020\u4ea4\u7ed9\u5bbf\u4e3b App \u7684 LocationService\uff0c\u56fe\u5f62\u6e32\u67d3\u9760 hwcomposer.master \u6254\u7ed9\u5bbf\u4e3b SurfaceFlinger\uff0c\u76f8\u673a\u6570\u636e\u7531 camera.master \u4ece\u5bbf\u4e3b Camera2 API \u62c9\u53d6\u3002guest \u4e0e\u5bbf\u4e3b\u7684\u786c\u4ef6\u8fb9\u754c\u5c31\u662f\u9760\u8fd9\u5c42 HAL \u6e05\u6670\u5207\u5f00\u7684\u3002"));
bodyChildren.push(h2("3.4 guest \u5185\u7f6e\u6865\u6881\u670d\u52a1 vmservice"));
bodyChildren.push(body("\u7cfb\u7edf\u6811\u5185\u9884\u7f6e\u4e86 priv-app \u7ea7\u522b\u7684 com.android.vmservice\uff08vmservice.apk\uff0c5.0 MB\uff09\u3002\u53cd\u7f16\u8bd1\u663e\u793a\u5b83\u5305\u542b CmdReceiver\uff08\u76d1\u542c\u5e7f\u64ad com.android.vmcore.action.EXECUTE_COMMAND\uff0c\u6301 android.permission.WRITE_SECURE_SETTINGS\uff09\u3001NotificationListener\u3001LocationService V2/V3 \u4e0e NetworkLocationProvider\uff08\u914d\u5408\u5bbf\u4e3b\u4e0b\u53d1\u7684\u865a\u5047 GPS\uff09\u3001ExportFileActivity\uff08\u6587\u4ef6\u5bfc\u51fa\uff09\u4e0e VPN \u63a7\u5236\u3002\u5bbf\u4e3b App \u901a\u8fc7\u5e7f\u64ad\u5411 guest \u4e0b\u8fbe\u6307\u4ee4\uff0cguest \u4fa7\u6536\u96c6\u901a\u77e5\u3001\u4f4d\u7f6e\u3001VPN \u72b6\u6001\u56de\u4f20\uff0c\u8fd9\u662f\u5bbf\u4e3b\u63a7\u5236\u5bb9\u5668\u5185\u90e8\u884c\u4e3a\u7684\u6b63\u9053\u901a\u9053\u3002\u53e6\u5916 APK \u8d44\u4ea7\u4e2d\u7684 groovy_shell.apk\uff086.4 MB\uff0cApache Groovy \u8fd0\u884c\u65f6\uff0c7060 \u7c7b\uff09\u63d0\u4f9b guest \u5185\u811a\u672c\u6267\u884c\u80fd\u529b\uff0c\u7528\u4e8e\u81ea\u52a8\u5316\u4e0e\u8fd0\u7ef4\u64cd\u4f5c\u3002"));

/* ============ 四、Root 实现方案深度分析 ============ */
bodyChildren.push(h1("\u56db\u3001Root \u5b9e\u73b0\u65b9\u6848\u6df1\u5ea6\u5206\u6790"));
bodyChildren.push(h2("4.1 \u5b9a\u6027\uff1a\u968f ROM \u5206\u53d1\u7684\u5b98\u65b9 Magisk v27.0"));
bodyChildren.push(body("ROM \u5305\u5185\u7684 magisk.zip \u89e3\u5bc6\u540e\u662f\u4e00\u4efd\u5b98\u65b9 Magisk \u5237\u5165\u5305\uff1a\u5185\u5d4c\u5b57\u7b26\u4e32 Magisk 2c6adbc6(27000) daemon started \u786e\u8ba4\u4e3a v27.0\uff0c\u5305\u542b\u5b8c\u6574\u7684\u5b88\u62a4\u8fdb\u7a0b\u4e8c\u8fdb\u5236\uff08sbin/magisk32\u3001sbin/magisk64\uff09\u3001\u5b89\u88c5\u5de5\u5177\u94fe\uff08data/adb/magisk/ \u4e0b\u7684 magiskinit\u3001magiskpolicy\u3001magiskboot\u3001busybox\u3001\u5404\u7c7b shell \u811a\u672c\uff09\u4ee5\u53ca Magisk Manager \u5e94\u7528\uff08data/app/com.topjohnwu.magisk.apk\uff09\u3002\u914d\u7f6e\u4e3a KEEPVERITY=true\u3001KEEPFORCEENCRYPT=true\u3001PATCHVBMETAFLAG=false\u3001RECOVERYMODE=false\u3002"));
bodyChildren.push(caption("\u8868 4-1  magisk.zip \u5305\u7ed3\u6784\u4e0e\u5404\u90e8\u4ef6\u804c\u8d23"));
bodyChildren.push(tbl(
  ["\u8def\u5f84", "\u4f5c\u7528", "\u5728\u5bb9\u5668\u5185\u7684\u89d2\u8272"],
  [
    ["sbin/magisk32 / magisk64", "\u5b88\u62a4\u8fdb\u7a0b\u4e0e su \u4e8c\u8fdb\u5236\u5408\u4f53", "\u4ee5\u5bb9\u5668\u5185 root \u8eab\u4efd\u5e38\u9a7b\uff0c\u76d1\u542c su \u8bf7\u6c42\u4e0e\u6302\u8f7d\u6a21\u5757"],
    ["sbin/stub.apk", "\u9759\u6001\u5d4c\u5165\u7684 Magisk \u5360\u4f4d\u5e94\u7528", "\u89c4\u907f\u5e02\u573a\u6e20\u9053\u68c0\u6d4b Magisk \u5305\u540d"],
    ["data/adb/magisk/magiskinit", "\u5f15\u5bfc\u9636\u6bb5 init \u66ff\u6362\u4f53", "\u771f\u673a\u7528\u4e8e\u66ff\u6362 boot \u955c\u50cf\u7684 /init\uff1b\u5bb9\u5668\u5185\u4ec5\u4f5c\u5907\u4efd"],
    ["data/adb/magisk/magiskpolicy", "SELinux \u89c4\u5219\u8865\u4e01\u5de5\u5177", "\u5c1d\u8bd5\u6ce8\u5165 magisk \u57df\uff08\u5bb9\u5668\u5185\u88ab libkr \u4f2a\u670d\u52a1\u5316\uff09"],
    ["data/adb/magisk/magiskboot", "boot \u955c\u50cf\u89e3\u5305\u5de5\u5177", "\u5bb9\u5668\u573a\u666f\u7528\u4e0d\u5230\uff0c\u4fdd\u6301\u5b98\u65b9\u5305\u539f\u6837"],
    ["data/adb/magisk/busybox", "\u5185\u7f6e shell \u5de5\u5177\u7bb1", "\u6a21\u5757\u811a\u672c\u4f9d\u8d56"],
    ["boot_patch.sh / util_functions.sh", "\u6807\u51c6\u5237\u5165\u6d41\u7a0b\u811a\u672c", "\u5bb9\u5668\u573a\u666f\u8df3\u8fc7\u6253\u8865\u4e01\u73af\u8282\uff0c\u76f4\u63a5\u53d6\u4e8c\u8fdb\u5236\u542f\u52a8"],
    ["data/app/com.topjohnwu.magisk.apk", "Magisk Manager \u7528\u6237\u7aef", "\u9884\u7f6e\u8fdb guest \u7cfb\u7edf\uff0c\u63d0\u4f9b\u6388\u6743 UI \u4e0e\u6a21\u5757\u7ba1\u7406"],
    ["sbin/.magisk/{mirror,worker,block}", "\u8fd0\u884c\u65f6\u76ee\u5f55\u9aa8\u67b6", "\u5b89\u88c5\u65f6\u4fdd\u7559\uff0c\u4f9b magiskd \u4f7f\u7528"],
  ],
  [30, 34, 36]
));
bodyChildren.push(h2("4.2 \u8fd0\u884c\u65f6\u6240\u6709\u5236\u6a21\u578b\uff1a\u5bb9\u5668\u5185 uid=0 \u662f\u4e00\u573a\u96c6\u4f53\u4f2a\u88c5"));
bodyChildren.push(body("\u771f\u673a Magisk \u7684 root \u6765\u81ea\u5185\u6838\u6388\u6743\uff1apatch \u540e\u7684 init \u628a magiskd \u62c9\u8d77\u4e3a\u771f\u6b63\u7684 uid 0\u3002\u5bb9\u5668\u91cc\u6ca1\u6709\u8fd9\u4e2a\u6761\u4ef6\uff1a\u5bbf\u4e3b App \u81ea\u8eab\u662f untrusted_app \u57df\u7684 uid 10xxx\uff0c\u5b83\u65e0\u6cd5\u521b\u9020\u51fa\u771f\u6b63\u7684 uid 0 \u8fdb\u7a0b\u3002VMOS \u7684\u89e3\u6cd5\u662f\u628a root \u5b9a\u4e49\u6539\u5199\u4e3a\u5bb9\u5668\u5185\u90e8\u7684\u6240\u6709\u6743\uff1a\u6574\u4e2a guest \u7684\u6587\u4ef6\u6811\u672c\u5c31\u5b58\u5728\u5bbf\u4e3b App \u79c1\u6709\u76ee\u5f55 vm/vm<id>/fs \u4e0b\uff0c\u5bf9\u8fd9\u4e9b\u6587\u4ef6\u5bbf\u4e3b uid \u5929\u7136\u62e5\u6709\u5b8c\u6574\u63a7\u5236\u6743\uff1b\u53ea\u8981\u5bb9\u5668\u5185\u6bcf\u4e2a\u8fdb\u7a0b\u5728\u8c03\u7528 getuid/geteuid/getgid \u7b49\u7cfb\u7edf\u63a5\u53e3\u65f6\u88ab libkr \u5c42\u62e6\u622a\u5e76\u8fd4\u56de 0\uff0c\u5bb9\u5668\u5185\u7684\u6240\u6709\u6743\u68c0\u67e5\uff08\u6587\u4ef6\u5c5e\u4e3b\u5bf9\u6bd4\u3001unix \u5957\u63a5\u5b57\u51ed\u636e\u3001/proc \u6240\u5c5e\u663e\u793a\u7b49\uff09\u90fd\u4f1a\u628a\u5f7c\u6b64\u8ba4\u5b9a\u4e3a root\u3002\u4e8e\u662f\u5bb9\u5668\u5185\u90e8\u5f62\u6210\u4e00\u4e2a\u903b\u8f91\u81ea\u51b6\uff1a\u6bcf\u4e2a\u8fdb\u7a0b\u90fd\u662f root\uff0c\u4efb\u4f55\u8fdb\u7a0b\u90fd\u53ef\u4ee5\u7ba1\u7406\u5bb9\u5668\u5185\u4efb\u4f55\u8d44\u6e90\u3002"));
bodyChildren.push(body("magiskd \u5728\u8fd9\u4e2a\u73af\u5883\u91cc\u7684\u4ef7\u503c\u4e0d\u662f\u63d0\u4f9b\u7279\u6743\uff0c\u800c\u662f\u63d0\u4f9b\u4e0e\u771f\u673a\u4e00\u81f4\u7684\u7ba1\u7406\u5c42\uff1asu \u8bf7\u6c42\u7684\u6388\u6743\u5f39\u7a97\u3001Magisk Manager \u7684\u6a21\u5757\u5f00\u5173\u3001su \u767d\u540d\u5355\u3001\u65e5\u5fd7\u5ba1\u8ba1\uff0c\u8fd9\u4e9b\u7528\u6237\u53ef\u611f\u77e5\u7684 root \u4f53\u9a8c\u5168\u90e8\u7531\u5b98\u65b9 Magisk \u6808\u627f\u62c5\uff0c\u4fdd\u8bc1\u4e86\u517c\u5bb9\u6027\uff1a\u4e0b\u6e38\u6a21\u5757\uff08\u4f8b\u5982\u9700\u8981 su \u7684\u5e94\u7528\uff09\u65e0\u9700\u611f\u77e5\u5bb9\u5668\u4e0e\u771f\u673a\u7684\u5dee\u5f02\u3002\u8fd9\u4e5f\u89e3\u91ca\u4e86\u4e3a\u4f55 VMOS \u9009\u62e9\u76f4\u63a5\u5206\u53d1\u5b98\u65b9 Magisk \u800c\u975e\u81ea\u7814\u4e00\u5957\u8f7b\u91cf su\uff1a\u590d\u7528\u751f\u6001\u6bd4\u91cd\u5199\u66f4\u4fbf\u5b9c\u3002"));
bodyChildren.push(h2("4.3 su \u94fe\u8def\u4e0e\u6388\u6743\u6d41\u7a0b"));
bodyChildren.push(body("\u5b8c\u6574\u94fe\u8def\u5982\u4e0b\uff1a\u9996\u6b21\u542f\u52a8\u5bb9\u5668\u65f6\uff0c\u5bbf\u4e3b App \u628a magisk.zip \u89e3\u5f00\u5230\u5bb9\u5668\u7684 sbin \u4e0e data/adb/magisk\uff0c\u5e76\u62c9\u8d77 magisk64 \u4f5c\u4e3a\u5bb9\u5668\u5185\u5e38\u9a7b\u5b88\u62a4\uff1bguest \u5185\u5e94\u7528\u6267\u884c su \u65f6\uff0csu \u4e8c\u8fdb\u5236\u901a\u8fc7 unix \u5957\u63a5\u5b57\u8fde\u63a5 magiskd\uff0c\u63d0\u4ea4\u8bf7\u6c42\u65b9 uid \u4e0e\u76ee\u6807\u547d\u4ee4\uff1bmagiskd \u5f39\u51fa Magisk Manager \u6388\u6743\u5bf9\u8bdd\u6846\uff08\u6216\u6309\u9884\u7f6e\u767d\u540d\u5355\u76f4\u63a5\u653e\u884c\uff09\uff0c\u6388\u6743\u540e su \u4ee5\u5bb9\u5668\u5185 root\uff08\u5373\u5bbf\u4e3b uid\uff09\u8eab\u4efd\u6267\u884c\u547d\u4ee4\u3002\u7531\u4e8e\u5bb9\u5668\u5185\u6240\u6709\u6587\u4ef6\u90fd\u5c5e\u4e3b uid \u6240\u6709\uff0csu \u53ef\u4ee5\u4fee\u6539\u5bb9\u5668\u5185\u4efb\u4f55\u8def\u5f84\uff0c\u5305\u62ec\u6302\u8f7d\u70b9\u6837\u7684 system/ \u76ee\u5f55\uff0c\u6a21\u5757\u5b9e\u9645\u4e0a\u662f\u76f4\u63a5\u6539\u5199 fs \u6811\u5185\u6587\u4ef6\u5b9e\u73b0\u7684\u53e0\u52a0\u3002"));
bodyChildren.push(h2("4.4 SELinux \u7684\u5bb9\u5668\u5185\u865a\u62df\u5316"));
bodyChildren.push(body("guest \u6811\u5185\u643a\u5e26\u4e86\u5b8c\u6574\u7684 SELinux \u7b56\u7565\u6587\u4ef6\uff08plat_sepolicy.cil \u7ea6 1.8 MB\u3001\u6587\u4ef6/\u5c5e\u6027\u4e0a\u4e0b\u6587\u3001\u6620\u5c04\u7b56\u7565\uff09\uff0c\u6587\u4ef6\u4e0a\u4e0b\u6587\u4e2d\u4fdd\u7559\u4e86\u6807\u51c6\u7684 /system/xbin/su \u5bf9\u5e94 su_exec \u57df\u7684\u6761\u76ee\u3002\u4f46\u5728\u5bb9\u5668\u91cc\u8fd9\u5957\u7b56\u7565\u662f\u6446\u8bbe\uff1a\u5b9e\u9645 enforcement \u53d1\u751f\u5728\u5bbf\u4e3b\u5185\u6838\uff0c\u6240\u6709 guest \u8fdb\u7a0b\u90fd\u5904\u4e8e\u5bbf\u4e3b App \u7684 untrusted_app \u57df\uff0cmagiskpolicy \u65e0\u6cd5\u771f\u6b63\u6ce8\u5165\u65b0\u57df\u3002\u5bb9\u5668\u5185\u7684\u6743\u9650\u5224\u65ad\u88ab libkr \u62e6\u622a\u5c42\u63a5\u7ba1\uff0c\u4ece\u800c\u5411\u4e0a\u5448\u73b0\u4e00\u4e2a permissive \u6837\u5b50\u7684\u865a\u62df SELinux\u3002\u5bf9\u4e0b\u6e38\u5e94\u7528\u800c\u8a00 getenforce \u4f9d\u7136\u8fd4\u56de Enforcing\uff0c\u8fd9\u4fdd\u8bc1\u4e86\u68c0\u6d4b\u7c7b\u5e94\u7528\u7684\u4f53\u9a8c\u4e00\u81f4\u6027\u3002"));
bodyChildren.push(h2("4.5 \u4e0e\u771f\u673a Magisk \u65b9\u6848\u7684\u5bf9\u7167"));
bodyChildren.push(caption("\u8868 4-2  \u4e09\u79cd\u573a\u666f\u4e0b root \u65b9\u6848\u5bf9\u6bd4"));
bodyChildren.push(tbl(
  ["\u5bf9\u6bd4\u9879", "\u771f\u673a Magisk", "VMOS \u5bb9\u5668", "AEmulator \u73b0\u72b6"],
  [
    ["\u7279\u6743\u6765\u6e90", "\u5185\u6838\u6388\u6743\u7684\u771f uid 0", "\u5bbf\u4e3b uid \u5171\u4eab + \u62e6\u622a\u5c42\u4f2a\u9020 uid=0", "\u65e0\u5b8c\u6574\u65b9\u6848\uff0c\u4ec5\u6709 adb shell"],
    ["\u542f\u52a8\u65b9\u5f0f", "patch boot \u955c\u50cf + magiskinit", "\u76f4\u63a5\u8fd0\u884c magisk64\uff0c\u8df3\u8fc7 boot patch", "\u4e0d\u9002\u7528"],
    ["\u6388\u6743\u7ba1\u7406", "Magisk Manager", "\u5b98\u65b9 Magisk Manager\uff08\u9884\u7f6e guest\uff09", "\u65e0"],
    ["\u6a21\u5757\u6302\u8f7d", "magic mount\uff08\u771f\u6302\u8f7d\uff09", "fs \u6811\u5185\u76f4\u63a5\u53e0\u52a0/\u66ff\u6362\u6587\u4ef6", "\u65e0"],
    ["SELinux", "magiskpolicy \u771f\u5b9e\u6ce8\u5165", "\u865a\u62df enforcement\uff0c\u7b56\u7565\u6446\u8bbe", "\u4e0d\u9002\u7528"],
    ["\u5bf9\u771f\u673a\u4fb5\u5165\u6027", "\u6539\u5206\u533a/\u89e6\u53d1\u98ce\u9669", "\u96f6\u4fb5\u5165\uff08\u5168\u90e8\u5728 App \u79c1\u6709\u76ee\u5f55\uff09", "\u96f6\u4fb5\u5165"],
    ["\u751f\u6001\u517c\u5bb9", "\u9ad8", "\u9ad8\uff08\u590d\u7528\u5b98\u65b9\u6808\uff09", "\u4f4e"],
  ],
  [18, 26, 30, 26]
));

/* ============ 五、兼容架构 ============ */
bodyChildren.push(h1("\u4e94\u3001Android-on-Android \u517c\u5bb9\u67b6\u6784"));
bodyChildren.push(h2("5.1 \u603b\u4f53\u62d3\u6251\uff1a\u65e0\u7b2c\u4e8c\u5185\u6838\u7684\u5171\u4eab\u5185\u6838\u5bb9\u5668"));
bodyChildren.push(body("VMOS \u4e0d\u505a CPU \u6307\u4ee4\u6a21\u62df\uff0c\u4e5f\u4e0d\u52a0\u8f7d\u7b2c\u4e8c\u4e2a Linux \u5185\u6838\u3002guest \u7684\u6bcf\u4e00\u4e2a\u8fdb\u7a0b\uff08\u5305\u62ec init\u3001zygote\u3001system_server\uff09\u90fd\u662f\u5bbf\u4e3b\u5185\u6838\u4e0a\u7684\u771f\u5b9e\u8fdb\u7a0b\uff0c\u4e0e\u5bbf\u4e3b App \u540c\u4e3a\u4e00\u4e2a uid\u3002\u6240\u8c13\u865a\u62df\u673a\u7684\u8fb9\u754c\u5b8c\u5168\u7531\u7528\u6237\u6001\u624b\u6bb5\u7ef4\u6301\uff1a\u6587\u4ef6\u7cfb\u7edf\u7528\u76ee\u5f55\u6811\u5bf9\u9f50\uff0c\u8fdb\u7a0b\u6765\u6e90\u7528 fork/clone\uff0c\u4fe1\u53f7\u3001\u7ba1\u9053\u3001\u5957\u63a5\u5b57\u4f7f\u7528\u5bbf\u4e3b\u5185\u6838\u539f\u751f\u80fd\u529b\uff0c\u7f51\u7edc\u7528 TUN \u8bbe\u5907\u5207\u5206\u3002\u8fd9\u79cd\u6784\u578b\u6362\u6765\u7684\u597d\u5904\u662f\u6027\u80fd\u8fd1\u539f\u751f\u4e14\u7edd\u4e0d\u4f1a\u56e0\u4e3a\u6307\u4ee4\u7ffb\u8bd1\u51fa\u9519\uff0c\u4ee3\u4ef7\u662f\u9694\u79bb\u6027\u4f9d\u8d56\u62e6\u622a\u5c42\u7684\u5b8c\u6574\u6027\u3002"));
bodyChildren.push(h2("5.2 libkr \u5185\u6838\u63a5\u53e3\u5e93\uff1a\u4ee5\u5e93\u4ee3\u5185\u6838\u3001\u5206\u7248\u672c\u9002\u914d"));
bodyChildren.push(body("APK \u5185\u7f6e libkr32/libkr64 \u4e24\u4e2a\u57fa\u7840\u5e93\u4e0e libkr32.11/libkr64.11\u3001libkr32.12/libkr64.12 \u56db\u4e2a\u5206\u7248\u672c\u5e93\uff0c\u5bf9\u5e94 Android 11 \u4e0e Android 12 \u4e24\u4ee3 guest\u3002\u5206\u7248\u672c\u7684\u539f\u56e0\u662f\u4e0d\u540c\u4ee3 guest \u7684 bionic \u94fe\u63a5\u5668\u3001ART \u4e0e\u7cfb\u7edf\u670d\u52a1\u7ed3\u6784\u5dee\u5f02\u8f83\u5927\uff0c\u62e6\u622a\u70b9\u4e0e\u8def\u5f84\u6620\u5c04\u9700\u8981\u9010\u7248\u672c\u5bf9\u9f50\u3002libkr64.12 \u5185\u90e8\u5b57\u7b26\u4e32\u66b4\u9732\u4e86\u516d\u5927\u521d\u59cb\u5316\u6a21\u5757\uff1abytesig\uff08\u5d29\u6e83\u4fe1\u53f7\u63a5\u7ba1\uff09\u3001enter\uff08\u8fdb\u5165\u5bb9\u5668\uff09\u3001errno\u3001hub\uff08\u7cfb\u7edf\u8c03\u7528\u5206\u53d1\uff09\u3001linker\uff08\u94fe\u63a5\u5668\u968d\u79c1\uff09\u3001safe\uff0c\u5e76\u4f9d\u8d56\u5b57\u8282\u8df3 shadowhook \u505a inline hook\u3002\u5b83\u7684\u89d2\u8272\u7c7b\u4f3c\u4e8e\u4e00\u4e2a\u7528\u6237\u6001\u5b9e\u73b0\u7684\u8f7b\u91cf\u5185\u6838\uff1a\u63a5\u7ba1 guest \u8fdb\u7a0b\u5bf9\u7279\u6743\u64cd\u4f5c\u7684\u8bf7\u6c42\u5e76\u7528\u6587\u4ef6\u7cfb\u7edf\u624b\u6bb5\u4ee3\u7b54\u3002"));
bodyChildren.push(caption("\u8868 5-1  libkr \u5e93\u5bb6\u65cf\u4e00\u89c8"));
bodyChildren.push(tbl(
  ["\u5e93\u6587\u4ef6", "\u5927\u5c0f", "\u5b9a\u4f4d", "\u5173\u952e\u8bc1\u636e"],
  [
    ["libkrloader32/64.so", "1.1 MB \u7ea7", "\u5bb9\u5668\u5f15\u5bfc\u5668\uff08AOSP marlin \u4ea7\u54c1\u6811\u7f16\u8bd1\u7684\u53ef\u6267\u884c\u4f53\uff09", "\u6784\u5efa\u8def\u5f84\u5b57\u7b26\u4e32\u3001\u4f9d\u8d56 /system/bin/linker64"],
    ["libkr32/64.so", "1.2-1.3 MB", "\u57fa\u7840\u5185\u6838\u63a5\u53e3\uff08\u517c\u5bb9\u65e7 ROM\uff09", "\u5f15\u7528 app_process64\u3001linker64\u3001build.prop"],
    ["libkr32/64.11.so", "2.3-2.4 MB", "Android 11 guest \u4e13\u7528\u63a5\u53e3", "\u589e\u52a0 /dev/socket/logdr \u9002\u914d"],
    ["libkr32/64.12.so", "2.4 MB", "Android 12 guest \u4e13\u7528\u63a5\u53e3", "vm/vm%d/fs \u8def\u5f84\u3001TUN \u63a7\u5236\u901a\u9053\u3001shadowhook"],
  ],
  [26, 14, 32, 28]
));
bodyChildren.push(h2("5.3 \u8fdb\u7a0b\u5f15\u5bfc\u94fe\uff1alibkrloader \u2192 guest linker64 \u2192 app_process64"));
bodyChildren.push(body("\u5bb9\u5668\u542f\u52a8\u7684\u5b9e\u9645\u94fe\u8def\u662f\uff1a\u5bbf\u4e3b App \u5148\u628a libkrloader64.so \u590d\u5236\u5230\u81ea\u5df1\u7684 lib64 \u76ee\u5f55\u5e76\u52a0\u8f7d\uff0cloader \u6301\u6709\u4e24\u628a\u5173\u952e\u5b57\u7b26\u4e32\u2014\u2014\u5bbf\u4e3b\u7684 /system/bin/linker64 \u4e0e guest \u7684 /system/bin/app_process64\u3002\u5b83\u4ee5 guest \u6839\u6587\u4ef6\u7cfb\u7edf\u4e3a\u57fa\u51c6\u62fc\u88c5\u51fa\u4e00\u4e2a\u72ec\u7acb\u7684\u94fe\u63a5\u5668\u547d\u540d\u7a7a\u95f4\uff0c\u4f7f\u540e\u7eed\u52a0\u8f7d\u7684\u6240\u6709\u5e93\u90fd\u53d6\u81ea vm/vm<id>/fs/system/lib64\uff1b\u968f\u540e\u76f4\u63a5\u4ece guest \u7684 app_process64 \u542f\u52a8 zygote\uff0c\u518d\u7531\u6807\u51c6\u7684 init.rc \u4f53\u7cfb\u62c9\u8d77 system_server \u4e0e\u5168\u5bb6\u6876\u670d\u52a1\u3002\u6362\u53e5\u8bdd\u8bf4\uff0cguest \u7684\u542f\u52a8\u8fc7\u7a0b\u4e0e\u771f\u673a\u51e0\u4e4e\u4e00\u81f4\uff0c\u5dee\u5f02\u4ec5\u5728\u4e8e\u6bcf\u4e00\u6b65\u90fd\u88ab libkr \u63a5\u7ba1\u4e86\u7279\u6743\u90e8\u5206\u3002"));
bodyChildren.push(h2("5.4 \u8def\u5f84\u91cd\u5b9a\u5411\u4e0e\u9694\u79bb\u8fb9\u754c"));
bodyChildren.push(body("guest \u7684 /system\u3001/vendor\u3001/product\u3001/data \u90fd\u4e0d\u662f\u771f\u6302\u8f7d\uff0c\u800c\u662f\u76ee\u5f55\u6811\u5185\u7684\u666e\u901a\u5b50\u76ee\u5f55\uff0c\u7531 libkr \u5728\u94fe\u63a5\u5668\u4e0e\u7cfb\u7edf\u8c03\u7528\u4e24\u4e2a\u5c42\u9762\u505a\u8def\u5f84\u91cd\u5199\uff1a\u5b83\u628a guest \u8fdb\u7a0b\u53d1\u8d77\u7684\u7edd\u5bf9\u8def\u5f84\u524d\u7f00\u6620\u5c04\u5230 vm/vm<id>/fs/ \u5185\u90e8\uff0c\u540c\u65f6\u9694\u79bb guest \u5bf9\u5bbf\u4e3b\u6570\u636e\u7684\u53ef\u89c1\u6027\u3002\u5bb9\u5668\u5185\u7684\u591a\u5b9e\u4f8b\uff08vm0\u3001vm1\u2026\uff09\u9760 vm/vm<id> \u7f16\u53f7\u533a\u5206\uff0c\u6bcf\u5b9e\u4f8b\u4e00\u4efd\u72ec\u7acb fs \u6811\u4e0e TUN \u901a\u9053\uff08dev/tun.ctrl_client/tun_%d_%d\uff09\u3002\u8fd9\u4e5f\u89e3\u91ca\u4e86\u4e3a\u4f55 ROM \u5206\u53d1\u7528 7z \u6811\u800c\u975e\u955c\u50cf\uff1a\u5b89\u88c5\u5373\u89e3\u538b\uff0c\u4e0d\u9700\u8981\u4efb\u4f55\u6302\u8f7d\u6743\u9650\u3002"));
bodyChildren.push(h2("5.5 \u7f51\u7edc\u4e0e\u786c\u4ef6\u8fb9\u754c"));
bodyChildren.push(body("\u7f51\u7edc\u65b9\u9762\uff0c\u5bb9\u5668\u5185\u7684\u6d41\u91cf\u7ecf TUN \u8bbe\u5907\u7531\u5bbf\u4e3b\u4fa7\u4ee3\u7406\u8f6c\u53d1\uff0cguest \u4fdd\u6301\u72ec\u7acb\u7684\u7f51\u7edc\u6808\u89c6\u89d2\uff08\u81ea\u5e26 wpa_supplicant \u4e0e rild \u7684\u5b8c\u6574\u534f\u8bae\u6808\uff09\uff1b\u786c\u4ef6\u65b9\u9762\uff0c\u524d\u8ff0 master HAL \u628a gnss\u3001camera\u3001hwcomposer\u3001bluetooth \u7684\u6807\u51c6\u63a5\u53e3\u8bf7\u6c42\u8f6c\u5230\u5bbf\u4e3b App\u3002\u8f93\u5165\u4e8b\u4ef6\u3001\u751f\u547d\u5468\u671f\u3001\u5b58\u50a8\u5219\u901a\u8fc7 vmservice \u7684\u5e7f\u64ad\u901a\u9053\u540c\u6b65\u3002\u8fd9\u4e9b\u8bbe\u8ba1\u5408\u8d77\u6765\uff0c\u4f7f guest \u5728\u6807\u51c6 Android \u770b\u6765\u662f\u4e00\u53f0\u5b8c\u6574\u7684\u8bbe\u5907\uff0c\u800c\u5728\u5bbf\u4e3b\u770b\u6765\u53ea\u662f\u4e00\u4e2a\u666e\u901a App \u76ee\u5f55\u91cc\u7684\u4e00\u5806\u6587\u4ef6\u548c\u4e00\u7ec4\u8fdb\u7a0b\u3002"));
bodyChildren.push(h2("5.6 \u5206\u53d1\u5c42\u7684\u7248\u672c\u517c\u5bb9\u63a7\u5236"));
bodyChildren.push(body("manifest.json \u91cc\u7684 minimum_app_ver \u4e0e support_a32/support_a64 \u7ec4\u6210\u4e86\u53cc\u5411\u725b\u9501\uff1a\u65b0 ROM \u62d2\u7edd\u88ab\u800a\u5bb9\u5668\u52a0\u8f7d\uff0c\u65e7\u5bb9\u5668\u4e5f\u4e0d\u4f1a\u62c9\u53d6\u65b0 ROM\u3002rom_version 1034 \u7528\u4e8e\u5dee\u91cf\u5347\u7ea7\u3002\u8fd9\u4e00\u5957\u673a\u5236\u4f7f\u5f97\u5bb9\u5668\u8fd0\u884c\u65f6\u4e0e ROM \u53ef\u4ee5\u72ec\u7acb\u8fed\u4ee3\uff0c\u662f\u5546\u4e1a\u5316\u5206\u53d1\u4f53\u7cfb\u7684\u57fa\u77f3\uff0c\u540c\u6837\u503c\u5f97\u5f00\u6e90\u9879\u76ee\u540c\u7c7b\u573a\u666f\u501f\u9274\u3002"));

/* ============ 六、AEmulator 对照诊断 ============ */
bodyChildren.push(h1("\u516d\u3001AEmulator \u5bf9\u7167\u8bca\u65ad\u4e0e\u501f\u9274\u65b9\u6848"));
bodyChildren.push(h2("6.1 adb shell \u6b8b\u7f3a\u7684\u6839\u56e0\u5206\u6790"));
bodyChildren.push(body("AEmulator \u7684\u7528\u6237\u53cd\u9988\u662f\uff1a\u4ec5\u63d0\u4f9b\u4e00\u4e2a adb shell\uff0c\u4e14\u53ea\u6709 ls \u7b49\u5c11\u6570\u547d\u4ee4\u6709\u6548\uff0c\u7a0d\u9ad8\u7ea7\u547d\u4ee4\u5168\u90e8\u5931\u6548\uff0c\u5185\u90e8\u65e0\u6cd5\u83b7\u53d6 root \u4e0e\u5b89\u88c5\u6a21\u5757\u3002\u7ed3\u5408\u5176\u67b6\u6784\uff08QEMU \u4fee\u8865\u7248\u8dd1\u65e7\u7248 Android\u30015.0+ \u8d70\u539f\u751f arm64\uff09\uff0c\u53ef\u4ee5\u63a8\u5b9a\u51e0\u7c7b\u5178\u578b\u75c5\u56e0\uff1a\u5176\u4e00\uff0cshell \u4f1a\u8bdd\u7684 PATH \u4e0e toybox/toolbox \u5b89\u88c5\u4e0d\u5b8c\u6574\uff0c\u5bfc\u81f4\u591a\u6570\u547d\u4ee4\u4e0d\u5728\u8def\u5f84\u4e0a\uff1b\u5176\u4e8c\uff0c\u7cfb\u7edf\u670d\u52a1\u6808\uff08prop \u670d\u52a1\u3001lmkd\u3001vold\u3001installd\uff09\u672a\u62c9\u8d77\u6216\u4e0e shell \u8131\u8282\uff0c\u4f9d\u8d56\u7cfb\u7edf\u670d\u52a1\u7684\u547d\u4ee4\u5fc5\u7136\u5931\u8d25\uff1b\u5176\u4e09\uff0cshell \u8fd0\u884c\u5728\u53d7\u9650 uid \u4e0b\uff0c\u5bf9 /system \u7b49\u8def\u5f84\u65e0\u5199\u6743\uff1b\u5176\u56db\uff0c\u65e0 magiskd \u7c7b\u7684\u6388\u6743\u5b88\u62a4\uff0c\u6ca1\u6709 su \u53ef\u8a00\u3002\u56db\u4e2a\u95ee\u9898\u90fd\u6307\u5411\u540c\u4e00\u4e2a\u7ed3\u8bba\uff1a\u7f3a\u7684\u4e0d\u662f\u6a21\u62df\u5668\u80fd\u529b\uff0c\u800c\u662f\u4e00\u5957\u5b8c\u6574\u7684\u7528\u6237\u6001\u3002"));
bodyChildren.push(h2("6.2 VMOS \u65b9\u6848\u7684\u4e09\u6761\u53ef\u79fb\u690d\u8def\u5f84"));
bodyChildren.push(bodyRuns([
  { text: "\u8def\u5f84\u4e00\uff0c\u8865\u5168\u7528\u6237\u6001\u6808\u3002", bold: true },
  { text: "\u628a guest \u5f53\u4f5c\u771f\u8bbe\u5907\u5bf9\u5f85\uff1a\u5b8c\u6574\u89e3\u6811 AOSP rootfs\uff08\u542b init\u3001zygote\u3001toybox\u3001adbd\uff09\uff0c\u4ece app_process64 \u6b63\u5f0f\u542f\u52a8\u3002VMOS \u7684 fs/ \u6811\u5df2\u9a8c\u8bc1\u6b64\u8def\u53ef\u884c\u4e14\u6210\u672c\u4e3b\u8981\u5728\u9996\u6b21\u6784\u5efa\u3002\u5bf9 AEmulator \u800c\u8a00\uff0c\u65e7\u7248 guest\uff082.3-4.4\uff09\u53ef\u4ee5\u6cbf\u7528\u5176\u73b0\u6709 QEMU \u5f15\u64ce\uff0c\u4f46\u9700\u628a\u6bcf\u7247\u56fa\u4ef6\u7684 init \u4f53\u7cfb\u771f\u6b63\u8dd1\u8d77\u6765\u800c\u975e\u53ea\u6302\u4e00\u4e2a\u6b8b\u58f3 shell\u3002" },
]));
bodyChildren.push(bodyRuns([
  { text: "\u8def\u5f84\u4e8c\uff0c\u642d\u5efa\u5bb9\u5668\u5185 su \u7ba1\u7406\u5c42\u3002", bold: true },
  { text: "\u76f4\u63a5\u590d\u7528\u5b98\u65b9 Magisk\uff08\u672c\u62a5\u544a\u5df2\u9a8c\u8bc1 v27.0 \u53ef\u76f4\u63a5\u4f7f\u7528\uff09\uff1a\u5728\u5bb9\u5668\u5185\u4ee5\u5bbf\u4e3b uid \u62c9\u8d77 magiskd\uff0c\u622a\u622a getuid \u7cfb\u5217\u63a5\u53e3\u4f2a\u9020 root\uff0c\u4fdd\u7559\u5b98\u65b9\u6388\u6743 UI\u3002\u8fd9\u4e00\u6b65\u4e4b\u540e\uff0c\u5bb9\u5668\u5185 su\u3001\u6a21\u5757\u5b89\u88c5\u3001Magisk Manager \u5168\u90e8\u81ea\u52a8\u5c31\u7eea\uff0c\u4e0b\u6e38\u6a21\u5757\u751f\u6001\u514d\u8d39\u767d\u5a95\u3002" },
]));
bodyChildren.push(bodyRuns([
  { text: "\u8def\u5f84\u4e09\uff0c\u628a adb \u505a\u6210\u771f\u7684\u3002", bold: true },
  { text: "guest \u81ea\u5e26\u7684 adbd\uff08com.android.adbd APEX \u542b\u914d\u5bf9\u5e93\uff09\u914d\u5408\u5bbf\u4e3b\u4fa7 libadb.so \u4e0e AdbPairingService\uff0c\u53ef\u4ee5\u628a\u5bb9\u5668 ADB \u4ee5\u672c\u5730\u56de\u73af\u6216\u914d\u5bf9\u65b9\u5f0f\u5f00\u653e\u7ed9\u5f00\u53d1\u8005\u3002\u76f8\u6bd4\u5411\u7528\u6237\u66b4\u9732\u4e00\u4e2a\u5b9a\u5236\u7684\u6b8b\u58f3 shell\uff0c\u66b4\u9732\u6807\u51c6 ADB \u534f\u8bae\u7684\u6210\u672c\u66f4\u4f4e\u3001\u517c\u5bb9\u9762\u66f4\u5e7f\uff0c\u8fd8\u80fd\u76f4\u63a5\u590d\u7528\u5168\u4e16\u754c\u7684 adb \u5de5\u5177\u94fe\u3002" },
]));
bodyChildren.push(h2("6.3 \u5206\u9636\u6bb5\u843d\u5730\u5efa\u8bae"));
bodyChildren.push(caption("\u8868 6-1  \u5efa\u8bae\u7684\u5b9e\u65bd\u4f18\u5148\u7ea7"));
bodyChildren.push(tbl(
  ["\u9636\u6bb5", "\u76ee\u6807", "\u5173\u952e\u52a8\u4f5c", "\u9a8c\u6536\u6807\u51c6"],
  [
    ["P0", "shell \u53ef\u7528\u6027", "\u89e3\u6811\u5b8c\u6574 rootfs\uff0c\u786e\u4fdd toybox \u5168\u91cf\u547d\u4ee4\u5728 PATH\uff0c\u62c9\u8d77 prop \u670d\u52a1", "ps\u3001top\u3001pm\u3001am \u5728 adb shell \u4e2d\u6b63\u5e38\u8fd0\u884c"],
    ["P1", "root \u7ba1\u7406", "\u62c9\u8d77 magiskd\uff0c\u622a\u622a uid \u63a5\u53e3\uff0c\u9884\u7f6e Magisk Manager", "su \u6388\u6743\u5f39\u7a97\u53ef\u7528\uff0c\u6a21\u5757\u53ef\u5b89\u88c5"],
    ["P2", "\u6807\u51c6 ADB", "guest adbd + \u5bbf\u4e3b\u56de\u73af\u4ee3\u7406/\u914d\u5bf9", "\u5916\u90e8 adb connect \u53ef\u76f4\u8fde\u5bb9\u5668"],
    ["P3", "\u6a21\u5757\u751f\u6001", "fs \u6811\u6587\u4ef6\u7ea7\u53e0\u52a0\u5b9e\u73b0\u6a21\u5757\u6302\u8f7d\uff0c\u517c\u5bb9 Xposed \u6808", "\u4e3b\u6d41 LSPosed \u7c7b\u6a21\u5757\u53ef\u751f\u6548"],
  ],
  [10, 20, 40, 30]
));
bodyChildren.push(body("\u9700\u8981\u5f3a\u8c03\u7684\u98ce\u9669\u8fb9\u754c\u662f\uff1a\u8fd9\u5957\u65b9\u6848\u7684 root \u4ec5\u5728\u5bb9\u5668\u5185\u90e8\u6709\u6548\uff0c\u4e0d\u80fd\u4e5f\u4e0d\u5e94\u8be5\u8d8a\u754c\u5230\u5bbf\u4e3b\uff1b\u62e6\u622a\u5c42\u9700\u8981\u8fde\u7eed\u7ef4\u62a4\u4ee5\u9002\u914d\u65b0\u7248\u5b89\u5353\u7684 bionic/ART \u53d8\u5316\uff08VMOS \u7528\u5206\u7248\u672c\u5e93\u5316\u89e3\u51b3\uff09\uff1b\u5f15\u5165 Magisk \u540e\u9700\u8981\u5904\u7406\u5176\u81ea\u8eab\u7684\u5b8c\u6574\u6027\u68c0\u6d4b\u4e0e\u73af\u5883\u5dee\u5f02\uff08\u4f8b\u5982\u6302\u8f7d\u7c7b\u64cd\u4f5c\u5fc5\u987b\u964d\u7ea7\u4e3a\u6587\u4ef6\u53e0\u52a0\uff09\u3002"));

/* ============ 七、附录 ============ */
bodyChildren.push(h1("\u4e03\u3001\u9644\u5f55"));
bodyChildren.push(h2("7.1 \u5173\u952e\u8bc1\u636e\u6587\u4ef6\u6e05\u5355"));
bodyChildren.push(caption("\u8868 7-1  \u672c\u6b21\u5206\u6790\u7684\u5173\u952e\u5b9e\u8bc1\u6587\u4ef6"));
bodyChildren.push(tbl(
  ["\u6587\u4ef6/\u4f4d\u7f6e", "\u8bc1\u636e\u5185\u5bb9"],
  [
    ["manifest.json", "\u5206\u53d1\u534f\u8bae\u3001e=x/c=v2 \u53c2\u6570\u3001\u7ec4\u4ef6\u7248\u672c\u7ed1\u5b9a"],
    ["rom.img \u2192 fs/system/build.prop", "marlin:12 \u6307\u7eb9\u3001SDK 32\u3001\u91cd\u65b0\u6784\u5efa\u65f6\u95f4 2026-06-02"],
    ["magisk.zip \u2192 sbin/magisk64", "2c6adbc6:MAGISK:D (27000) \u7248\u672c\u5b57\u7b26\u4e32"],
    ["magisk.zip \u2192 sbin/.magisk/config", "KEEPVERITY/KEEPFORCEENCRYPT \u7b49\u5b89\u88c5\u53c2\u6570"],
    ["libkr64.12.so", "vm/vm%d/fs \u8def\u5f84\u3001TUN \u901a\u9053\u3001shadowhook\u3001\u516d\u5927\u521d\u59cb\u5316\u6a21\u5757"],
    ["libkrloader64.so", "out_gp/target/product/marlin \u6784\u5efa\u8def\u5f84"],
    ["fs/system/priv-app/vmservice/", "EXECUTE_COMMAND \u5e7f\u64ad\u63a5\u53e3\u3001\u4f4d\u7f6e/\u901a\u77e5/VPN \u670d\u52a1"],
    ["fs/vendor/lib64/hw/*master*.so", "master HAL \u4f53\u7cfb\uff08hwcomposer/camera/gnss\uff09"],
    ["fs/system/etc/selinux/plat_file_contexts", "/system/xbin/su \u5bf9\u5e94 su_exec \u57df\uff08\u6807\u51c6\u6761\u76ee\uff09"],
    ["fs/system/apex/com.android.adbd/", "guest \u5b8c\u6574 adbd \u4e0e\u914d\u5bf9\u5e93"],
    ["Epic.vm", "XOR 0x1F \u53ef\u89e3\uff0cEpic_ \u9b54\u6570 + \u8282\u8868\uff1b\u5185\u5c42\u5bc6\u94a5\u5f85\u52a8\u6001\u6293\u53d6"],
  ],
  [42, 58]
));
bodyChildren.push(h2("7.2 \u672a\u5c3d\u4e8b\u9879\u4e0e\u540e\u7eed\u5efa\u8bae"));
bodyChildren.push(body("\u5c1a\u672a\u89e3\u5bc6\u7684\u4e24\u4e2a\u5305\uff1asuperuser.zip\uff08su \u7ba1\u7406\u5668\uff0c\u63a8\u6d4b\u4e3a VMOS \u81ea\u6709 Superuser \u754c\u9762\u6216 su \u8865\u5145\u5305\uff09\u4e0e xposed.zip\uff08Xposed \u6846\u67b6\u5305\uff09\u3002\u4e8c\u8005\u5bc6\u94a5\u5747\u5728 Epic.vm \u7684\u52a0\u5bc6\u8282\u5185\uff0c\u540e\u7eed\u5982\u9700\u62ff\u5230\u660e\u6587\uff0c\u5efa\u8bae\u5728\u5b89\u5353\u771f\u673a/\u6a21\u62df\u5668\u5b89\u88c5\u8be5 App\uff0c\u7528 Frida hook libEPIC.so \u7684\u89e3\u5bc6\u51fd\u6570\uff08\u7279\u5f81\uff1a\u542b dex_protection_rc4_key \u7b49\u914d\u7f6e\u952e\u540d\u7684\u51fd\u6570\u7fa4\uff09\u76f4\u63a5\u843d\u76d8\u660e\u6587\u3002\u6b64\u5916\uff0c\u82e5\u540e\u7eed\u9700\u8981\u5206\u6790\u4e3b\u4f53\u4e1a\u52a1\u903b\u8f91\uff0c\u53ef\u5728\u8fd0\u884c\u65f6 dump VmObject \u5206\u53d1\u540e\u7684\u771f\u5b9e dex\uff1b\u82e5\u9700\u8981\u9a8c\u8bc1 magiskd \u5728\u5bb9\u5668\u5185\u7684\u5b9e\u9645\u542f\u52a8\u53c2\u6570\uff0c\u53ef\u5728\u771f\u673a\u4e0a\u8fd0\u884c\u540e\u5bf9\u6bd4 ps \u5feb\u7167\u4e0e logcat\u3002"));
bodyChildren.push(h2("7.3 \u672f\u8bed\u8868"));
bodyChildren.push(caption("\u8868 7-2  \u672f\u8bed\u5feb\u901f\u53c2\u8007"));
bodyChildren.push(tbl(
  ["\u672f\u8bed", "\u91ca\u4e49"],
  [
    ["VMP \u58f3", "\u5c06 Java \u65b9\u6cd5\u62bd\u53d6\u4e3a\u81ea\u5b9a\u4e49\u865a\u62df\u673a\u6307\u4ee4\u5e76\u7531 native \u5206\u53d1\u5668\u6267\u884c\u7684\u52a0\u56fa\u65b9\u6848"],
    ["EOCD", "ZIP End Of Central Directory\uff0c\u4f4d\u4e8e ZIP \u6587\u4ef6\u672b\u5c3e\u7684\u56fa\u5b9a\u7ed3\u6784\u5c3e\u5757"],
    ["kEncodedHeader", "7z \u4e2d\u8868\u793a\u5934\u90e8\u672c\u8eab\u88ab\u538b\u7f29\u7684\u5c5e\u6027\u6807\u8bc6\uff080x17\uff09"],
    ["linker namespace", "\u5b89\u5353 bionic \u94fe\u63a5\u5668\u7684\u5e93\u641c\u7d22\u57df\u9694\u79bb\u673a\u5236"],
    ["shadowhook", "\u5b57\u8282\u8df3 inline hook \u5e93\uff0c\u7528\u4e8e\u7528\u6237\u6001\u62e6\u622a native \u51fd\u6570\u8c03\u7528"],
    ["TUN", "\u865a\u62df\u7f51\u7edc\u8bbe\u5907\uff0c\u5728\u7528\u6237\u6001\u63a5\u6536 IP \u5305\u4ee5\u5b9e\u73b0\u7f51\u7edc\u8f6c\u53d1"],
    ["HAL", "\u786c\u4ef6\u62bd\u8c61\u5c42\uff0cAndroid \u5b9a\u4e49\u7684\u786c\u4ef6\u670d\u52a1\u63a5\u53e3\u89c4\u8303"],
    ["APEX", "\u5b89\u5353\u53ef\u5347\u7ea7\u7cfb\u7edf\u6a21\u5757\u683c\u5f0f\uff0cadbd/ART \u7b49\u5747\u4ee5\u6b64\u5f62\u5f0f\u5206\u53d1"],
  ],
  [22, 78]
));

/* ---------- 目录节 ---------- */
const tocChildren = [
  new Paragraph({
    spacing: { before: 200, after: 200 },
    children: [new TextRun({ text: "\u6458\u3000\u8981", bold: true, size: 32, color: "000000", font: { eastAsia: "SimHei", ascii: "Times New Roman" } })],
    alignment: AlignmentType.CENTER,
  }),
  body("\u672c\u62a5\u544a\u57fa\u4e8e\u7528\u6237\u63d0\u4f9b\u7684\u865a\u62df\u5927\u5e08\uff08VMOS\uff09\u7834\u89e3\u7248 3.2.67 APK \u4e0e\u914d\u5957 Android 12 ROM \u6570\u636e\u5305\uff0c\u5b8c\u6210\u4e86\u4e24\u9879\u6838\u5fc3\u9006\u5411\uff1a\u5176\u4e00\uff0c\u7834\u89e3 ROM \u5206\u53d1\u52a0\u5bc6\u4f53\u7cfb\uff0c\u6062\u590d\u51fa 16 \u5b57\u8282\u5f02\u6216\u5bc6\u94a5 %z89aviCM0KkbEs9\uff0c\u5168\u91cf\u89e3\u5bc6 rom.img/rom1.img/magisk.zip \u5e76\u83b7\u5f97\u5b8c\u6574\u7684 Android 12 \u6839\u6587\u4ef6\u7cfb\u7edf\u6811\uff1b\u5176\u4e8c\uff0c\u57fa\u4e8e\u89e3\u5bc6\u4ea7\u7269\u5b9e\u8bc1\u4e86 root \u5b9e\u73b0\u65b9\u6848\uff08\u5b98\u65b9 Magisk v27.0 + \u5bb9\u5668\u5185 uid \u865a\u6784\uff09\u4e0e\u517c\u5bb9\u67b6\u6784\uff08\u5171\u4eab\u5185\u6838\u5bb9\u5668 + libkr \u5206\u7248\u672c\u5185\u6838\u63a5\u53e3\u5e93 + \u8def\u5f84\u91cd\u5b9a\u5411\uff09\uff0c\u5e76\u9488\u5bf9 AEmulator \u7684 adb shell \u6b8b\u7f3a\u95ee\u9898\u7ed9\u51fa\u56db\u9636\u6bb5\u843d\u5730\u65b9\u6848\u3002superuser.zip \u4e0e xposed.zip \u7684\u5bc6\u94a5\u4f4d\u4e8e VMP \u5143\u6570\u636e\u5185\u5c42\uff0c\u9700\u52a8\u6001\u5206\u6790\u6293\u53d6\uff0c\u4e0d\u5f71\u54cd\u4e3b\u7ed3\u8bba\u3002"),
  new Paragraph({
    pageBreakBefore: true,
    spacing: { before: 200, after: 200 },
    children: [new TextRun({ text: "\u76ee\u3000\u5f55", bold: true, size: 32, color: "000000", font: { eastAsia: "SimHei", ascii: "Times New Roman" } })],
    alignment: AlignmentType.CENTER,
  }),
  new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: "\uff08\u5728 Word/WPS \u4e2d\u53f3\u952e\u76ee\u5f55\u2192\u9009\u62e9\u66f4\u65b0\u57df\uff0c\u53ef\u5237\u65b0\u9875\u7801\uff09", italics: true, size: 18, color: "8090A0", font: { eastAsia: "SimSun", ascii: "Times New Roman" } })],
  }),
  new TableOfContents("\u76ee\u5f55", { hyperlink: true, headingStyleRange: "1-3" }),
];

/* ---------- 组装文档 ---------- */
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const doc = new Document({
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
    { /* 封面 */
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        title: "\u865a\u62df\u5927\u5e08\uff08VMOS\uff09\u7834\u89e3\u7248\u6df1\u5ea6\u9006\u5411\u5206\u6790\u62a5\u544a",
        subtitle: "Android 12 ROM \u6570\u636e\u5305\u89e3\u5bc6 \u00b7 Root \u5b9e\u73b0\u65b9\u6848 \u00b7 \u5bb9\u5668\u5316\u517c\u5bb9\u67b6\u6784",
        englishLabel: "REVERSE ENGINEERING REPORT",
        metaLines: [
          "\u6837\u672c\uff1aVMOS 3.2.67 \u7834\u89e3\u7248 APK + rom_default_12.1.0 \u6570\u636e\u5305",
          "\u65b9\u6cd5\uff1a\u9759\u6001\u53cd\u7f16\u8bd1 \u00b7 \u5df2\u77e5\u660e\u6587\u5bc6\u94a5\u6062\u590d \u00b7 \u5bb9\u5668\u8fd0\u884c\u65f6\u8bc1\u636e\u94fe",
          "\u5bc6\u94a5\uff1a257A3839 61766943 4D304B6B 62457339",
          "\u65e5\u671f\uff1a2026 \u5e74 11 \u6708 13 \u65e5",
        ],
        footerLeft: "VMOS Reverse Analysis",
        footerRight: "v2.0 / 2026-11",
        palette: PAL,
      }),
    },
    { /* 摘要+目录 Roman */
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      headers: { default: docHeader() },
      footers: { default: pageNumFooter() },
      children: tocChildren,
    },
    { /* 正文 Arabic */
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: docHeader() },
      footers: { default: pageNumFooter() },
      children: bodyChildren,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/z/my-project/download/\u865a\u62df\u5927\u5e08_3.2.67_\u9006\u5411\u5206\u6790\u62a5\u544a_v2.docx", buf);
  console.log("DOCX generated OK");
});
