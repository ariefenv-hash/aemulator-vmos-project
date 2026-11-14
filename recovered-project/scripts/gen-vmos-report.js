/**
 * gen-report.js — 虚拟大师 3.2.67 逆向分析报告生成
 * 分析报告 (Template A) · R1 封面 · Dawn Mist Tech 配色 · 3 段式页码
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, TableOfContents, PageBreak,
  SectionType, TableLayoutType,
} = require("docx");
const fs = require("fs");

/* ---------------- 配色：Dawn Mist Tech（科技报告） ---------------- */
const P = {
  primary: "0A1628", body: "000000", secondary: "506070",
  accent: "5B8DB8", surface: "F4F8FC",
  cover: {
    bg: "0A1628", titleColor: "FFFFFF", subtitleColor: "C8D8E8",
    metaColor: "A8BCCF", accent: "5B8DB8", footerColor: "7A92A8",
  },
};

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

/* ---------------- 封面辅助函数（design-system 标准实现） ---------------- */
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."\uff0c\u3002\u3001\uff1b\uff1a\uff01\uff1f", ..."\u7684\u4e0e\u548c\u53ca\u4e4b\u5728\u4e8e\u4e3a", ..."-_\u2014\u2013\u00b7/", ..." \t"]);
  const lines = [];
  let rest = title;
  while (rest.length > charsPerLine) {
    let cut = -1;
    for (let i = Math.min(charsPerLine, rest.length - 1); i >= Math.floor(charsPerLine * 0.6); i--) {
      if (breakAfter.has(rest[i])) { cut = i; break; }
    }
    if (cut < 0) cut = charsPerLine;
    lines.push(rest.slice(0, cut + 1));
    rest = rest.slice(cut + 1);
  }
  if (rest.length > 0) {
    if (rest.length <= 2 && lines.length > 0) lines[lines.length - 1] += rest;
    else lines.push(rest);
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
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, midSpacing: Math.max(safeRemaining - topSpacing - bottomSpacing, 0), bottomSpacing };
}

/* ---------------- R1 封面（Pure Paragraph Left） ---------------- */
function buildCoverR1(config) {
  const C = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: C.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "), size: 18, color: C.accent, font: { ascii: "Calibri", eastAsia: "SimHei" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true, color: C.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: C.subtitleColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: C.metaColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: C.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: C.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: C.footerColor, font: { ascii: "Arial" } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: C.bg }, borders: noBorders, children })],
    })],
  })];
}

/* ---------------- 正文构件 ---------------- */
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: P.primary, font: { eastAsia: "SimHei", ascii: "Times New Roman" } })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: P.primary, font: { eastAsia: "SimHei", ascii: "Times New Roman" } })],
  });
}
function body(text, opts = {}) {
  const runs = Array.isArray(text) ? text : [{ text }];
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 312, after: opts.after ?? 80 },
    children: runs.map(r => new TextRun({
      text: r.text, bold: !!r.bold, size: 24, color: P.body,
      font: { eastAsia: "SimSun", ascii: "Times New Roman" },
    })),
  });
}
function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER, keepNext: false,
    spacing: { before: 60, after: 200, line: 312 },
    children: [new TextRun({ text, size: 21, color: P.secondary, font: { eastAsia: "SimSun", ascii: "Times New Roman" } })],
  });
}
function tableTitle(text) {
  return new Paragraph({
    keepNext: true, alignment: AlignmentType.CENTER,
    spacing: { before: 160, after: 80, line: 312 },
    children: [new TextRun({ text, bold: true, size: 21, color: P.primary, font: { eastAsia: "SimHei", ascii: "Times New Roman" } })],
  });
}
function mkTable(headers, rows, widths) {
  const cellMargins = { top: 60, bottom: 60, left: 120, right: 120 };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: P.accent },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: P.accent },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D5DEE8" },
      insideVertical: NB,
    },
    rows: [
      new TableRow({
        tableHeader: true, cantSplit: true,
        children: headers.map((t, i) => new TableCell({
          shading: { type: ShadingType.CLEAR, fill: P.surface },
          margins: cellMargins,
          width: { size: widths[i], type: WidthType.PERCENTAGE },
          children: [new Paragraph({ spacing: { line: 312 }, children: [new TextRun({ text: t, bold: true, size: 21, color: P.primary, font: { eastAsia: "SimHei", ascii: "Times New Roman" } })] })],
        })),
      }),
      ...rows.map((row, ri) => new TableRow({
        cantSplit: true,
        children: row.map((t, i) => new TableCell({
          shading: ri % 2 === 1 ? { type: ShadingType.CLEAR, fill: "FAFCFE" } : undefined,
          margins: cellMargins,
          width: { size: widths[i], type: WidthType.PERCENTAGE },
          children: [new Paragraph({ spacing: { line: 312 }, children: [new TextRun({ text: t, size: 21, color: P.body, font: { eastAsia: "SimSun", ascii: "Times New Roman" } })] })],
        })),
      })),
    ],
  });
}

/* ---------------- 页眉页脚 ---------------- */
function pageHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "C9D6E2", space: 4 } },
      children: [new TextRun({ text: "\u865a\u62df\u5927\u5e08 3.2.67 \u9006\u5411\u5206\u6790\u62a5\u544a", size: 18, color: "808080", font: { eastAsia: "SimSun", ascii: "Times New Roman" } })],
    })],
  });
}
function pageNumFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080" })],
    })],
  });
}

/* ---------------- 正文内容 ---------------- */
const bodyChildren = [];

/* ============ 1. 摘要 ============ */
bodyChildren.push(h1("\u4e00\u3001\u6458\u8981"));
bodyChildren.push(body([
  { text: "\u672c\u62a5\u544a\u5bf9\u4e0a\u4f20\u7684\u201c\u865a\u62df\u5927\u5e08\u201d\u7834\u89e3\u7248\uff08\u5305\u540d com.clone.android.dual.space\uff0c\u7248\u672c 3.2.67\uff0c161 MB\uff09\u5b8c\u6210\u4e86\u9759\u6001\u9006\u5411\u5206\u6790\uff0c\u76ee\u6807\u662f\u641e\u6e05\u4e24\u4e2a\u95ee\u9898\uff1a\u5b83\u5728\u65e0 root \u5b89\u5353\u624b\u673a\u4e0a\u5957\u5a03\u8fd0\u884c\u5b8c\u6574\u5b89\u5353\u65f6\u7684 root \u5b9e\u73b0\u65b9\u6848\uff0c\u4ee5\u53ca\u5b83\u7684\u7cfb\u7edf\u7248\u672c\u517c\u5bb9\u67b6\u6784\u3002\u5206\u6790\u7ed3\u679c\u5c06\u76f4\u63a5\u670d\u52a1\u4e8e AEmulator \u9879\u76ee adb shell \u529f\u80fd\u6b8b\u7f3a\u95ee\u9898\u7684\u4fee\u590d\u53c2\u7167\u3002" },
]));
bodyChildren.push(body([
  { text: "\u6838\u5fc3\u7ed3\u8bba\u5148\u884c\uff1a\u8be5\u5e94\u7528\u7684 root \u80fd\u529b\u5e76\u975e\u4f20\u7edf\u610f\u4e49\u4e0a\u7684\u63d0\u6743\uff0c\u800c\u662f\u201c\u5185\u90e8\u8d44\u6e90\u5f00\u7bb1\u5373\u7528\u201d\u6a21\u5f0f\u2014\u2014\u5b89\u88c5\u5305\u5185\u76f4\u63a5\u643a\u5e26\u4e86\u52a0\u5bc6\u7684 " },
  { text: "magisk.zip\uff0815.1 MB\uff09\u3001superuser.zip\uff081.4 MB\uff09\u3001xposed.zip\uff084.3 MB\uff09", bold: true },
  { text: " \u4e09\u4e2a\u5185\u90e8\u63d2\u4ef6\uff0c\u865a\u62df\u673a\u5b9e\u4f8b\u521b\u5efa\u65f6\u89e3\u5bc6\u6ce8\u5165\u5230\u5ba2\u673a\u7cfb\u7edf\u76ee\u5f55\u6811\uff08\u4f4d\u4e8e\u5bbf\u4e3b\u5e94\u7528\u79c1\u6709\u76ee\u5f55 vm/vmN/fs\uff09\u4e2d\uff0c\u56e0\u6b64\u5ba2\u673a\u7684 root \u5b8c\u5168\u7531\u865a\u62df\u673a\u8fd0\u884c\u65f6\u63a7\u5236\uff0c\u4e0e\u5bbf\u4e3b\u673a\u662f\u5426 root \u65e0\u5173\u3002\u8fd9\u4e0e AEmulator \u76ee\u524d\u4ec5\u63d0\u4f9b\u6b8b\u7f3a adb shell \u3001\u65e0\u6cd5\u5b89\u88c5\u6a21\u5757\u7684\u73b0\u72b6\u5f62\u6210\u76f4\u63a5\u5bf9\u7167\uff1a\u4e24\u8005\u540c\u6837\u62e5\u6709\u5ba2\u673a\u6587\u4ef6\u7cfb\u7edf\u7684\u5b8c\u5168\u63a7\u5236\u6743\uff0cAEmulator \u7f3a\u7684\u53ea\u662f\u628a\u8fd9\u4e00\u63a7\u5236\u6743\u8f6c\u5316\u4e3a\u7528\u6237\u53ef\u7528 root \u4e0e\u6a21\u5757\u4f53\u7cfb\u7684\u4ea4\u4ed8\u5de5\u7a0b\u3002" },
]));

/* ============ 2. 背景与目标 ============ */
bodyChildren.push(h1("\u4e8c\u3001\u5206\u6790\u80cc\u666f\u4e0e\u76ee\u6807"));
bodyChildren.push(body("\u5f53\u524d\u5728\u5b89\u5353\u8bbe\u5907\u4e0a\u5b9e\u73b0\u201c\u5b89\u5353\u5957\u5b89\u5353\u201d\u7684\u4e3b\u6d41\u4ea7\u54c1\u4e2d\uff0c\u865a\u62df\u5927\u5e08\u7cfb\u5217\u4e0e\u5149\u901f\u865a\u62df\u673a\u7cfb\u5217\u662f\u4e24\u4e2a\u4ee3\u8868\u3002\u59d4\u6258\u65b9\u9009\u62e9\u865a\u62df\u5927\u5e08\u4f5c\u4e3a\u5206\u6790\u6837\u672c\u7684\u539f\u56e0\u6709\u4e8c\uff1a\u5176\u4e00\uff0c\u624b\u5934\u6837\u672c\u4e3a\u7834\u89e3\u7248\u672c\uff0c\u5185\u90e8\u8d44\u6e90\u53ef\u76f4\u63a5\u83b7\u53d6\uff0c\u5206\u6790\u969c\u788d\u5c0f\uff1b\u5176\u4e8c\uff0c\u8be5\u7248\u672c\u5df2\u652f\u6301 Android 12 \u7ea7\u522b\u7684\u5185\u90e8\u7cfb\u7edf\u955c\u50cf\uff08\u91c7\u7528\u5382\u5546\u81ea\u5206\u53d1\u7684\u52a0\u5bc6\u683c\u5f0f\uff09\uff0c\u6280\u672f\u4ee3\u8868\u6027\u5f3a\u3002\u800c AEmulator\uff08uxazu/AEmulator\uff0cGPL-3.0\uff09\u867d\u80fd\u517c\u5bb9\u591a\u79cd\u56fa\u4ef6\u5e76\u8f83\u7a33\u5b9a\u8fd0\u884c\uff0c\u4f46 root \u7ba1\u7406\u8584\u5f31\uff1a\u4ec5\u63d0\u4f9b\u4e00\u4e2a adb shell \u5165\u53e3\uff0c\u4e14\u5927\u91cf\u5e38\u7528\u547d\u4ee4\u65e0\u6cd5\u6267\u884c\uff08\u4ec5 ls \u7b49\u5c11\u6570\u547d\u4ee4\u6709\u6548\uff09\uff0c\u5185\u90e8\u65e0\u6cd5\u83b7\u53d6 root\u3001\u65e0\u6cd5\u5b89\u88c5\u6a21\u5757\u3002"));
bodyChildren.push(body("\u672c\u6b21\u5206\u6790\u7684\u76ee\u6807\u660e\u786e\u4e3a\u4e09\u9879\uff1a\u7b2c\u4e00\uff0c\u5b9e\u8bc1\u865a\u62df\u5927\u5e08\u7684 root \u4f53\u7cfb\u7ec4\u6210\u4e0e\u6388\u6743\u94fe\u8def\uff1b\u7b2c\u4e8c\uff0c\u68b3\u6e05\u5176 Android-in-Android \u517c\u5bb9\u5206\u5c42\u67b6\u6784\uff1b\u7b2c\u4e09\uff0c\u5c06\u4e0a\u8ff0\u53d1\u73b0\u8f6c\u5316\u4e3a AEmulator \u53ef\u76f4\u63a5\u843d\u5730\u7684\u6539\u8fdb\u65b9\u6848\u3002\u62a5\u544a\u4e0d\u6d89\u53ca\u4efb\u4f55\u7834\u89e3\u52a0\u5bc6\u683c\u5f0f\u7684\u5b9e\u65bd\u6b65\u9aa4\uff0c\u5bf9\u52a0\u5bc6\u4f53\u7cfb\u4ec5\u505a\u5230\u7ed3\u6784\u5c42\u9762\u7684\u63cf\u8ff0\u4e0e\u5b9a\u4f4d\u3002"));

/* ============ 3. 范围与方法 ============ */
bodyChildren.push(h1("\u4e09\u3001\u5206\u6790\u8303\u56f4\u3001\u6837\u672c\u4e0e\u65b9\u6cd5"));
bodyChildren.push(body("\u5206\u6790\u5728\u9694\u79bb\u6c99\u7bb1\u73af\u5883\u4e2d\u5b8c\u6210\uff0c\u5de5\u5177\u94fe\u4e3a\uff1a\u6807\u51c6 ZIP \u89e3\u6790\uff08\u5305\u4f53\u7ed3\u6784\u4e0e\u8d44\u6e90\u6e05\u5355\uff09\u3001jadx 1.5.6\uff08Java/Kotlin \u53cd\u7f16\u8bd1\uff09\u3001apktool 3.0.3\uff08\u8d44\u6e90\u4e0e Manifest \u89e3\u6790\uff09\u3001readelf/strings\uff08ELF \u7b26\u53f7\u4e0e\u5b57\u7b26\u4e32\u60c5\u62a5\uff09\u53ca Python \u81ea\u5199\u811a\u672c\uff08\u52a0\u5bc6\u5bb9\u5668\u5934\u90e8\u7ed3\u6784\u9a8c\u8bc1\uff09\u3002\u5206\u6790\u7ef4\u5ea6\u8986\u76d6\uff1a\u5305\u4f53\u7ed3\u6784\u3001Manifest \u4e0e\u7ec4\u4ef6\u8868\u3001\u53ef\u89c1 Java \u5c42\u3001\u539f\u751f\u5e93\u7b26\u53f7\u4e0e\u5b57\u7b26\u4e32\u3001\u8d44\u4ea7\u76ee\u5f55\uff08assets\uff09\u4e0e\u63d2\u4ef6\u5bb9\u5668\u683c\u5f0f\u3002"));
bodyChildren.push(tableTitle("\u8868 1  \u6837\u672c\u57fa\u672c\u4fe1\u606f"));
bodyChildren.push(mkTable(
  ["\u9879\u76ee", "\u5185\u5bb9"],
  [
    ["\u5305\u540d", "com.clone.android.dual.space"],
    ["\u7248\u672c", "3.2.67"],
    ["\u6587\u4ef6\u5927\u5c0f", "168,991,565 \u5b57\u8282\uff08\u7ea6 161 MB\uff09\uff0c\u89e3\u538b\u540e\u7ea6 194 MB"],
    ["SHA-256", "e7aaf62835e0f7a70e36d8222ef5d32cf6a4d6ef79bd48b285985fbc18b8ee49"],
    ["\u5165\u53e3 Application", "Epic.ProtectApp\uff08\u52a0\u56fa\u58f3\uff0c\u5173\u952e\u751f\u547d\u5468\u671f\u65b9\u6cd5\u5168\u90e8 native \u5b9e\u73b0\uff09"],
    ["\u4e3b\u754c\u9762", "com.android.vmapp.ui.MainActivity\uff08\u53e6\u6709 Billing / VMSettings / VMLocation \u7b49\u7ec4\u4ef6\uff09"],
    ["\u6743\u9650\u6570\u91cf", "67 \u9879 uses-permission"],
    ["\u4fdd\u62a4\u65b9\u6848", "Epic \u5546\u4e1a\u52a0\u56fa\uff1a\u4e3b\u4e1a\u52a1\u4ee3\u7801\u52a0\u5bc6\u4e8e Epic.vm\uff0c\u7531 libEPIC.so \u8fd0\u884c\u65f6\u89e3\u5bc6\u52a0\u8f7d"],
  ],
  [28, 72]
));
bodyChildren.push(caption("\u8868\u4e2d\u6570\u636e\u5747\u6765\u81ea\u5bf9\u6837\u672c\u5305\u4f53\u7684\u76f4\u63a5\u89e3\u6790\u4e0e Manifest \u89e3\u6790\u7ed3\u679c"));

/* ============ 4. 总体架构 ============ */
bodyChildren.push(h1("\u56db\u3001\u6837\u672c\u603b\u4f53\u67b6\u6784"));
bodyChildren.push(body([
  { text: "\u53cd\u7f16\u8bd1\u53d1\u73b0\uff0c\u8be5\u5e94\u7528\u7684 Java \u5c42\u53cd\u7f16\u8bd1\u4ea7\u7269\u4ec5 46 \u4e2a\u7c7b\u6587\u4ef6\uff0c\u5176\u4e2d\u4e3b\u4e1a\u52a1\u4ee3\u7801\uff08com.android.vmapp.*\uff09\u5b8c\u5168\u7f3a\u5931\u3002\u8fd9\u662f\u5178\u578b\u7684\u5546\u4e1a\u52a0\u56fa\u58f3\u7279\u5f81\uff1a" },
  { text: "\u771f\u6b63\u7684 VM \u7ba1\u7406\u903b\u8f91\u88ab\u52a0\u5bc6\u5728 resources/Epic.vm\uff0898 KB\uff09\u4e2d\uff0c\u7531 libEPIC.so \u5728\u8fd0\u884c\u65f6\u89e3\u5bc6\u540e\u52a8\u6001\u52a0\u8f7d", bold: true },
  { text: "\u3002\u53ef\u89c1\u7684 46 \u4e2a\u7c7b\u5206\u4e3a\u4e09\u7c7b\uff1a\u52a0\u56fa\u58f3\u672c\u4f53\uff08Epic.ProtectApp / Epic.Protect\uff0c\u63d0\u4f9b VmVoid\u3001VmObject \u7b49 native \u6865\u63a5\u63a5\u53e3\uff09\u3001Xposed API \u6869\u6876\uff08de.robv.android.xposed \u5168\u5957\u63a5\u53e3\uff09\u4e0e Hook \u5f15\u64ce\u7684 Xposed \u6865\u63a5\uff08top.canyie.pine.xposed\u3001aliucord.hook\uff09\u3002" },
]));
bodyChildren.push(body("\u539f\u751f\u5c42\u662f\u672c\u6837\u672c\u7684\u771f\u6b63\u6838\u5fc3\u3002arm64-v8a \u76ee\u5f55\u4e0b\u5171 24.3 MB \u539f\u751f\u5e93\uff0c\u6309\u804c\u8d23\u53ef\u5206\u4e3a\u56db\u7ec4\uff1a\u865a\u62df\u673a\u5185\u6838\uff08libvm.so\uff0c9.2 MB\uff0c\u5168\u91cf OLLVM \u6df7\u6f8f\uff09\u3001\u5206\u7248\u672c\u517c\u5bb9\u8fd0\u884c\u65f6\uff08libkr64/32 \u4e0e libkr64/32.11\u300112 \u7cfb\u5217\uff0c\u5171 6 \u4e2a\u6587\u4ef6\uff0c\u5bf9\u5e94\u4e0d\u540c\u5b89\u5353\u7248\u672c\u7684\u5ba2\u673a\u8fd0\u884c\u65f6\uff09\u3001\u52a0\u56fa\u4e0e Hook \u5f15\u64ce\uff08libEPIC\u3001libEpic_Svc\u3001libaliuhook\u3001liblsplant\u3001libpine\uff09\u4ee5\u53ca\u8f85\u52a9\u7ec4\u4ef6\uff08libadb\u3001libun7z\u3001libkrloader\uff09\u3002"));
bodyChildren.push(tableTitle("\u8868 2  \u5173\u952e\u539f\u751f\u5e93\u6e05\u5355\uff08arm64-v8a\uff09"));
bodyChildren.push(mkTable(
  ["\u5e93\u6587\u4ef6", "\u4f53\u79ef", "\u804c\u8d23\u5224\u5b9a\uff08\u4f9d\u636e\uff09"],
  [
    ["libvm.so", "9.2 MB", "VM \u5185\u6838\uff1b\u5b57\u7b26\u4e32\u5168\u90e8\u8fd0\u884c\u65f6\u89e3\u5bc6\uff08.datadiv_decode \u7279\u5f81\uff09\uff0c\u4f46\u4fdd\u7559\u4e86 5037/5554/5555 \u7aef\u53e3\u5e38\u91cf\u4e0e bootp_reply \u7f51\u7edc\u5b57\u6bb5"],
    ["libkr64.12.so / libkr32.12.so", "2.4 / 2.3 MB", "Android 12 \u5ba2\u673a\u8fd0\u884c\u65f6\uff1b\u5185\u5d4c shadowhook 1.0.8\uff0c\u5f15\u7528\u5ba2\u673a\u6839\u6587\u4ef6\u7cfb\u7edf\u8def\u5f84 vm/vmN/fs \u4e0e TUN \u7f51\u7edc\u63a5\u53e3 tun_N_M"],
    ["libkr64.11.so / libkr32.11.so", "2.2 / 2.3 MB", "Android 11 \u5ba2\u673a\u8fd0\u884c\u65f6\uff0c\u804c\u8d23\u540c\u4e0a\uff0c\u7248\u672c\u540e\u7f00\u533a\u5206"],
    ["libkr64.so / libkr32.so", "1.5 / 1.2 MB", "\u57fa\u7840\u7248\u5ba2\u673a\u8fd0\u884c\u65f6\uff08\u65e9\u671f\u7cfb\u7edf\u7248\u672c\uff09"],
    ["libkrloader64.so / libkrloader32.so", "0.2 / 0.1 MB", "\u8fd0\u884c\u65f6\u52a0\u8f7d\u5668\uff0c\u8d1f\u8d23\u62c9\u8d77 libkr*"],
    ["libEPIC.so", "1.4 MB", "\u52a0\u56fa\u58f3\u6838\u5fc3\uff1b\u5bfc\u51fa\u7b26\u53f7\u540d\u66b4\u9732 asset/dex/axml/resource_string \u4e94\u7ec4 RC4+XOR \u53cc\u5c42\u52a0\u5bc6\u914d\u7f6e\u952e\u540d"],
    ["libadb.so", "0.1 MB", "\u5b98\u65b9 ADB \u65e0\u7ebf\u8c03\u8bd5\u914d\u5bf9\u534f\u8bae\u5e93\uff08PairingContext\uff0cAES-128-GCM\uff09"],
    ["libun7z.so", "0.1 MB", "7z \u89e3\u538b\uff0c\u670d\u52a1\u4e8e\u8d44\u6e90\u5305\u89e3\u5305"],
  ],
  [26, 14, 60]
));
bodyChildren.push(caption("\u4f53\u79ef\u4e3a arm64-v8a \u76ee\u5f55\u4e0b\u5b9e\u9645\u5360\u7528\uff1b\u804c\u8d23\u5224\u5b9a\u7ed3\u5408\u4e86\u7b26\u53f7\u8868\u3001\u5b57\u7b26\u4e32\u4e0e\u8d44\u6e90\u5f15\u7528\u5173\u7cfb"));

/* ============ 5. Root 实现方案 ============ */
bodyChildren.push(h1("\u4e94\u3001Root \u5b9e\u73b0\u65b9\u6848\u6df1\u5ea6\u5206\u6790"));
bodyChildren.push(h2("5.1  \u8bc1\u636e\u94fe\uff1a\u5185\u7f6e\u5f0f root \u8d44\u6e90\u5305"));
bodyChildren.push(body([
  { text: "\u672c\u6b21\u5206\u6790\u6700\u5173\u952e\u7684\u53d1\u73b0\u5728 assets/plugins \u76ee\u5f55\uff08118 MB\uff0c\u5360\u5305\u4f53 61%\uff09\u3002\u9664\u4e86 97.1 MB \u7684\u7cfb\u7edf\u955c\u50cf\u5305 play.zip\uff0c\u8be5\u76ee\u5f55\u7cbe\u786e\u5730\u643a\u5e26\u4e86\u4e00\u5957\u5b8c\u6574\u7684 root \u4e0e\u6a21\u5757\u751f\u6001\uff1a", },
  { text: "magisk.zip\uff0815.1 MB\uff09\u3001superuser.zip\uff081.4 MB\uff09\u3001xposed.zip\uff084.3 MB\uff09", bold: true },
  { text: "\uff0c\u53e6\u6709\u4e00\u4e2a\u96f6\u5b57\u8282\u7684 EMPTY \u5360\u4f4d\u6587\u4ef6\u3002\u4e09\u4e2a\u63d2\u4ef6\u5747\u4e3a\u81ea\u5b9a\u4e49\u52a0\u5bc6\u5bb9\u5668\uff1a\u65e0 ZIP/7z \u9b54\u6570\uff0c\u4fe1\u606f\u71b5\u63a5\u8fd1\u968f\u673a\uff1b\u5176\u4e2d superuser.zip \u4e0e xposed.zip \u7684\u524d 48 \u5b57\u8282\u5b8c\u5168\u4e00\u81f4\uff0c\u8bf4\u660e\u540c\u4e00\u683c\u5f0f\u7248\u672c\u7684\u5bb9\u5668\u4f7f\u7528\u56fa\u5b9a\u5bc6\u94a5\u6d41\u52a0\u5bc6\u76f8\u540c\u7684\u5934\u90e8\u6a21\u677f\uff0c\u968f\u540e\u624d\u6309\u5185\u5bb9\u5206\u5c94\u3002" },
]));
bodyChildren.push(tableTitle("\u8868 3  assets/plugins \u76ee\u5f55\u6e05\u5355"));
bodyChildren.push(mkTable(
  ["\u6587\u4ef6", "\u5927\u5c0f", "\u7528\u9014\u5b9a\u4f4d"],
  [
    ["play.zip", "97.1 MB", "\u5185\u90e8\u7cfb\u7edf\u955c\u50cf\u57fa\u5e95\u5305\uff08\u5bf9\u5e94\u5176\u5b89\u5353 12 \u7ea7 ROM \u7684\u52a0\u5bc6\u5206\u53d1\u683c\u5f0f\uff09"],
    ["magisk.zip", "15.1 MB", "Magisk \u5957\u4ef6\uff1a\u4e3a\u5ba2\u673a\u63d0\u4f9b MagiskSU \u63d0\u6743\u4e0e\u6a21\u5757\u6846\u67b6"],
    ["xposed.zip", "4.3 MB", "Xposed \u6846\u67b6\u5957\u4ef6\uff1a\u4e3a\u5ba2\u673a\u63d0\u4f9b\u6a21\u5757\u52a0\u8f7d\u80fd\u529b"],
    ["superuser.zip", "1.4 MB", "Superuser \u7ba1\u7406\u5668\uff1a\u6388\u6743\u5f39\u7a97\u3001root \u5f00\u5173\u4e0e\u8bb0\u5f55"],
    ["EMPTY", "0 B", "\u63d2\u4ef6\u76ee\u5f55\u5360\u4f4d/\u7248\u672c\u6807\u8bb0"],
  ],
  [22, 14, 64]
));
bodyChildren.push(caption("\u5404\u6587\u4ef6\u5747\u4e3a\u81ea\u5b9a\u4e49\u52a0\u5bc6\u5bb9\u5668\uff0c\u9700\u7ecf\u5176\u8fd0\u884c\u65f6\u89e3\u5bc6\u901a\u9053\u624d\u80fd\u5c55\u5f00"));
bodyChildren.push(body("\u4e0e\u63d2\u4ef6\u76ee\u5f55\u4ea4\u4e92\u7684\u662f libEPIC.so \u4e2d\u7684\u914d\u7f6e\u5bc4\u5b58\u5668\uff1a\u9759\u6001\u5b57\u7b26\u4e32\u533a\u5185\u53ef\u89c1 asset_protection_method\u3001asset_protection_rc4_key\u3001asset_protection_xor_key\u3001asset_protection_module\u3001asset_rename_map\u3001vm_protection_rc4_key\u3001vm_protection_xor_key\u3001dex_protection_rc4_key\u7b49\u952e\u540d\u3002\u8fd9\u4e9b\u952e\u540d\u63cf\u8ff0\u4e86\u4e00\u5957\u901a\u7528\u7684\u201c\u5206\u5c42\u4fdd\u62a4\u201d\u7ed3\u6784\uff1a\u5bf9\u8d44\u4ea7\u3001dex\u3001XML\u3001\u8d44\u6e90\u5b57\u7b26\u4e32\u5206\u522b\u914d\u7f6e RC4 \u4e0e XOR \u4e24\u5c42\u5bc6\u94a5\u3002\u5bc6\u94a5\u672c\u8eab\u4e0d\u5728\u9759\u6001\u6570\u636e\u4e2d\uff0c\u800c\u662f\u7531\u52a0\u56fa\u58f3\u5728\u8fd0\u884c\u65f6\u751f\u6210\u6216\u89e3\u5bc6\u4f7f\u7528\uff0c\u9759\u6001\u7a77\u4e3e\u4e0d\u80fd\u76f4\u63a5\u8fd8\u539f\u3002"));
bodyChildren.push(h2("5.2  Root \u63a8\u5bfc\uff1a\u8fd0\u884c\u65f6\u6240\u6709\u5236\u63d0\u6743\u6a21\u578b"));
bodyChildren.push(body([
  { text: "\u7ed3\u5408\u5404\u9879\u8bc1\u636e\uff0c\u53ef\u4ee5\u63a8\u5bfc\u51fa\u5b8c\u6574\u7684\u63d0\u6743\u6a21\u578b\uff08\u4ee5\u4e0b\u4e3a\u57fa\u4e8e\u8bc1\u636e\u7684\u5408\u7406\u63a8\u65ad\uff0c\u5df2\u533a\u5206\u4e8e\u76f4\u63a5\u4e8b\u5b9e\uff09\u3002\u9996\u5148\uff0clibkr64.12.so \u4e2d\u786c\u7f16\u7801\u4e86\u5ba2\u673a\u6587\u4ef6\u7cfb\u7edf\u8def\u5f84 /data/data/com.clone.android.dual.space/vm/vm%d/fs\uff0c\u5373\u6bcf\u4e2a\u865a\u62df\u673a\u5b9e\u4f8b\u7684\u6839\u6587\u4ef6\u7cfb\u7edf\u662f\u5bbf\u4e3b\u5e94\u7528\u79c1\u6709\u76ee\u5f55\u4e0b\u7684\u4e00\u68f5\u76ee\u5f55\u6811\uff0c\u800c\u975e\u78c1\u76d8\u955c\u50cf\u6587\u4ef6\u3002\u8fd9\u610f\u5473\u7740\u865a\u62df\u673a\u8fd0\u884c\u65f6\u5bf9\u5ba2\u673a\u7684\u4efb\u4f55\u6587\u4ef6\u90fd\u62e5\u6709\u5b8c\u5168\u7684\u8bfb\u5199\u80fd\u529b\uff1a\u5728\u5bfc\u5165\u6216\u521b\u5efa\u5b9e\u4f8b\u65f6\u89e3\u5bc6 magisk.zip/superuser.zip \u5e76\u5c55\u5f00\u5230\u5ba2\u673a\u76ee\u5f55\u6811\u7684\u6307\u5b9a\u4f4d\u7f6e\uff08\u5982 /system/xbin/su\u3001/system/app/Superuser.apk\uff09\uff0c\u5bf9\u5b83\u4eec\u800c\u8a00\u53ea\u662f\u5199\u81ea\u5df1\u79c1\u6709\u76ee\u5f55\u91cc\u7684\u666e\u901a\u6587\u4ef6\uff0c\u65e0\u9700\u4efb\u4f55\u5b89\u5168\u7279\u6b8a\u6027\u3002" },
]));
bodyChildren.push(body("\u5176\u6b21\uff0c\u5ba2\u673a\u7684 init\u3001zygote\u3001adbd \u7b49\u5168\u90e8\u7cfb\u7edf\u8fdb\u7a0b\u90fd\u662f\u5bbf\u4e3b\u5e94\u7528\u8fdb\u7a0b\u6811\u7684\u540e\u4ee3\uff0c\u8fd0\u884c\u5728\u5bbf\u4e3b\u5e94\u7528\u7684 UID \u4e4b\u4e0b\u3002\u5ba2\u673a\u7cfb\u7edf\u770b\u5230\u7684 uid 0 \u662f\u8fd0\u884c\u65f6\u4eff\u5236\u7684\u8eab\u4efd\uff0c\u800c\u975e Linux \u5185\u6838\u771f\u5b9e\u7684 root\u3002\u56e0\u6b64\u53ea\u8981\u8fd0\u884c\u65f6\u5728\u5ba2\u673a\u7684 init \u6d41\u7a0b\u4e2d\u914d\u7f6e\u597d su \u53ef\u6267\u884c\u4f4d\u3001\u6388\u6743\u7b56\u7565\u4e0e Magisk \u76ee\u5f55\uff0c\u5ba2\u673a\u5185\u90e8\u7684\u5e94\u7528\u8bf7\u6c42 su \u65f6\u5c31\u80fd\u8d70\u901a\u5b8c\u6574\u7684\u6388\u6743\u94fe\uff1a\u5ba2\u673a\u5e94\u7528 \u2192 su \u5ba2\u6237\u7aef \u2192 MagiskSU/\u8fd0\u884c\u65f6\u5b88\u62a4\u8fdb\u7a0b \u2192 Superuser \u5f39\u7a97\u6388\u6743 \u2192 \u4ee5 uid 0 \u8eab\u4efd\u6267\u884c\u3002\u5bf9\u4e8e\u5b89\u88c5\u6a21\u5757\uff0cMagisk \u63d2\u4ef6\u63d0\u4f9b\u6807\u51c6\u7684\u6a21\u5757\u76ee\u5f55\u7ed3\u6784\uff0c\u914d\u5408\u5185\u7f6e\u7684 Xposed \u6846\u67b6\u4e0e LSPlant/Pine/Aliuhook \u4e09\u5957 ART \u65b9\u6cd5 Hook \u5f15\u64ce\uff08assets/Epic_so \u4e0b\u672a\u52a0\u5bc6\uff0c\u8986\u76d6 arm/arm64/x86/x86_64 \u56db\u79cd ABI\uff09\uff0c\u5f62\u6210\u65e0\u771f\u5b9e root \u4f9d\u8d56\u7684\u6a21\u5757\u751f\u6001\u3002"));
bodyChildren.push(body([
  { text: "\u8fd9\u4e00\u6a21\u578b\u89e3\u91ca\u4e86\u4e3a\u4ec0\u4e48\u6b64\u7c7b\u4ea7\u54c1\u80fd\u5728\u672a root \u624b\u673a\u4e0a\u63d0\u4f9b\u5b8c\u6574 root \u4f53\u9a8c\uff1a" },
  { text: "root \u7684\u5b9e\u8d28\u662f\u201c\u5ba2\u673a\u8fdb\u7a0b\u6811\u5185\u90e8\u7684\u8eab\u4efd\u534f\u5b9a\u201d\uff0c\u800c\u975e\u5185\u6838\u7ea7\u63d0\u6743", bold: true },
  { text: "\u3002\u8fd0\u884c\u65f6\u65e2\u7136\u62e5\u6709\u5ba2\u673a\u7528\u6237\u6001\u7684\u5168\u90e8\u63a7\u5236\u6743\uff0c\u5b83\u60f3\u8ba9\u8c01\u662f root \u8c01\u5c31\u662f root\u3002\u4ee3\u4ef7\u662f\u9694\u79bb\u6027\uff1a\u5ba2\u673a\u5185\u7684 root \u6c38\u8fdc\u65e0\u6cd5\u7a7f\u900f\u5230\u5bbf\u4e3b\u673a\uff0c\u4e5f\u65e0\u6cd5\u6267\u884c\u771f\u6b63\u7684\u5185\u6838\u64cd\u4f5c\uff08\u5982\u52a0\u8f7d\u5185\u6838\u6a21\u5757\uff09\u3002\u8fd9\u6b63\u4e0e\u59d4\u6258\u65b9\u201c\u7528\u6237\u6001\u4e4b\u4e0b\u4e0d\u53ef\u80fd\u5b9e\u73b0\u771f\u6839\u6743\u9650\u201d\u7684\u5224\u65ad\u4e00\u81f4\uff1a\u884c\u4e1a\u5b9e\u8df5\u662f\u628a\u201croot\u201d\u505a\u6210\u5ba2\u673a\u5185\u90e8\u7684\u8eab\u4efd\u4e0e\u6743\u9650\u6a21\u62df\uff0c\u800c\u975e\u653b\u514b\u5bbf\u4e3b\u5185\u6838\u3002" },
]));
bodyChildren.push(h2("5.3  \u4e0e adb \u7684\u7ed3\u5408"));
bodyChildren.push(body("\u5e94\u7528\u5185\u7f6e\u4e86\u4e24\u6bb5 ADB \u80fd\u529b\uff1a\u5176\u4e00\u662f libadb.so\uff0c\u5373\u5b98\u65b9 ADB \u7684\u65e0\u7ebf\u8c03\u8bd5\u914d\u5bf9\uff08pairing\uff09\u5b50\u96c6\uff0c\u63d0\u4f9b PairingContext \u4e0e AES-128-GCM \u52a0\u5bc6\u901a\u9053\uff1b\u5176\u4e8c\u662f libvm.so \u4e2d\u4fdd\u7559\u7684 5037\uff08adb server\uff09\u30015554/5555\uff08\u4f20\u7edf emulor console/adbd \u7aef\u53e3\uff09\u7aef\u53e3\u5e38\u91cf\u3002\u53ef\u63a8\u65ad\u5176\u8fde\u63a5\u65b9\u5f0f\u4e3a\uff1a\u5ba2\u673a\u5185\u8fd0\u884c adbd\uff0c\u5bbf\u4e3a\u5c42\u5c06\u672c\u5730\u7aef\u53e3\u8f6c\u53d1\u5230\u5ba2\u673a\uff0c\u5bbf\u4e3b\u5e94\u7528\u6216\u7528\u6237\u7684 adb \u5ba2\u6237\u7aef\u901a\u8fc7 connect 127.0.0.1:5555 \u7c7b\u65b9\u5f0f\u63a5\u5165\u3002\u7531\u4e8e adbd \u540c\u6837\u5728\u8fd0\u884c\u65f6\u7ba1\u63a7\u4e4b\u4e0b\uff0c\u5176\u914d\u7f6e\uff08\u5982 service.adb.root\u3001ro.debuggable\uff09\u53ef\u4ee5\u5728\u955c\u50cf\u5bfc\u5165\u65f6\u76f4\u63a5\u5199\u6b7b\u5728 build.prop \u4e2d\uff0c\u4ece\u800c\u4fdd\u8bc1 adb shell \u76f4\u63a5\u4ee5 root \u8eab\u4efd\u5de5\u4f5c\u2014\u2014\u8fd9\u662f\u89e3\u51b3 AEmulator adb shell \u6b8b\u7f3a\u95ee\u9898\u7684\u5173\u952e\u53c2\u8003\u70b9\u4e4b\u4e00\u3002"));

/* ============ 6. 兼容性设计 ============ */
bodyChildren.push(h1("\u516d\u3001Android-in-Android \u517c\u5bb9\u6027\u67b6\u6784"));
bodyChildren.push(h2("6.1  \u5206\u7248\u672c\u8fd0\u884c\u65f6\uff1a\u4ee5\u5e93\u4ee3\u955c\u50cf\u7684\u517c\u5bb9\u7b56\u7565"));
bodyChildren.push(body("\u5382\u5546\u91c7\u7528\u4e86\u201c\u4e00\u5957\u5185\u6838\u5f15\u64ce + \u591a\u5957\u5206\u7248\u672c\u8fd0\u884c\u65f6\u201d\u7684\u67b6\u6784\uff1alibkr64/libkr32 \u7cfb\u5217\u6309 Android 11\u300112 \u7b49\u7248\u672c\u540e\u7f00\u7ec6\u5206\uff0c64 \u4f4d\u4e0e 32 \u4f4d\u5404\u6709\u4e00\u4efd\u3002\u8fd9\u610f\u5473\u7740\u65b0\u7cfb\u7edf\u7248\u672c\u7684\u652f\u6301\u4e3b\u8981\u662f\u589e\u52a0\u5bf9\u5e94\u7248\u672c\u7684 kr \u8fd0\u884c\u65f6\u5e93\u4e0e\u65b0\u7684\u52a0\u5bc6\u955c\u50cf\u5305\uff0c\u800c\u975e\u6539\u9020\u865a\u62df\u673a\u5185\u6838\u672c\u8eab\u3002\u5bf9\u4e8e\u5e0c\u671b\u9010\u7248\u672c\u8ffd\u8d76\u65b0 Android \u7684\u9879\u76ee\uff08\u5982 AEmulator\uff09\uff0c\u8fd9\u79cd\u5206\u5c42\u8bbe\u8ba1\u660e\u786e\u4f20\u9012\u4e86\u4e00\u4e2a\u5de5\u7a0b\u4fe1\u53f7\uff1a\u628a\u201c\u5bf9\u7279\u5b9a\u7cfb\u7edf\u7248\u672c\u7684\u7279\u6b8a\u5904\u7406\u201d\u9694\u79bb\u5728\u53ef\u63d2\u62d4\u7684\u8fd0\u884c\u65f6\u6a21\u5757\u91cc\uff0c\u80fd\u6709\u6548\u63a7\u5236\u6bcf\u4e00\u4ee3\u65b0\u7248\u672c\u7684\u9002\u914d\u6210\u672c\u3002"));
bodyChildren.push(h2("6.2  \u5171\u7528\u5bbf\u4e3b ART \u4e0e\u5185\u6838\uff0c\u6ce8\u5165\u5f0f\u517c\u5bb9"));
bodyChildren.push(body([
  { text: "libkr64.12.so \u4e2d\u540c\u65f6\u5f15\u7528\u4e86 /system/bin/app_process64\u3001/system/bin/linker64\u3001/system/build.prop \u7b49\u5bbf\u4e3b\u7cfb\u7edf\u8def\u5f84\uff0c\u8868\u660e\u5ba2\u673a\u8fd0\u884c\u65f6\u4e0e\u5bbf\u4e3b\u7684\u94fe\u63a5\u5668/ART \u5b58\u5728\u76f4\u63a5\u4ea4\u4e92\uff0c\u800c\u975e\u5b8c\u5168\u727a\u65ad\u7684\u6c99\u7bb1\u3002\u914d\u5408\u5176\u5d4c\u5165\u7684 shadowhook 1.0.8\uff08\u5b57\u8282\u8df3\u52a8\u5185\u8054 Hook\uff0c\u5b57\u8282\u8bf4\u660e\u63d0\u4f9b\u4e86 a64 hook WITH/WITHOUT EXIT \u7684\u63a7\u5236\u6d41\u63cf\u8ff0\uff09\uff0c\u53ef\u63a8\u65ad\u5176\u517c\u5bb9\u6027\u624b\u6bb5\u662f\uff1a", },
  { text: "\u5728\u8fd0\u884c\u65f6\u5bf9\u5ba2\u673a\u5173\u952e\u8fdb\u7a0b\u7684\u5173\u952e\u51fd\u6570\u505a\u5185\u8054 Hook\uff0c\u4ee5\u9002\u914d\u5bbf\u4e3b\u673a\u578b\u5dee\u5f02\u4e0e\u7cfb\u7edf\u884c\u4e3a\u5dee\u5f02", bold: true },
  { text: "\uff0c\u800c\u4e0d\u4f9d\u8d56\u5b9a\u5236\u5185\u6838\u3002\u7f51\u7edc\u5c42\u9762\u4f7f\u7528 TUN \u63a5\u53e3\uff08tun.ctrl_client\u3001tun_N_M \u63a7\u5236\u901a\u9053\uff09\u642d\u5efa\u865a\u62df\u7f51\u5361\uff0c\u6bcf\u4e2a\u5b9e\u4f8b\u72ec\u7acb\u5206\u914d\u901a\u9053\u3002" },
]));
bodyChildren.push(h2("6.3  \u5b8c\u6574\u7684\u5185\u90e8\u6a21\u5757\u751f\u6001"));
bodyChildren.push(body("\u9664 root \u751f\u6001\u5916\uff0c\u6837\u672c\u8fd8\u643a\u5e26\u4e86\u4e24\u4e2a\u503c\u5f97\u6ce8\u610f\u7684\u5185\u90e8\u7ec4\u4ef6\u3002\u5176\u4e00\u662f assets \u6839\u76ee\u5f55\u4e0b\u672a\u52a0\u5bc6\u7684 pine_xposed_api.dex \u4e0e aliu_xposed_api.dex\uff0c\u5373 Pine \u4e0e Aliucord \u4e24\u5957 Xposed API \u6869\u6876\uff0c\u914d\u5408 Epic_so \u76ee\u5f55\u7684 LSPlant\uff08LSPosed \u56e2\u961f\u7684 ART Hook \u5e93\uff09\u3001Pine\u3001Aliuhook \u4e09\u5957\u5f15\u64ce\uff0c\u610f\u5473\u7740\u5ba2\u673a\u5185\u7684 Xposed \u6a21\u5757\u65e0\u9700\u4efb\u4f55\u771f\u5b9e root \u5373\u53ef\u52a0\u8f7d\u2014\u2014\u6a21\u5757\u7684\u52a0\u8f7d\u672c\u8eab\u662f\u8fd0\u884c\u65f6\u4ee3\u7404\u7684 API \u8c03\u7528\u3002\u5176\u4e8c\u662f assets/groovy_shell.apk\uff086.2 MB\uff0c\u672a\u52a0\u5bc6\uff09\uff1a\u4e00\u4e2a\u5185\u5d4c Groovy \u811a\u672c\u5f15\u64ce\uff08GrooidShell\uff09\u7684\u72ec\u7acb APK\uff0c\u53ef\u5728\u5ba2\u673a\u5185\u6267\u884c\u4efb\u610f Groovy \u811a\u672c\u5e76\u7ed1\u5b9a activity \u53d8\u91cf\uff0c\u63d0\u4f9b\u6bd4 adb shell \u66f4\u9ad8\u5c42\u7684\u81ea\u52a8\u5316\u80fd\u529b\u3002\u8fd9\u8bf4\u660e\u5176\u63a7\u5236\u9762\u4e0d\u6b62\u4e8e\u201croot \u63d0\u6743\u201d\uff0c\u800c\u662f\u6784\u5efa\u4e86\u63d0\u6743\u3001\u6a21\u5757\u3001\u811a\u672c\u4e09\u5c42\u53e0\u52a0\u7684\u5b8c\u6574\u63a7\u5236\u4f53\u7cfb\u3002"));
bodyChildren.push(h2("6.4  \u52a0\u5bc6\u5206\u53d1\u4f53\u7cfb"));
bodyChildren.push(body("\u6837\u672c\u7684\u7cfb\u7edf\u955c\u50cf\u4e0e root/\u6a21\u5757\u8d44\u6e90\u5747\u4ee5\u81ea\u5b9a\u4e49\u52a0\u5bc6\u5bb9\u5668\u5206\u53d1\uff0c\u5176\u5916\u5c42\u4e3a XOR\uff08Epic.vm \u5b9e\u6d4b\u4e3a\u5355\u5b57\u8282 0x1F\uff0c\u89e3\u51fa Epic_ \u9b54\u6570\u4e0e\u6761\u76ee\u8868\uff09\uff0c\u5185\u5c42\u4e3a\u6309\u6761\u76ee\u7684 RC4\uff08\u5bc6\u94a5\u7531\u52a0\u56fa\u58f3\u8fd0\u884c\u65f6\u63d0\u4f9b\uff09\u3002\u52a0\u5bc6\u5206\u53d1\u7684\u76ee\u7684\u5177\u6709\u4e8c\u91cd\u6027\uff1a\u4e00\u662f\u9632\u6b62\u7528\u6237\u5c06\u955c\u50cf\u63d0\u53d6\u540e\u8131\u79bb\u5176\u5e73\u53f0\u4f7f\u7528\uff08\u955c\u50cf\u4e0e\u8fd0\u884c\u65f6\u7ed1\u5b9a\uff09\uff0c\u4e8c\u662f\u4fdd\u62a4\u5176\u5546\u4e1a\u5316\u7684 ROM \u8d44\u6e90\uff08\u5176\u5b98\u65b9\u5b89\u5353 12 ROM \u4ee5\u52a0\u5bc6\u683c\u5f0f\u5206\u53d1\uff0c\u9700\u4f1a\u5458/\u6fc0\u6d3b\u83b7\u53d6\uff09\u3002\u8fd9\u4e0e AEmulator \u76f4\u63a5\u4f7f\u7528\u516c\u5f00\u56fa\u4ef6\u7684\u8def\u7ebf\u4e0d\u540c\uff1a\u540e\u8005\u4e0d\u9700\u8981\u52a0\u5bc6\u5206\u53d1\u5c42\uff0c\u4e5f\u56e0\u6b64\u4e0d\u6784\u6210\u969c\u788d\uff1b\u82e5\u672a\u6765 AEmulator \u9700\u8981\u5b9a\u5236\u955c\u50cf\uff0c\u53ef\u4ec5\u501f\u9274\u5176\u5bb9\u5668\u7ed3\u6784\u8bbe\u8ba1\uff08\u5934\u90e8\u6a21\u677f + \u6761\u76ee\u8868 + \u5206\u6761\u76ee\u52a0\u5bc6\uff09\uff0c\u65e0\u9700\u4e5f\u4e0d\u5e94\u4f7f\u7528\u5176\u5bc6\u94a5\u4f53\u7cfb\u3002"));

/* ============ 7. 对照诊断 ============ */
bodyChildren.push(h1("\u4e03\u3001AEmulator adb shell \u6b8b\u7f3a\u95ee\u9898\u7684\u5bf9\u7167\u8bca\u65ad"));
bodyChildren.push(body("\u59d4\u6258\u65b9\u63cf\u8ff0\u7684 AEmulator \u75c7\u72b6\u662f\uff1aadb shell \u53ef\u7528\u4f46\u6b8b\u7f3a\uff0cls \u7b49\u5c11\u6570\u547d\u4ee4\u6709\u6548\uff0c\u7a0d\u9ad8\u7ea7\u7684\u547d\u4ee4\u65e0\u6cd5\u6267\u884c\uff0c\u5185\u90e8\u65e0\u6cd5\u83b7\u53d6 root\u3001\u65e0\u6cd5\u5b89\u88c5\u6a21\u5757\u3002\u5728\u7528\u6237\u6001\u865a\u62df\u5316\u67b6\u6784\u4e0b\uff0c\u8be5\u75c7\u72b6\u6709\u4e24\u4e2a\u9ad8\u6982\u7387\u6210\u56e0\uff0c\u5206\u522b\u5bf9\u5e94\u4e0d\u540c\u7684\u4fee\u590d\u8def\u5f84\u3002"));
bodyChildren.push(body([
  { text: "\u6210\u56e0\u4e00\uff1a\u8eab\u4efd\u7f3a\u5931\u3002", bold: true },
  { text: "adb shell \u767b\u5f55\u7684\u9ed8\u8ba4\u8eab\u4efd\u662f\u5ba2\u673a\u7684 shell \u7528\u6237\u800c\u975e root\u3002\u82e5\u5ba2\u673a rootfs \u4e2d\u6ca1\u6709\u53ef\u7528\u7684 su\uff08\u6216 su \u5b58\u5728\u4f46\u7f3a\u5c11\u5b88\u62a4\u8fdb\u7a0b\u4e0e\u6388\u6743\u7b56\u7565\uff09\uff0c\u5219\u51e1\u9700\u8981\u7279\u6743\u7684\u547d\u4ee4\uff08pm\u3001am \u7684\u90e8\u5206\u5b50\u547d\u4ee4\u3001settings\u3001dumpsys \u5199\u64cd\u4f5c\u3001mount \u7b49\uff09\u4f1a\u88ab\u6743\u9650\u62d2\u7edd\uff0c\u800c ls\u3001cat\u3001ps \u7b49\u53ea\u8bfb\u547d\u4ee4\u6b63\u5e38\u2014\u2014\u4e0e\u59d4\u6258\u65b9\u63cf\u8ff0\u7684\u201c\u53ea\u6709\u5c11\u90e8\u5206\u547d\u4ee4\u6709\u6548\u201d\u5b8c\u5168\u543b\u5408\u3002\u8fd9\u4e0d\u662f shell \u672c\u8eab\u6b8b\u7f3a\uff0c\u800c\u662f\u8eab\u4efd\u4e0e\u6388\u6743\u94fe\u672a\u5efa\u3002" },
]));
bodyChildren.push(body([
  { text: "\u6210\u56e0\u4e8c\uff1a\u901a\u9053\u4e0d\u5b8c\u6574\u3002", bold: true },
  { text: "\u5b8c\u6574\u7684 adb \u4f53\u9a8c\u9700\u8981 adbd \u4e0e\u5916\u90e8 adb \u5ba2\u6237\u7aef\u7684\u7a33\u5b9a\u901a\u9053\uff08TCP 5555 \u6216 unix socket\uff09\u3001\u53ef\u5199\u7684\u5ba2\u673a dev \u4e0e /data \u533a\u57df\u3001\u4ee5\u53ca\u6b63\u786e\u7684 shell \u4ea4\u4e92\u73af\u5883\uff08PTY\u3001\u73af\u5883\u53d8\u91cf\u3001PATH\uff09\u3002\u7528\u6237\u6001\u865a\u62df\u5316\u65b9\u6848\u4e2d\u82e5\u4ec5\u642d\u5efa\u4e86\u547d\u4ee4\u76f4\u901a\u901a\u9053\u800c\u672a\u5904\u7406 PTY \u4e0e\u73af\u5883\uff0c\u4f1a\u5448\u73b0\u201c\u80fd\u8dd1\u547d\u4ee4\u4f46\u4e92\u52a8\u5f02\u5e38\u201d\u7684\u8868\u73b0\u3002\u865a\u62df\u5927\u5e08\u7684\u53c2\u8003\u7b54\u6848\u662f\u628a\u5b98\u65b9 adbd \u539f\u6837\u8dd1\u5728\u5ba2\u673a\u91cc\u3001\u7528\u7aef\u53e3\u8f6c\u53d1\u5bf9\u5916\u66b4\u9732\uff08\u5176 libadb.so \u4e0e\u7aef\u53e3\u5e38\u91cf\u5373\u4e3a\u6b64\u8bbe\uff09\uff0c\u800c\u975e\u81ea\u5236\u7b80\u5316\u7248 shell\u3002" },
]));
bodyChildren.push(tableTitle("\u8868 4  \u4e24\u4e2a\u9879\u76ee\u7684\u67b6\u6784\u5bf9\u7167"));
bodyChildren.push(mkTable(
  ["\u7ef4\u5ea6", "AEmulator\uff08\u73b0\u72b6\uff09", "\u865a\u62df\u5927\u5e08\uff08\u672c\u6b21\u5206\u6790\uff09"],
  [
    ["\u5ba2\u673a\u8fd0\u884c\u4f4d\u7f6e", "\u7528\u6237\u6001 QEMU\uff082.3\u20134.4\uff09/\u672c\u673a arm64\uff085.0+\uff09", "\u5ba2\u673a\u76ee\u5f55\u6811 vm/vmN/fs + \u5206\u7248\u672c kr \u8fd0\u884c\u65f6"],
    ["root \u63d0\u4f9b\u65b9\u5f0f", "\u672a\u63d0\u4f9b su / \u6388\u6743\u4f53\u7cfb\uff08\u4ec5 adb shell\uff09", "\u5185\u7f6e Magisk + Superuser \u63d2\u4ef6\uff0c\u5b9e\u4f8b\u521b\u5efa\u65f6\u6ce8\u5165"],
    ["adb \u94fe\u8def", "\u76f4\u8fde\u5ba2\u673a adbd\uff0cshell \u7528\u6237\uff0c\u9ad8\u6743\u9650\u547d\u4ee4\u5931\u8d25", "\u5185\u7f6e libadb \u914d\u5bf9 + \u672c\u5730\u7aef\u53e3\u8f6c\u53d1\uff0cadbd \u53ef root \u5316"],
    ["\u6a21\u5757\u4f53\u7cfb", "\u65e0", "Magisk \u6a21\u5757\u76ee\u5f55 + Xposed\uff08LSPlant/Pine/Aliuhook\uff09"],
    ["\u955c\u50cf\u6765\u6e90", "\u516c\u5f00\u56fa\u4ef6\u76f4\u8bfb\uff08\u65e0\u52a0\u5bc6\uff09", "\u81ea\u5206\u53d1\u52a0\u5bc6\u5bb9\u5668\uff08XOR+RC4 \u5206\u5c42\uff09"],
    ["\u811a\u672c/\u81ea\u52a8\u5316", "\u4ec5\u9650\u5ba2\u673a\u5185\u90e8\u80fd\u529b", "\u5185\u5d4c Groovy \u811a\u672c\u5f15\u64ce\uff0c\u53ef\u7f16\u7a0b\u63a7\u5236\u5ba2\u673a"],
  ],
  [20, 40, 40]
));
bodyChildren.push(caption("AEmulator \u5217\u4e3a\u4f9d\u636e\u5176\u516c\u5f00\u8d44\u6599\u4e0e\u59d4\u6258\u65b9\u63cf\u8ff0\u7684\u5f52\u7eb3\uff1b\u865a\u62df\u5927\u5e08\u5217\u4e3a\u672c\u6b21\u9759\u6001\u5206\u6790\u4e0e\u63a8\u65ad\u7684\u7efc\u5408\u7ed3\u8bba"));

/* ============ 8. 结论与借鉴方案 ============ */
bodyChildren.push(h1("\u516b\u3001\u7ed3\u8bba\u4e0e AEmulator \u53ef\u843d\u5730\u7684\u501f\u9274\u65b9\u6848"));
bodyChildren.push(body("\u7efc\u5408\u5168\u90e8\u8bc1\u636e\uff0c\u865a\u62df\u5927\u5e08\u7684 root \u4e0d\u662f\u67d0\u4e2a\u5355\u70b9\u6280\u672f\uff0c\u800c\u662f\u4e00\u5957\u4ea7\u54c1\u5316\u5de5\u7a0b\uff1a\u52a0\u5bc6\u5206\u53d1\u7684 root \u8d44\u6e90\u5305 + \u5b9e\u4f8b\u521b\u5efa\u65f6\u7684\u6587\u4ef6\u7cfb\u7edf\u6ce8\u5165 + \u8fd0\u884c\u65f6\u7ea7\u8eab\u4efd\u6a21\u62df + \u72ec\u7acb\u7684\u6388\u6743\u7ba1\u7406\u9762\u3002\u5b83\u7684\u517c\u5bb9\u6027\u540c\u6837\u4e0d\u662f\u5355\u70b9\u9ed1\u79d1\u6280\uff0c\u800c\u662f\u5206\u7248\u672c\u8fd0\u884c\u65f6 + \u8fd0\u884c\u65f6 Hook \u9002\u914d + TUN \u7f51\u7edc\u7684\u5206\u5c42\u7ec4\u5408\u3002\u4e24\u8005\u7684\u5171\u540c\u524d\u63d0\u662f\u62e5\u6709\u5ba2\u673a\u7528\u6237\u6001\u7684\u5b8c\u5168\u63a7\u5236\u6743\uff1b\u5dee\u5f02\u4ec5\u5728\u4e8e\u662f\u5426\u628a\u8fd9\u4e2a\u63a7\u5236\u6743\u4ea4\u4ed8\u6210\u4e86\u7528\u6237\u53ef\u7528\u7684 root \u4f53\u9a8c\u3002\u636e\u6b64\uff0c\u5411 AEmulator \u63d0\u51fa\u4ee5\u4e0b\u56db\u6b65\u53ef\u843d\u5730\u65b9\u6848\uff0c\u6309\u5b9e\u65bd\u4f18\u5148\u7ea7\u6392\u5e8f\u3002"));
bodyChildren.push(body([
  { text: "\u7b2c\u4e00\u6b65\uff08\u4fee\u590d adb shell\uff0c\u6210\u672c\u6700\u4f4e\uff09\uff1a", bold: true },
  { text: "AEmulator \u5728\u5bfc\u5165\u56fa\u4ef6\u65f6\u672c\u5c31\u62e5\u6709\u5ba2\u673a rootfs \u7684\u5b8c\u5168\u5199\u6743\uff0c\u5e94\u5728\u955c\u50cf\u5904\u7406\u9636\u6bb5\u5bf9\u5ba2\u673a build.prop \u8ffd\u52a0 ro.debuggable=1 \u4e0e service.adb.root=1\uff0c\u5e76\u5411 /system/xbin \u6ce8\u5165\u9759\u6001\u94fe\u63a5\u7684 su \u4e8c\u8fdb\u5236\u4e0e\u5bf9\u5e94\u7684\u5b88\u62a4\u903b\u8f91\uff0c\u4f7f\u5f97\u5ba2\u673a\u5185\u7684 adbd \u4ee5 root \u8fd0\u884c\u3001shell \u767b\u5f55\u5373\u62ff\u5230 root \u8eab\u4efd\u3002\u8fd9\u4e00\u6b65\u4e0d\u9700\u8981\u6539\u52a8\u865a\u62df\u5316\u5f15\u64ce\uff0c\u5b8c\u5168\u662f\u6587\u4ef6\u7cfb\u7edf\u5c42\u9762\u7684\u6ce8\u5165\uff0c\u9884\u671f\u53ef\u76f4\u63a5\u6d88\u9664\u201c\u53ea\u6709 ls \u80fd\u7528\u201d\u7684\u73b0\u8c61\u3002" },
]));
bodyChildren.push(body([
  { text: "\u7b2c\u4e8c\u6b65\uff08\u8865\u9f50\u6388\u6743\u4f53\u9a8c\uff09\uff1a", bold: true },
  { text: "\u53c2\u7167 superuser.zip \u7684\u5b9a\u4f4d\uff0c\u5728\u5ba2\u673a\u5185\u63d0\u4f9b\u4e00\u4e2a\u6388\u6743\u7ba1\u7406\u5668\uff08\u53ef\u4ee5\u662f\u6700\u7b80\u7684\u767d\u540d\u5355\u5f39\u7a97\uff09\uff0c\u8ba9\u5ba2\u673a\u5e94\u7528\u7684 su \u8bf7\u6c42\u6709\u660e\u786e\u7684\u540c\u610f/\u62d2\u7edd\u8def\u5f84\uff0c\u5e76\u5728\u5bbf\u4e3b\u5e94\u7528\u8bbe\u7f6e\u9875\u63d0\u4f9b\u201c\u5b9e\u4f8b root \u5f00\u5173\u201d\u3002\u8fd9\u89e3\u51b3\u7684\u662f\u201c\u6a21\u62df root \u7684\u7ba1\u7406\u201d\u800c\u975e\u6280\u672f\u672c\u8eab\uff0c\u4e5f\u662f\u59d4\u6258\u65b9\u6307\u51fa\u201c\u7ba1\u7406\u4e0d\u662f\u5f88\u597d\u201d\u7684\u76f4\u63a5\u5bf9\u5e94\u9879\u3002" },
]));
bodyChildren.push(body([
  { text: "\u7b2c\u4e09\u6b65\uff08\u6a21\u5757\u751f\u6001\uff09\uff1a", bold: true },
  { text: "\u5f15\u5165 Magisk \u7ea7\u522b\u7684\u6a21\u5757\u76ee\u5f55\u7ea6\u5b9a\uff0c\u6216\u76f4\u63a5\u590d\u7528\u5f00\u6e90\u7684 LSPosed/LSPlant \u65b9\u6848\u5728\u5ba2\u673a\u5185\u63d0\u4f9b Xposed \u6a21\u5757\u80fd\u529b\u3002\u865a\u62df\u5927\u5e08\u7684\u5b9e\u8df5\u8bc1\u660e\uff1a\u5728\u8fd0\u884c\u65f6\u63a7\u573a\u4e4b\u5185\uff0c\u6a21\u5757\u52a0\u8f7d\u53ef\u4ee5\u5b8c\u5168\u4e0d\u4f9d\u8d56\u771f\u5b9e root\uff0c\u800c\u662f\u901a\u8fc7 ART \u65b9\u6cd5 Hook\uff08LSPlant/Pine\uff09\u5728\u8fdb\u7a0b\u5185\u5b8c\u6210\u3002AEmulator \u7684 5.0+ \u539f\u751f\u8fd0\u884c\u5206\u652f\u53ef\u76f4\u63a5\u5957\u7528\u8fd9\u4e00\u65b9\u6cd8\uff1b2.3\u20134.4 \u7684 QEMU \u5206\u652f\u5219\u53ef\u9000\u800c\u6c42\u5176\u6b21\uff0c\u4ec5\u63d0\u4f9b su + \u811a\u672c\u6ce8\u5165\u7ea7\u6a21\u5757\u3002" },
]));
bodyChildren.push(body([
  { text: "\u7b2c\u56db\u6b65\uff08\u8fdb\u9636\u63a7\u5236\u9762\uff09\uff1a", bold: true },
  { text: "\u53c2\u8003\u5176 Groovy \u811a\u672c\u5f15\u64ce\uff0c\u5728\u5ba2\u673a\u5185\u63d0\u4f9b\u6bd4 shell \u66f4\u9ad8\u5c42\u7684\u81ea\u52a8\u5316\u5165\u53e3\uff08\u5982\u5185\u7f6e Python/Rhino/Groovy \u4e4b\u4e00\uff09\uff0c\u5e76\u5c06\u7aef\u53e3\u8f6c\u53d1\u3001\u622a\u56fe\u3001\u8f93\u5165\u6ce8\u5165\u7b49\u63a7\u5236\u9762\u4ee5 API \u5f62\u5f0f\u66b4\u9732\u3002\u5bf9 AEmulator \u800c\u8a00\uff0c\u8fd9\u4e00\u5c42\u5c5e\u4e8e\u589e\u5f3a\u9879\uff0c\u53ef\u5728\u524d\u4e09\u6b65\u7a33\u5b9a\u540e\u518d\u89c4\u5212\u3002" },
]));
bodyChildren.push(body("\u9700\u8981\u5f3a\u8c03\u7684\u98ce\u9669\u4e0e\u8fb9\u754c\uff1a\u4e0a\u8ff0\u65b9\u6848\u5747\u5728\u201c\u5ba2\u673a\u5185\u6a21\u62df root\u201d\u7684\u5408\u6cd5\u8fb9\u754c\u5185\uff0c\u4e0d\u6d89\u53ca\u5bf9\u5bbf\u4e3b\u673a\u7684\u4efb\u4f55\u63d0\u6743\uff0c\u4e5f\u4e0d\u6d89\u53ca\u7ed5\u8fc7\u4efb\u4f55\u5546\u4e1a\u52a0\u5bc6\u4f53\u7cfb\u3002\u672c\u62a5\u544a\u5bf9\u865a\u62df\u5927\u5e08\u52a0\u5bc6\u5bb9\u5668\u4ec5\u505a\u4e86\u7ed3\u6784\u5c42\u9762\u63cf\u8ff0\uff0c\u672a\u5b9e\u65bd\u4e5f\u4e0d\u5efa\u8bae\u5b9e\u65bd\u5bc6\u94a5\u7834\u89e3\uff1b\u82e5\u540e\u7eed\u9700\u8981\u5bf9\u5176 ROM \u5185\u5bb9\u505a\u66f4\u6df1\u5165\u7814\u7a76\uff0c\u5e94\u5728\u5408\u89c4\u524d\u63d0\u4e0b\uff08\u5982\u81ea\u5907\u5408\u6cd5\u6388\u6743\u7684\u8bbe\u5907\u4e0a\u8fdb\u884c\u52a8\u6001\u5206\u6790\uff09\u53e6\u884c\u7ec4\u7ec7\u3002"));

/* ============ 9. 附录 ============ */
bodyChildren.push(h1("\u4e5d\u3001\u9644\u5f55\uff1a\u5206\u6790\u8fc7\u7a0b\u4e2d\u7684\u5173\u952e\u5b9e\u6d4b\u8bb0\u5f55"));
bodyChildren.push(body("\u4ee5\u4e0b\u8bb0\u5f55\u4f9b\u590d\u6838\u4e0e\u540e\u7eed\u5b9e\u9a8c\u4f7f\u7528\uff0c\u5747\u4e3a\u672c\u6b21\u5206\u6790\u8fc7\u7a0b\u4e2d\u7684\u771f\u5b9e\u5b9e\u6d4b\u4ea7\u51fa\u3002"));
bodyChildren.push(tableTitle("\u8868 5  \u5b9e\u6d4b\u8bb0\u5f55\u6e05\u5355"));
bodyChildren.push(mkTable(
  ["\u7f16\u53f7", "\u5b9e\u6d4b\u9879", "\u7ed3\u679c"],
  [
    ["R1", "jadx \u5168\u91cf\u53cd\u7f16\u8bd1\u4e3b APK", "\u5b8c\u6210\uff0c\u4ec5\u5f97 46 \u4e2a\u7c7b\uff0c\u4e3b\u4e1a\u52a1\u4ee3\u7801\u786e\u8ba4\u88ab\u52a0\u56fa\uff08Epic.vm\uff09"],
    ["R2", "Epic.vm \u5355\u5b57\u8282 XOR \u9a8c\u8bc1", "0x1F \u89e3\u51fa Epic_ \u9b54\u6570 + \u6761\u76ee\u8868\uff0c\u5916\u5c42 XOR \u5b9e\u8bc1\u6210\u7acb"],
    ["R3", "\u63d2\u4ef6\u5bb9\u5668\u5934\u90e8\u6bd4\u5bf9", "superuser.zip \u4e0e xposed.zip \u524d 48 \u5b57\u8282\u5b8c\u5168\u4e00\u81f4\uff0c\u786e\u8ba4\u56fa\u5b9a\u5934\u90e8\u6a21\u677f"],
    ["R4", "\u5e38\u89c1\u5bc6\u94a5 RC4 \u7a77\u4e3e", "\u672a\u547d\u4e2d\uff0c\u5bc6\u94a5\u786e\u8ba4\u7531\u8fd0\u884c\u65f6\u52a8\u6001\u63d0\u4f9b"],
    ["R5", "libEPIC.so \u7b26\u53f7\u4e0e\u5b57\u7b26\u4e32", "\u53d1\u73b0\u4e94\u7ec4 asset/dex/axml/meta/resource \u7684 RC4+XOR \u914d\u7f6e\u952e\u540d"],
    ["R6", "libkr64.12.so \u5b57\u7b26\u4e32", "\u5d4c\u5165 shadowhook 1.0.8\uff1b\u786c\u7f16\u7801\u5ba2\u673a fs \u8def\u5f84\u4e0e TUN \u63a7\u5236\u901a\u9053\u540d"],
    ["R7", "groovy_shell.apk \u53cd\u7f16\u8bd1", "\u5b8c\u6574\u53ef\u8bfb\uff0c\u786e\u8ba4 GrooidShell \u811a\u672c\u5f15\u64ce\u53ca\u5165\u53e3\u903b\u8f91"],
    ["R8", "libvm.so \u5b57\u7b26\u4e32", "OLLVM \u6df1\u5ea6\u6df7\u6f8f\uff0c\u4ec5\u4fdd\u7559 adb \u7aef\u53e3\u5e38\u91cf\u4e0e\u7f51\u7edc\u5b57\u6bb5\u53ef\u89c1"],
  ],
  [10, 32, 58]
));
bodyChildren.push(caption("\u5b9e\u6d4b\u73af\u5883\uff1a\u9694\u79bb Linux \u6c99\u7bb1\uff0cjadx 1.5.6 + apktool 3.0.3\uff0c\u5168\u90e8\u4e3a\u9759\u6001\u5206\u6790"));
bodyChildren.push(body("\u672c\u62a5\u544a\u7684\u5206\u6790\u4ea7\u7269\uff08\u53cd\u7f16\u8bd1\u6e90\u7801\u3001\u5b57\u7b26\u4e32\u60c5\u62a5\u3001\u5bb9\u5668\u7ed3\u6784\u9a8c\u8bc1\u811a\u672c\uff09\u5747\u5df2\u4fdd\u5b58\u5728\u6c99\u7bb1\u5de5\u4f5c\u533a decompiled/ \u4e0e analysis/ \u76ee\u5f55\u4e0b\uff0c\u53ef\u5728\u5de5\u4f5c\u53f0\u6587\u4ef6\u6811\u4e2d\u968f\u65f6\u67e5\u9605\uff0c\u4e5f\u53ef\u901a\u8fc7\u5185\u7f6e\u7ec8\u7aef\u4e0e\u4f5c\u4e1a\u7cfb\u7edf\u590d\u73b0\u4efb\u4e00\u6761\u5b9e\u6d4b\u3002", { after: 200 }));

/* ---------------- 组装文档 ---------------- */
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimSun" }, size: 24, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 32, bold: true, color: P.primary },
        paragraph: { spacing: { before: 360, after: 160, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 28, bold: true, color: P.primary },
        paragraph: { spacing: { before: 240, after: 120, line: 312 }, outlineLevel: 1 },
      },
    },
  },
  sections: [
    /* Section 1: 封面（无页码） */
    {
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        title: "\u865a\u62df\u5927\u5e08 3.2.67 \u9006\u5411\u5206\u6790\u62a5\u544a",
        subtitle: "Root \u5b9e\u73b0\u673a\u5236\u4e0e Android-in-Android \u517c\u5bb9\u67b6\u6784 \u00b7 \u9762\u5411 AEmulator \u7684\u6539\u8fdb\u53c2\u7167",
        englishLabel: "REVERSE ENGINEERING REPORT",
        metaLines: [
          "\u6837\u672c\uff1a\u865a\u62df\u5927\u5e08_3.2.67.apk\uff08com.clone.android.dual.space\uff09",
          "\u65b9\u6cd5\uff1a\u9759\u6001\u9006\u5411\uff08jadx 1.5.6 \u00b7 apktool 3.0.3 \u00b7 ELF \u7b26\u53f7\u5206\u6790\uff09",
          "SHA-256\uff1ae7aaf628\u20268b8ee49\uff08\u5b8c\u6574\u503c\u89c1\u8868 1\uff09",
          "\u65e5\u671f\uff1a2026 \u5e74 11 \u6708 13 \u65e5",
        ],
        footerLeft: "Cloud Sandbox \u00b7 Z.ai",
        footerRight: "\u4ec5\u4f9b\u6280\u672f\u7814\u7a76\u4e0e\u4e92\u64cd\u4f5c\u53c2\u8003",
        palette: P.cover,
      }),
    },
    /* Section 2: 目录（罗马页码） */
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      headers: { default: pageHeader() },
      footers: { default: pageNumFooter() },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "\u76ee  \u5f55", bold: true, size: 32, font: { eastAsia: "SimHei", ascii: "Times New Roman" }, color: P.primary })],
        }),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({
            text: "\u6ce8\uff1a\u672c\u76ee\u5f55\u7531\u57df\u4ee3\u7801\u751f\u6210\u3002\u5982\u9875\u7801\u6709\u53d8\u52a8\uff0c\u8bf7\u5728 Word/WPS \u4e2d\u53f3\u952e\u70b9\u51fb\u76ee\u5f55\u5e76\u9009\u62e9\u201c\u66f4\u65b0\u57df\u201d\u5237\u65b0\u9875\u7801\u3002",
            italics: true, size: 18, color: "888888", font: { eastAsia: "SimSun", ascii: "Times New Roman" },
          })],
        }),
      ],
    },
    /* Section 3: 正文（阿拉伯页码，从 1 起） */
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: pageHeader() },
      footers: { default: pageNumFooter() },
      children: bodyChildren,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/z/my-project/download/\u865a\u62df\u5927\u5e08_3.2.67_\u9006\u5411\u5206\u6790\u62a5\u544a.docx", buf);
  console.log("OK docx written:", buf.length, "bytes");
});
