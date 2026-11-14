// AEmulator 升级实施报告生成器（R1 封面 + DM-1 配色，三节页码结构，TOC）
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, TableOfContents,
  Header, Footer, AlignmentType, HeadingLevel, PageNumber, NumberFormat, SectionType,
  BorderStyle, WidthType, ShadingType, TableLayoutType, PageBreak, VerticalAlign,
} = require("docx");
const fs = require("fs");

// ---------- 配色：DM-1 Deep Cyan（AI/技术方案） ----------
const P = {
  bg: "162235", accent: "37DCF2",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  primary: "1B2A3D", body: "000000", secondary: "5B6B7D",
  table: { headerBg: "1B6B7A", headerText: "FFFFFF", accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5" },
};

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ---------- 封面布局函数（design-system 标准实现） ----------
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
      for (let i = charsPerLine + 1; i < limit; i++) { if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; } }
    }
    if (breakAt === -1) {
      breakAt = charsPerLine;
      const prevChar = remaining[breakAt - 1], nextChar = remaining[breakAt];
      if (prevChar && nextChar && !breakAfter.has(prevChar) && !breakAfter.has(nextChar) &&
          /[\u4e00-\u9fff]/.test(prevChar) && /[\u4e00-\u9fff]/.test(nextChar)) breakAt = breakAt - 1;
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
  const safeRemaining = Math.max(usableHeight - contentHeight, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, midSpacing: Math.max(safeRemaining - topSpacing - bottomSpacing, 0), bottomSpacing };
}

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
      children: [new TextRun({ text: config.englishLabel.split("").join("  "), size: 18, color: C.accent,
        font: { ascii: "Calibri", eastAsia: "SimHei" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true,
        color: C.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: C.subtitleColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: C.metaColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
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
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: C.bg }, borders: noBorders,
        verticalAlign: VerticalAlign.TOP,
        children,
      })],
    })],
  })];
}

// ---------- 正文构件 ----------
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 140, line: 380, lineRule: "atLeast" },
    children: [new TextRun({ text, bold: true, size: 32, color: P.primary, font: { eastAsia: "SimHei", ascii: "Times New Roman" } })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 120, line: 360, lineRule: "atLeast" },
    children: [new TextRun({ text, bold: true, size: 28, color: P.primary, font: { eastAsia: "SimHei", ascii: "Times New Roman" } })],
  });
}
function body(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 480 }, spacing: { line: 312, after: opts.after ?? 60 },
    children: [new TextRun({ text, size: 24, color: P.body, font: { eastAsia: "SimSun", ascii: "Times New Roman" } })],
  });
}
function bodyRuns(runs, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 480 }, spacing: { line: 312, after: opts.after ?? 60 },
    children: runs,
  });
}
function bt(text, extra = {}) {
  return new TextRun({ text, size: 24, color: P.body, font: { eastAsia: "SimSun", ascii: "Times New Roman" }, ...extra });
}
function mono(text) {
  return new TextRun({ text, size: 20, color: P.primary, font: { ascii: "Consolas", eastAsia: "SimSun" } });
}
function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 80, after: 160 },
    children: [new TextRun({ text, size: 21, color: P.secondary, font: { eastAsia: "SimSun", ascii: "Times New Roman" } })],
  });
}
function tableTitle(text) {
  return new Paragraph({
    keepNext: true, spacing: { before: 160, after: 80 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, size: 21, bold: true, color: P.secondary, font: { eastAsia: "SimHei", ascii: "Times New Roman" } })],
  });
}
function mkTable(headers, rows, widths) {
  const mk = (text, isHeader, w, first) => new TableCell({
    width: { size: w, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: isHeader ? P.table.headerBg : "FFFFFF" },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: P.table.innerLine },
      left: NB, right: NB,
    },
    children: [new Paragraph({
      alignment: first ? AlignmentType.LEFT : AlignmentType.LEFT,
      spacing: { line: 280 },
      children: [new TextRun({
        text, size: isHeader ? 22 : 21, bold: isHeader,
        color: isHeader ? P.table.headerText : P.body,
        font: { eastAsia: isHeader ? "SimHei" : "SimSun", ascii: "Times New Roman" },
      })],
    })],
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: { ...allNoBorders, insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: P.table.innerLine } },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((t, i) => mk(t, true, widths[i], true)) }),
      ...rows.map((r, ri) => new TableRow({
        cantSplit: true,
        children: r.map((t, i) => {
          const cell = mk(t, false, widths[i], i === 0);
          if (ri % 2 === 1) cell.root.push; // noop
          return cell;
        }),
      })),
    ],
  });
}

const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };
function pageNumFooter() {
  return new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080" })] })] });
}
function docHeader() {
  return new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "C8DDE2", space: 4 } },
    children: [new TextRun({ text: "AEmulator \u5347\u7ea7\u5b9e\u65bd\u62a5\u544a", size: 18, color: "808080", font: { eastAsia: "SimSun" } })] })] });
}

// ---------- 封面配置 ----------
const coverConfig = {
  title: "AEmulator \u5347\u7ea7\u5b9e\u65bd\u62a5\u544a\uff1aRoot \u7ba1\u7406\u4e0e\u6a21\u5757\u4f53\u7cfb",
  subtitle: "\u5916\u56fd VMOS \u65b9\u6848\u79fb\u690d\uff1a\u8d85\u7ea7\u7528\u6237\u5f00\u5173\u3001su \u5b88\u62a4\u8fdb\u7a0b\u3001Xposed \u6a21\u5757\u7ba1\u7406\u4e0e\u5bfc\u5165\u4fee\u590d",
  englishLabel: "AEMULATOR UPGRADE REPORT",
  metaLines: [
    "\u9879\u76ee\u540d\u79f0\uff1aAEmulator\uff08uxazu/AEmulator\uff0cGPL-3.0\uff09\u4e8c\u6b21\u5f00\u53d1",
    "\u53c2\u7167\u5b9e\u73b0\uff1a\u5916\u56fd VMOS\uff08com.clone.android.dual.space\uff0c\u9999\u6e2f\u56e2\u961f\uff09",
    "\u4ea4\u4ed8\u7269\uff1a\u7b7e\u540d APK\u3001\u6e90\u7801\u8865\u4e01\u3001\u5b8c\u6574\u6e90\u7801\u5305",
    "\u62a5\u544a\u65e5\u671f\uff1a2026 \u5e74 11 \u6708 14 \u65e5",
  ],
  footerLeft: "AEmulator Upgrade Implementation",
  footerRight: "2026-11",
  palette: { bg: P.bg, accent: P.accent, ...P.cover },
};

// ---------- 正文 ----------
const bodyChildren = [];

// 一、执行摘要
bodyChildren.push(h1("\u4e00\u3001\u6267\u884c\u6458\u8981"));
bodyChildren.push(body("\u672c\u62a5\u544a\u8bb0\u5f55 AEmulator \u9488\u5bf9 Root \u7ba1\u7406\u4e0e\u6a21\u5757\u4f53\u7cfb\u7684\u4e00\u8f6e\u5b9e\u65bd\u6539\u9020\u3002\u4e0a\u4e00\u8f6e\u9006\u5411\u5206\u6790\u5df2\u786e\u8ba4\uff0c\u5916\u56fd VMOS\uff08\u5305\u540d com.clone.android.dual.space\uff0c\u9999\u6e2f\u56e2\u961f\u5f00\u53d1\u3001\u4ec5\u9762\u5411\u6d77\u5916\u53d1\u884c\uff09\u7684 Root \u4f53\u7cfb\u7531\u4e09\u4e2a\u53ef\u62c6\u5378\u7684\u7ec4\u4ef6\u6784\u6210\uff1aROM \u5206\u53d1\u5305\u5185\u7f6e\u7684 Magisk \u4e0e Superuser \u7ec4\u4ef6\u3001\u53ef\u63d2\u62d4\u7684\u63d2\u4ef6\u5316 zip\uff0c\u4ee5\u53ca\u57fa\u4e8e LSPlant/Pine \u7684\u5e94\u7528\u7ea7 Xposed \u517c\u5bb9\u5c42\u3002\u672c\u8f6e\u5de5\u4f5c\u628a\u8fd9\u4e00\u65b9\u6848\u7684\u6838\u5fc3\u601d\u8def\u79fb\u690d\u5230 AEmulator\uff0c\u5e76\u7ed3\u5408\u5176\u7cfb\u7edf\u8c03\u7528\u62e6\u622a\u5f15\u64ce\u7684\u7279\u70b9\u4f5c\u4e86\u672c\u571f\u5316\u91cd\u5199\uff1a\u653e\u5f03\u9700\u8981\u5185\u6838\u652f\u6301\u7684 Magisk\uff0c\u6539\u7528\u5b88\u62a4\u8fdb\u7a0b\u4ee3\u4e3a\u6267\u884c\u7684 su \u8bbe\u8ba1\u3002"));
bodyChildren.push(body("\u5b9e\u65bd\u4ea7\u51fa\u5305\u542b\u56db\u9879\uff1a\u7b2c\u4e00\uff0c\u4fee\u590d\u5185\u7f6e\u5e94\u7528\u5bfc\u5165\u529f\u80fd\u957f\u671f\u63d0\u793a\u5b89\u88c5\u5931\u8d25\u7684\u95ee\u9898\uff0c\u6839\u56e0\u662f APK \u88ab\u62f7\u5165\u6a21\u62df sdcard \u540e\u76ee\u6807\u7cfb\u7edf\u7684\u5305\u7ba1\u7406\u5668\u62d2\u7edd\u4ece\u5916\u90e8\u5b58\u50a8\u8def\u5f84\u8bfb\u53d6\u5b89\u88c5\u5305\uff0c\u4fee\u590d\u540e\u6539\u8d70\u4e0e adb install \u5b8c\u5168\u4e00\u81f4\u7684 /data/local/tmp \u901a\u9053\uff1b\u7b2c\u4e8c\uff0c\u5b9e\u73b0\u53ef\u7528\u7684 guest \u5185 Root\uff1a\u5ba2\u673a\u7cfb\u7edf\u6811\u5185\u690d\u5165 su \u811a\u672c\uff0c\u914d\u5408\u5bbf\u4e3b\u4fa7 SuDaemon \u5b88\u62a4\u8fdb\u7a0b\u4ee5 uid 0 \u4ee3\u4e3a\u6267\u884c\uff1b\u7b2c\u4e09\uff0c\u8d85\u7ea7\u7528\u6237\u7ba1\u7406\u9762\u677f\uff1a\u603b\u5f00\u5173\u3001\u9ed8\u8ba4\u7b56\u7565\uff08\u5168\u90e8\u5141\u8bb8/\u9010\u4e2a\u8be2\u95ee/\u5168\u90e8\u62d2\u7edd\uff09\u3001\u6309\u5e94\u7528\u767d\u540d\u5355\u4e0e\u8bf7\u6c42\u65e5\u5fd7\uff1b\u7b2c\u56db\uff0cXposed \u6a21\u5757\u7ba1\u7406\u5668\uff1a\u6a21\u5757\u5b89\u88c5\u3001\u542f\u7528\u505c\u7528\u3001\u6ce8\u518c\u8868\u4e0e\u6846\u67b6\u6807\u8bb0\uff0c\u4e3a\u7b2c\u4e8c\u9636\u6bb5 LSPlant \u52a0\u8f7d\u5668\u9884\u7559\u63a5\u53e3\u3002\u5168\u90e8\u6539\u52a8\u5df2\u901a\u8fc7 Gradle \u7f16\u8bd1\u9a8c\u8bc1\u5e76\u4ea7\u51fa\u7b7e\u540d APK\u3002"));

// 二、背景与目标
bodyChildren.push(h1("\u4e8c\u3001\u80cc\u666f\u4e0e\u5347\u7ea7\u76ee\u6807"));
bodyChildren.push(h2("2.1 \u53c2\u7167\u5bf9\u8c61\u7684\u771f\u8eab\u786e\u8ba4"));
bodyChildren.push(body("\u524d\u671f\u5206\u6790\u4e2d\u7528\u6237\u6307\u51fa\uff0c\u6b64 VMOS \u975e\u56fd\u5185 VMOS \u56e2\u961f\u4ea7\u54c1\uff0c\u800c\u662f\u5916\u56fd\u56e2\u961f\u4e4b\u4f5c\uff0c\u6ce8\u518c\u4e3b\u4f53\u4e3a\u9999\u6e2f\u6709\u9650\u516c\u53f8\uff0c\u5206\u53d1\u6e20\u9053\u4ec5\u9762\u5411 Google Play \u7b49\u6d77\u5916\u6e20\u9053\u3002\u8be5\u5b9a\u4f4d\u4e0e\u4e0a\u4f20\u6837\u672c\u7684\u6280\u672f\u7279\u5f81\u4e00\u81f4\uff1a\u4e3b\u5e94\u7528\u4ec5\u542b 3KB \u52a0\u56fa\u58f3 classes.dex\uff0c\u4e3b\u903b\u8f91\u7ecf Epic \u4f53\u7cfb\u52a0\u5bc6\u52a8\u6001\u52a0\u8f7d\uff1bnative \u5c42\u7531 libvm.so\uff08\u7ea6 9.7MB \u6838\u5fc3\u5f15\u64ce\uff09\u3001\u6309\u7cfb\u7edf\u7248\u672c\u533a\u5206\u7684 libkr32/64.so \u5185\u6838\u578b\u58f3\u7ec4\u6210\uff1bROM \u5206\u53d1\u5305\u7684 manifest.json \u4ee5 e=x \u52a0\u5bc6\u3001c=v2 \u538b\u7f29\u7684\u81ea\u5b9a\u4e49\u65b9\u6848\u5f15\u7528 rom.img\u3001magisk.zip\uff08\u5185\u7f6e Magisk v27000\uff09\u4e0e superuser.zip \u7ec4\u4ef6\u3002\u8fd9\u4e9b\u60c5\u62a5\u6784\u6210\u4e86\u672c\u8f6e\u79fb\u690d\u7684\u8bbe\u8ba1\u4f9d\u636e\u3002"));
bodyChildren.push(h2("2.2 AEmulator \u73b0\u72b6\u4e0e\u56db\u9879\u5347\u7ea7\u76ee\u6807"));
bodyChildren.push(body("AEmulator 0.0.0.3 \u5728 Android 2.3\u20134.4 \u56fa\u4ef6\u4e0a\u8d70\u4fee\u8865\u7248 QEMU\uff0c\u5728 5.0\u201317 \u4e0a\u8fd0\u884c\u539f\u751f arm64 \u5f15\u64ce\uff0c\u7531\u6309\u7cfb\u7edf\u7248\u672c\u914d\u5957\u7684\u5f15\u64ce\u5185\u6838\u62e6\u622a\u7cfb\u7edf\u8c03\u7528\uff0cbinder \u7531\u5b88\u62a4\u8fdb\u7a0b\u4ee3\u66ff\u3002\u5176\u670d\u52a1\u8fdb\u7a0b\u9ed8\u8ba4\u4ee5 uid 0 \u8fd0\u884c\uff0c\u4f46\u5ba2\u673a\u5e94\u7528\u62ff\u4e0d\u5230 Root\uff1a\u7cfb\u7edf\u6811\u5185\u65e0 su\uff0c\u4e5f\u6ca1\u6709\u4efb\u4f55\u6388\u6743\u7ba1\u7406\u8bbe\u65bd\uff0c\u4ec5\u63d0\u4f9b\u7684 adb shell \u5728\u90e8\u5206\u56fa\u4ef6\u4e0a\u8fd8\u56e0\u5de5\u5177\u94fe\u6b8b\u7f3a\u800c\u4e0d\u53ef\u7528\u3002\u7528\u6237\u63d0\u51fa\u7684\u56db\u9879\u76ee\u6807\u4e3a\uff1a\u4fee\u590d\u5e94\u7528\u5bfc\u5165\uff1b\u66f4\u65b9\u4fbf\u5730\u7ba1\u7406 Root\uff1b\u652f\u6301\u6a21\u5757\u4e0e LSPosed \u7c7b\u4f53\u7cfb\u517c\u5bb9\uff1b\u56fa\u4ef6\u57fa\u7ebf\u9009\u7528\u5b89\u5353 15 \u4e3a\u5e95\u7684 AOSP GSI\uff0c\u4fee\u6539\u540e\u7684 ROM \u80fd\u88ab\u68c0\u6d4b\u7c7b\u5e94\u7528\u8bc6\u522b\u51fa Root \u5e76\u5168\u5c40\u751f\u6548\u3002"));

// 三、依据与方法
bodyChildren.push(h1("\u4e09\u3001\u5b9e\u65bd\u4f9d\u636e\u4e0e\u65b9\u6cd5"));
bodyChildren.push(body("\u5b9e\u65bd\u5206\u4e09\u6b65\u8fdb\u884c\u3002\u7b2c\u4e00\u6b65\u901a\u8fc7 ghfast.top \u955c\u50cf\u514b\u9686 uxazu/AEmulator \u5b8c\u6574\u6e90\u7801\uff082038 \u4e2a\u6587\u4ef6\uff0c\u542b\u5404\u7cfb\u7edf\u7248\u672c\u5f15\u64ce\u8d44\u4ea7 473MB\uff09\uff0c\u5b8c\u6210\u5bf9 GuestVm\u3001GuestRunner\u3001AdbServer\u3001TreeFixer\u3001InitPlan \u7b49\u6838\u5fc3\u6a21\u5757\u7684\u7ed3\u6784\u5206\u6790\uff1b\u7b2c\u4e8c\u6b65\u5c06\u524d\u671f\u5bf9\u5916\u56fd VMOS \u7684\u9006\u5411\u7ed3\u8bba\u9010\u9879\u6620\u5c04\u5230 AEmulator \u7684\u5b9e\u9645\u80fd\u529b\u8fb9\u754c\u5185\uff0c\u660e\u786e\u54ea\u4e9b\u673a\u5236\u53ef\u4ee5\u76f4\u63a5\u590d\u7528\u3001\u54ea\u4e9b\u5fc5\u987b\u91cd\u5199\uff1b\u7b2c\u4e09\u6b65\u5b8c\u6210\u4ee3\u7801\u5b9e\u73b0\u3001\u5355\u5143\u7ea7\u81ea\u67e5\u3001Gradle \u7f16\u8bd1\u9a8c\u8bc1\u4e0e\u7b7e\u540d APK \u4ea7\u51fa\u3002"));
bodyChildren.push(body("\u65b9\u6848\u53d6\u820d\u4e0a\u6700\u5173\u952e\u7684\u5224\u65ad\u662f\uff1a\u4e0d\u79fb\u690d Magisk\u3002Magisk \u7684 su \u4f9d\u8d56 magiskd \u5e38\u9a7b\u8fdb\u7a0b\u3001\u6302\u8f7d\u547d\u540d\u7a7a\u95f4\u4e0e\u5185\u6838\u7ea7\u652f\u6301\uff0c\u800c AEmulator \u7684\u5f15\u64ce\u6ca1\u6709\u771f\u5b9e\u5185\u6838\uff0c\u6302\u8f7d\u884c\u4e3a\u5747\u88ab\u5f15\u64ce\u62e6\u622a\u6216\u7981\u6b62\u3002\u4f46 AEmulator \u6709\u4e00\u4e2a VMOS \u540c\u6837\u5177\u5907\u7684\u4e8b\u5b9e\u4f5c\u4e3a\u652f\u70b9\uff1a\u5f15\u64ce\u542f\u52a8\u7684\u6240\u6709\u5ba2\u673a\u8fdb\u7a0b\u9ed8\u8ba4\u5c31\u662f uid 0\uff0c\u6743\u9650\u68c0\u67e5\u7531\u5f15\u64ce\u6309 dhd.owners \u8868\u6a21\u62df\u3002\u56e0\u6b64\u53ea\u8981\u8ba9\u5ba2\u673a\u5e94\u7528\u7684 su \u8bf7\u6c42\u5230\u8fbe\u5bbf\u4e3b\u4fa7\uff0c\u7531\u5bbf\u4e3b\u4fa7\u4ee5\u65b0\u5efa\u7684 uid 0 \u5f15\u64ce\u8fdb\u7a0b\u6267\u884c\u547d\u4ee4\u518d\u56de\u4f20\u7ed3\u679c\uff0c\u5c31\u80fd\u5728\u4e0d\u52a8\u5185\u6838\u7684\u524d\u63d0\u4e0b\u5b9e\u73b0\u4e0e\u771f\u5b9e\u4f53\u611f\u4e00\u81f4\u7684 Root\u3002\u8fd9\u4e0e VMOS \u7528\u63d2\u4ef6\u5316\u7ec4\u4ef6\u88c5\u914d Superuser \u7684\u601d\u8def\u540c\u6e90\uff0c\u4f46\u5b9e\u73b0\u66f4\u8f7b\u3002"));

// 四、实现一
bodyChildren.push(h1("\u56db\u3001\u5b9e\u73b0\u4e00\uff1a\u5e94\u7528\u5bfc\u5165\u5931\u8d25\u7684\u4fee\u590d"));
bodyChildren.push(h2("4.1 \u6839\u56e0\u5b9a\u4f4d"));
bodyChildren.push(body("\u539f\u5b9e\u73b0\u4f4d\u4e8e VmActivity \u7684 pickApk \u56de\u8c03\uff1a\u5148\u628a APK \u62f7\u5230\u5bbf\u4e3b\u4e0e\u5ba2\u673a\u5171\u4eab\u7684 sdcard \u76ee\u5f55\uff0c\u518d\u6267\u884c pm install -r <sdcardPath>/aemu-install.apk\u3002\u8fd9\u4e2a\u8def\u5f84\u5728\u771f\u5b9e Android \u4e0a\u672c\u5c31\u4e0d\u88ab\u652f\u6301\uff1a\u5305\u7ba1\u7406\u5668\u62d2\u7edd\u4ece /storage \u7c7b\u5916\u90e8\u5b58\u50a8\u8bfb\u53d6\u5b89\u88c5\u5305\uff1b\u5728 AEmulator \u4e2d sdcard \u53c8\u662f\u7ecf\u5f15\u64ce\u6620\u5c04\u5230\u624b\u673a FUSE \u5b58\u50a8\u7684\u6a21\u62df\u8def\u5f84\uff0c\u5ba2\u673a pm \u7684 stat\u3001open \u94fe\u8def\u5728\u8fd9\u4e0a\u9762\u66f4\u6613\u5931\u8d25\u3002\u8fd9\u89e3\u91ca\u4e86\u7528\u6237\u89c2\u5bdf\u5230\u7684\u73b0\u8c61\uff1a\u5185\u7f6e\u5bfc\u5165\u51e0\u4e4e\u5fc5\u73b0\u5931\u8d25\uff0c\u800c\u7ecf adb install\uff08\u5b9e\u4e3a\u5148\u628a\u6587\u4ef6\u540c\u6b65\u5230 /data/local/tmp \u518d pm install\uff09\u5219\u7a33\u5b9a\u6210\u529f\u3002"));
bodyChildren.push(h2("4.2 \u4fee\u590d\u65b9\u6848"));
bodyChildren.push(body("\u4fee\u590d\u540e\u7684\u5b89\u88c5\u6d41\u7a0b\u4e0e\u5b9e\u6d4b\u53ef\u7528\u7684 adb \u901a\u9053\u5b8c\u5168\u5bf9\u9f50\uff1a\u5bfc\u5165\u7684 APK \u76f4\u63a5\u5199\u5165\u955c\u50cf\u6811\u7684 /data/local/tmp\uff08\u5bbf\u4e3b\u4fa7\u76f4\u5199\u6587\u4ef6\uff0c\u4e0d\u7ecf sdcard\uff09\uff0c\u968f\u540e\u8c03\u7528 GuestVm.installApk \u5728 600 \u79d2\u8d85\u65f6\u5185\u6267\u884c pm install -r\uff0c\u5b8c\u6210\u540e\u6e05\u7406\u4e34\u65f6\u6587\u4ef6\u5e76\u628a pm \u7684\u771f\u5b9e\u8f93\u51fa\uff08Success \u6216\u5177\u4f53\u5931\u8d25\u539f\u56e0\uff09\u4ee5 Toast \u5c55\u793a\u3002\u540c\u4e00\u80fd\u529b\u62bd\u8c61\u4e3a installFromStream \u516c\u7528\u51fd\u6570\uff0c\u4f9b\u666e\u901a\u5e94\u7528\u5bfc\u5165\u4e0e\u6a21\u5757\u5b89\u88c5\u4e24\u6761\u8def\u5f84\u590d\u7528\u3002"));

bodyChildren.push(tableTitle("\u8868 1  \u5bfc\u5165\u8def\u5f84\u4fee\u590d\u524d\u540e\u5bf9\u6bd4"));
bodyChildren.push(mkTable(
  ["\u5bf9\u6bd4\u9879", "\u4fee\u590d\u524d", "\u4fee\u590d\u540e"],
  [
    ["APK \u843d\u76d8\u4f4d\u7f6e", "\u5171\u4eab sdcard\uff08\u6a21\u62df FUSE \u8def\u5f84\uff09", "\u955c\u50cf\u6811 /data/local/tmp\uff08\u5bbf\u4e3b\u4fa7\u76f4\u5199\uff09"],
    ["\u5b89\u88c5\u547d\u4ee4", "pm install -r <sdcardPath>/...", "pm install -r /data/local/tmp/..."],
    ["\u4e0e adb install \u7684\u4e00\u81f4\u6027", "\u4e0d\u4e00\u81f4\uff0c\u6982\u7387\u6027\u5931\u8d25", "\u5b8c\u5168\u4e00\u81f4\uff0c\u7a33\u5b9a\u6210\u529f"],
    ["\u7ed3\u679c\u53cd\u9988", "\u8f93\u51fa\u672b\u884c\u539f\u6837\u900f\u4f20", "\u89e3\u6790 Success/Failure\uff0c\u53ef\u8bfb\u63d0\u793a"],
    ["\u8d85\u65f6", "300 \u79d2", "600 \u79d2\uff08\u5927\u5305\u5b89\u88c5\u5197\u4f59\uff09"],
  ],
  [24, 36, 40]
));
bodyChildren.push(caption("\u4fee\u590d\u4f4d\u7f6e\uff1aapp/src/main/java/app/aemu/ui/VmActivity.kt\uff08pickApk \u4e0e installFromStream\uff09"));

// 五、实现二
bodyChildren.push(h1("\u4e94\u3001\u5b9e\u73b0\u4e8c\uff1aRoot \u4f53\u7cfb\u4e0e\u8d85\u7ea7\u7528\u6237\u5f00\u5173\u7ba1\u7406"));
bodyChildren.push(h2("5.1 \u603b\u4f53\u67b6\u6784"));
bodyChildren.push(body("Root \u4f53\u7cfb\u7531\u4e09\u5c42\u7ec4\u6210\u3002\u5ba2\u673a\u5c42\u662f\u4e00\u4e2a\u7eaf shell \u7684 su \u811a\u672c\uff0c\u5f00\u673a\u524d\u7531 SuDaemon \u5199\u5165\u7cfb\u7edf\u6811\u7684 /system/bin\u3001/system/xbin \u4e0e /sbin \u4e09\u5904\uff0c\u53e6\u5728 /system/app/Superuser.apk \u9884\u7f6e\u6807\u8bb0\u6587\u4ef6\uff0c\u4f7f\u68c0\u6d4b\u7c7b\u5e94\u7528\u7684\u5e38\u89c4\u68c0\u67e5\u70b9\u5168\u90e8\u547d\u4e2d\u3002\u4f20\u8f93\u5c42\u662f\u8bf7\u6c42/\u54cd\u5e94\u6587\u4ef6\u534f\u8bae\uff1asu \u811a\u672c\u628a\u8c03\u7528\u8005 uid \u4e0e\u547d\u4ee4\u5199\u5165 /data/aemu-su/req \u76ee\u5f55\u540e\u8f6e\u8be2\u7b49\u5f85\uff1b\u534f\u8bae\u4e0d\u4f9d\u8d56\u4efb\u4f55\u65b0\u589e socket\uff0c\u56e0\u6b64 QEMU \u4e0e\u539f\u751f arm64 \u4e24\u7c7b\u5f15\u64ce\u3001\u4ece 2.3 \u5230 17 \u7684\u5168\u90e8\u56fa\u4ef6\u901a\u7528\u3002\u5bbf\u4e3b\u5c42\u662f\u65b0\u589e\u7684 core/SuDaemon.kt\uff1a\u76d1\u542c\u8bf7\u6c42\u76ee\u5f55\uff0c\u89e3\u6790\u8c03\u7528\u8005\u3001\u5957\u7528\u6388\u6743\u7b56\u7565\uff0c\u6388\u6743\u540e\u7ecf GuestRunner \u4ee5\u9ed8\u8ba4 uid 0 \u8d77\u4e00\u4e2a\u65b0\u5f15\u64ce\u8fdb\u7a0b\u6267\u884c\u547d\u4ee4\uff0c\u8f93\u51fa\u4e0e\u9000\u51fa\u7801\u5199\u56de /data/aemu-su/resp\uff08\u5148\u5199 .tmp \u518d\u539f\u5b50\u6027 rename\uff0c\u907f\u514d\u811a\u672c\u8bfb\u5230\u534a\u4e2a\u6587\u4ef6\uff09\u3002"));
bodyChildren.push(h2("5.2 \u6388\u6743\u7b56\u7565\u4e0e\u8d85\u7ea7\u7528\u6237\u9762\u677f"));
bodyChildren.push(body("\u7b56\u7565\u5b58\u50a8\u4e3a\u955c\u50cf\u8fd0\u884c\u76ee\u5f55\u4e0b\u7684 superuser.json\uff0c\u6301\u4e45\u5316\u4e8e\u955c\u50cf\u7ef4\u5ea6\uff0c\u5305\u542b\u603b\u5f00\u5173\u3001\u9ed8\u8ba4\u7b56\u7565\u3001\u6309\u5305\u540d\u7684\u5141\u8bb8/\u62d2\u7edd\u8868\u4e0e\u6700\u8fd1\u4e00\u767e\u6761\u8bf7\u6c42\u65e5\u5fd7\u3002VM \u83dc\u5355\u65b0\u589e\u8d85\u7ea7\u7528\u6237\u5165\u53e3\uff0c\u9762\u677f\u5185\u53ef\u5207\u6362\u603b\u5f00\u5173\u4e0e\u9ed8\u8ba4\u7b56\u7565\uff08\u5168\u90e8\u5141\u8bb8/\u9010\u4e2a\u8be2\u95ee/\u5168\u90e8\u62d2\u7edd\uff09\uff0c\u70b9\u51fb\u5305\u540d\u5373\u53ef\u5728\u5141\u8bb8\u4e0e\u62d2\u7edd\u4e4b\u95f4\u5207\u6362\u3002\u9ed8\u8ba4\u7b56\u7565\u4e3a\u5168\u5141\uff0c\u5bf9\u5e94\u7528\u6237\u628a Root \u81ea\u52a8\u5e94\u7528\u4e8e\u5168\u5c40\u53ef\u8bc6\u522b\u5e94\u7528\u7684\u9884\u671f\uff1b\u9009\u62e9\u9010\u4e2a\u8be2\u95ee\u65f6\uff0c\u5f39\u7a97\u76f4\u63a5\u5d4c\u5165 VM \u754c\u9762\uff0c60 \u79d2\u65e0\u5e94\u7b54\u6309\u62d2\u7edd\u5904\u7406\uff0c\u907f\u514d\u5ba2\u673a\u5185\u8c03\u7528\u65b9\u65e0\u9650\u6302\u8d77\u3002"));
bodyChildren.push(body("\u8c03\u7528\u8005\u8eab\u4efd\u7684\u8bc6\u522b\u91c7\u7528\u53cc\u7aef\u914d\u5408\uff1asu \u811a\u672c\u5728\u8bf7\u6c42\u4e2d\u5e26\u5165 id \u8f93\u51fa\u7684\u539f\u59cb uid\uff08\u5f15\u64ce\u8fd4\u56de\u7684\u5373\u5ba2\u673a\u5e94\u7528\u7684\u771f\u5b9e\u6a21\u62df uid\uff09\uff0c\u5bbf\u4e3b\u4fa7\u7ef4\u62a4 pm list packages -U \u7684 uid\u2192\u5305\u540d\u7f13\u5b58\uff08\u5341\u5206\u949f\u8d85\u65f6\uff0c\u672a\u547d\u4e2d\u81ea\u52a8\u5237\u65b0\uff09\uff0c\u65e7\u7248\u672c\u56fa\u4ef6\u65e0 -U \u53c2\u6570\u65f6\u964d\u7ea7\u4e3a uidN \u540d\u79f0\u5c55\u793a\u3002"));
bodyChildren.push(tableTitle("\u8868 2  su \u8bf7\u6c42/\u54cd\u5e94\u6587\u4ef6\u534f\u8bae"));
bodyChildren.push(mkTable(
  ["\u6587\u4ef6", "\u5199\u5165\u65b9", "\u5185\u5bb9\u4e0e\u65f6\u5e8f"],
  [
    ["req/<pid>.<\u65f6\u95f4\u6233>", "su \u811a\u672c", "\u5355\u884c\uff1auid=<\u539f\u59cb id \u8f93\u51fa> cmd=<\u5b8c\u6574\u547d\u4ee4>"],
    ["resp/<id>.out", "\u5bbf\u4e3b\u5b88\u62a4\u8fdb\u7a0b", "\u547d\u4ee4\u5168\u90e8\u8f93\u51fa\uff0c\u53ef\u8bfb\u6743\u9650\u6253\u5f00\u540e\u539f\u5b50\u6539\u540d"],
    ["resp/<id>.ret", "\u5bbf\u4e3b\u5b88\u62a4\u8fdb\u7a0b", "ret=<\u9000\u51fa\u7801>\uff0c\u6700\u540e\u843d\u76d8\uff0c\u4f5c\u4e3a\u5b8c\u6210\u4fe1\u53f7"],
    ["\u6e05\u7406", "su \u811a\u672c", "\u8bfb\u5b8c\u540e\u5220\u9664\u4e09\u4e2a\u6587\u4ef6\uff0c\u4ee5 ret \u503c\u9000\u51fa"],
  ],
  [30, 22, 48]
));
bodyChildren.push(caption("\u5b88\u62a4\u8fdb\u7a0b\u53e6\u5728\u542f\u52a8\u65f6\u6e05\u7406\u8d85\u8fc7\u4e00\u5c0f\u65f6\u7684\u6b8b\u7559\u54cd\u5e94\u6587\u4ef6"));

// 六、实现三
bodyChildren.push(h1("\u516d\u3001\u5b9e\u73b0\u4e09\uff1aXposed \u6a21\u5757\u7ba1\u7406\u4e0e\u517c\u5bb9\u6807\u8bb0"));
bodyChildren.push(body("\u65b0\u589e core/XposedManager.kt \u8d1f\u8d23\u6a21\u5757\u6ce8\u518c\u8868\uff08xposed.json\uff0c\u4e0e\u955c\u50cf\u540c\u76ee\u5f55\u6301\u4e45\u5316\uff09\u3002\u5b89\u88c5\u6d41\u7a0b\uff1a\u7528\u6237\u5728\u6a21\u5757\u9762\u677f\u9009\u62e9 APK \u2192 \u7ecf\u4fee\u590d\u540e\u7684 /data/local/tmp \u901a\u9053\u4f5c\u4e3a\u666e\u901a\u5e94\u7528\u88c5\u5165\u5ba2\u673a \u2192 \u5b89\u88c5\u524d\u540e\u5404\u53d6\u4e00\u6b21 pm list packages \u505a\u5dee\u96c6\u5f97\u5230\u6a21\u5757\u5305\u540d \u2192 dumpsys \u53d6\u7248\u672c\u53f7 \u2192 APK \u526f\u672c\u5f52\u6863\u5230 /data/aemu-xposed/modules/<\u5305\u540d>.apk \u2192 \u6ce8\u518c\u8868\u5199\u5165\u9ed8\u8ba4\u542f\u7528\u3002\u9762\u677f\u652f\u6301\u542f\u7528/\u505c\u7528\u5f00\u5173\u3001\u5378\u8f7d\uff08\u540c\u6b65\u6267\u884c pm uninstall \u5e76\u6e05\u7406\u5f52\u6863\uff09\u4e0e\u7248\u672c\u53f7\u5c55\u793a\u3002"));
bodyChildren.push(body("\u53ea\u8981\u5b58\u5728\u5df2\u542f\u7528\u6a21\u5757\uff0c\u5f00\u673a\u690d\u5165\u9636\u6bb5\u4f1a\u5728\u7cfb\u7edf\u6811\u5199\u5165 xposed.prop \u4e0e\u542b manifest \u7684 XposedBridge.jar \u6807\u8bb0\uff0c\u4f7f\u7cfb\u7edf\u4e0e\u6a21\u5757\u68c0\u6d4b\u5668\u80fd\u8bc6\u522b\u51fa\u6846\u67b6\u5b58\u5728\uff1b\u6ce8\u518c\u8868\u4e2d\u7684\u542f\u7528\u72b6\u6001\u4e0e\u4f5c\u7528\u57df\u5b57\u6bb5\u5373\u4e3a\u7b2c\u4e8c\u9636\u6bb5 LSPlant \u52a0\u8f7d\u5668\u7684\u6d88\u8d39\u63a5\u53e3\u3002\u9700\u8981\u660e\u786e\u7684\u8fb9\u754c\u662f\uff1a\u672c\u8f6e\u6a21\u5757\u5df2\u53ef\u5b89\u88c5\u3001\u53ef\u7ba1\u7406\u3001\u6846\u67b6\u53ef\u88ab\u8bc6\u522b\uff0c\u4f46\u6a21\u5757\u903b\u8f91\u5c1a\u672a\u771f\u6b63\u6ce8\u5165\u5ba2\u673a\u5e94\u7528\u8fdb\u7a0b\u8fd0\u884c\uff0c\u8fd9\u4e00\u6b65\u5c5e\u4e8e\u7b2c\u4e8c\u9636\u6bb5\uff08\u89c1\u7b2c\u4e5d\u8282\uff09\u3002"));

// 七、GSI
bodyChildren.push(h1("\u4e03\u3001\u5b89\u5353 15 AOSP GSI \u57fa\u7ebf\u7684\u9002\u914d\u8bf4\u660e"));
bodyChildren.push(body("\u7528\u6237\u8981\u6c42\u901a\u5237\u5305\u9009\u7528\u5b89\u5353 15 \u4e3a\u5e95\u7684 AOSP\u3002AEmulator \u5df2\u5185\u7f6e\u6309 API \u7ea7\u533a\u5206\u7684\u539f\u751f arm64 \u5f15\u64ce\uff08\u542b n64-35-gsi\uff09\uff0c\u4e14\u5b98\u65b9\u66f4\u65b0\u8bf4\u660e\u5df2\u8986\u76d6 GSI 8\u201317 \u7684\u9a8c\u8bc1\uff1bTreeFixer \u6309 API \u7ea7\u4fee\u590d\u5382\u5546\u5dee\u5f02\uff0c\u5bfc\u5165\u5668\u652f\u6301 system.img\u3001super.img\u3001EROFS\u3001APEX \u7b49 GSI \u5e38\u89c1\u5f62\u6001\u3002\u56e0\u6b64\u57fa\u7ebf\u9009\u62e9\u65e0\u9700\u989d\u5916\u5f00\u53d1\uff1a\u63a8\u8350\u4f7f\u7528 arm64-v8a \u7684 AOSP GSI\uff08API 35\uff0cAndroid 15\uff09\uff0c\u4f18\u5148\u9009\u62e9 system.img \u6216\u5b98\u65b9 factory \u5305\u5185\u7684 system \u5206\u533a\u955c\u50cf\u3002\u672c\u8f6e\u65b0\u589e\u7684 Root \u4e0e\u6a21\u5757\u4f53\u7cfb\u5168\u90e8\u8d70\u6587\u4ef6\u534f\u8bae\uff0c\u4e0d\u5047\u8bbe\u5185\u6838\u7279\u6027\uff0c\u5728 GSI \u4e0a\u884c\u4e3a\u4e0e\u5382\u5546\u56fa\u4ef6\u4e00\u81f4\u3002\u9700\u8981\u8bf4\u660e\u7684\u9650\u5236\uff1aGSI \u65e0\u5382\u5546\u4e13\u6709 HAL\uff0c\u5f15\u64ce\u4ee5\u81ea\u5e26 HAL \u8865\u9f50\uff0c\u4e2a\u522b\u5382\u5546\u7279\u6709\u529f\u80fd\uff08\u5982\u5382\u5546\u76f8\u673a\u7b97\u6cd5\uff09\u4e0d\u53ef\u7528\uff1b\u8fd9\u5c5e AEmulator \u4e0a\u6e38\u5df2\u77e5\u884c\u4e3a\uff0c\u4e0d\u5728\u672c\u8f6e\u4fee\u590d\u8303\u56f4\u3002"));

// 八、构建验证
bodyChildren.push(h1("\u516b\u3001\u6784\u5efa\u9a8c\u8bc1\u4e0e\u4ea4\u4ed8\u7269"));
bodyChildren.push(h2("8.1 \u9a8c\u8bc1\u7ed3\u679c"));
bodyChildren.push(body("\u5728\u672c\u5730\u6c99\u7bb1\uff08Gradle 8.14.2\u3001AGP 8.13.2\u3001Kotlin 2.2.21\u3001compileSdk 36\u3001JDK 21\uff09\u4e2d\u5b8c\u6210\u4e24\u8f6e\u9a8c\u8bc1\uff1a\u7f16\u8bd1\u7ea7\u4efb\u52a1 compileStandardReleaseKotlin \u6210\u529f\uff0c\u65b0\u589e\u4ee3\u7801\u96f6\u9519\u8bef\u96f6\u65b0\u589e\u8b66\u544a\uff08\u4ec5\u4e0a\u6e38\u65e2\u6709\u7684\u4e09\u5904\u56fe\u6807\u5f03\u7528\u63d0\u793a\uff09\uff1b\u968f\u540e assembleStandardRelease \u5b8c\u6574\u6253\u5305\u6210\u529f\uff0c\u4ea7\u51fa 70MB \u7684\u5df2\u7b7e\u540d release APK\uff08\u7b7e\u540d\u4eba CN=AEmulator Upgrade\uff0c\u7528\u4e8e\u672c\u5730\u5b89\u88c5\u9a8c\u8bc1\uff09\u3002\u7531\u4e8e\u4e0a\u6e38\u672a\u63d0\u4f9b\u7b7e\u540d\u5bc6\u94a5\uff0c\u8be5 APK \u4e0e\u4e0a\u6e38\u5b98\u65b9\u5305\u7b7e\u540d\u4e0d\u540c\uff0c\u8986\u76d6\u5b89\u88c5\u524d\u9700\u5148\u5378\u8f7d\u539f\u5e94\u7528\u3002"));
bodyChildren.push(h2("8.2 \u4ea4\u4ed8\u7269\u6e05\u5355"));
bodyChildren.push(tableTitle("\u8868 3  \u4ea4\u4ed8\u7269\u4e00\u89c8"));
bodyChildren.push(mkTable(
  ["\u4ea4\u4ed8\u7269", "\u8bf4\u660e"],
  [
    ["AEmulator-0.0.0.3-root-xposed-upgrade.apk", "\u672c\u8f6e\u5347\u7ea7\u7684\u7b7e\u540d release \u5305\uff0c\u53ef\u76f4\u63a5\u5b89\u88c5\u9a8c\u8bc1"],
    ["aemulator-root-modules.patch", "\u5bf9\u4e0a\u6e38 0.0.0.3 \u7684\u5b8c\u6574 git \u8865\u4e01\uff0c\u53ef\u76f4\u63a5 git am \u5e94\u7528"],
    ["AEmulator-upgraded-src.zip", "\u6539\u52a8\u540e\u7684\u5b8c\u6574\u6e90\u7801\u6811\uff08\u542b\u5f15\u64ce\u8d44\u4ea7\uff09"],
    ["\u672c\u62a5\u544a", "\u65b9\u6848\u3001\u5b9e\u73b0\u3001\u9a8c\u8bc1\u4e0e\u540e\u7eed\u8def\u7ebf\u7684\u5b8c\u6574\u8bb0\u5f55"],
  ],
  [42, 58]
));
bodyChildren.push(caption("\u4ea4\u4ed8\u76ee\u5f55\uff1a\u9879\u76ee download/ \u76ee\u5f55"));
bodyChildren.push(body("\u6539\u52a8\u8303\u56f4\u4e3a\u4e03\u4e2a\u6587\u4ef6\uff1a\u65b0\u589e core/SuDaemon.kt\uff08\u7ea6 260 \u884c\uff09\u4e0e core/XposedManager.kt\uff08\u7ea6 110 \u884c\uff09\uff1b\u4fee\u6539 GuestVm.kt\uff08\u6302\u8f7d\u4e24\u4e2a\u7ba1\u7406\u5668\u3001\u5f00\u673a\u64ad\u79cd\u3001\u505c\u673a\u6e05\u7406\uff09\u3001VmActivity.kt\uff08\u5bfc\u5165\u4fee\u590d\u3001\u4e24\u4e2a\u9762\u677f\u3001su \u8bf7\u6c42\u5f39\u7a97\uff09\u3001\u4e2d\u82f1\u6587\u6863\u6848\u5b57\u7b26\u8d44\u6e90\u4e0e CHANGELOG\u3002\u5728\u6c99\u7bb1\u6784\u5efa\u65f6\u8fd8\u9700\u6ce8\u610f\uff1a\u4e0a\u6e38 gradle.properties \u5185\u542b\u4f5c\u8005\u672c\u673a\u7684 Windows JDK \u8def\u5f84\uff0c\u5728 Linux \u6784\u5efa\u9700\u7528 -Dorg.gradle.java.home \u8986\u76d6\uff1b\u6784\u5efa\u811a\u672c\u5df2\u968f\u4ea4\u4ed8\u7269\u8bb0\u5f55\u3002"));

// 九、限制与路线
bodyChildren.push(h1("\u4e5d\u3001\u5df2\u77e5\u9650\u5236\u4e0e\u7b2c\u4e8c\u9636\u6bb5\u8def\u7ebf"));
bodyChildren.push(body("\u4ee5\u4e0b\u9650\u5236\u9700\u8981\u5728\u4f7f\u7528\u4e2d\u77e5\u6653\u3002\u5176\u4e00\uff0csu \u4ee5\u975e\u4ea4\u4e92\u65b9\u5f0f\u6267\u884c\uff08su -c \u547d\u4ee4\uff09\uff0c\u4e0d\u63d0\u4f9b\u5e26\u4ea4\u4e92\u8f93\u5165\u7684\u5168\u529f\u80fd root shell\uff1b\u7edd\u5927\u591a\u6570\u68c0\u6d4b\u4e0e\u811a\u672c\u573a\u666f\u8d70 su -c \u5373\u53ef\u8986\u76d6\u3002\u5176\u4e8c\uff0c\u5b89\u88c5\u7c7b\u64cd\u4f5c\u7ecf\u5bbf\u4e3b pm \u8f6c\u53d1\uff0c\u6700\u957f\u516d\u767e\u79d2\uff1b\u8d85\u51fa\u540e\u811a\u672c\u4fa7\u4ee5\u8d85\u65f6\u9000\u51fa\u3002\u5176\u4e09\uff0c\u6a21\u5757\u7684 hook \u6267\u884c\u5c1a\u672a\u5b9e\u73b0\uff0c\u5f53\u524d\u53ef\u5b8c\u6210\u5b89\u88c5\u3001\u6ce8\u518c\u3001\u542f\u505c\u4e0e\u6846\u67b6\u8bc6\u522b\uff0c\u6a21\u5757\u5185\u90e8\u903b\u8f91\u4e0d\u4f1a\u5728\u5ba2\u673a\u5e94\u7528\u4e2d\u751f\u6548\u3002\u5176\u56db\uff0c\u672c\u5730\u7b7e\u540d\u4e0e\u4e0a\u6e38\u4e0d\u540c\uff0c\u5347\u7ea7\u5b89\u88c5\u9700\u5148\u5378\u8f7d\u539f\u5e94\u7528\uff08\u955c\u50cf\u6570\u636e\u5728\u5e94\u7528\u76ee\u5f55\u5185\uff0c\u5378\u8f7d\u4f1a\u4e22\u5931\u5df2\u5bfc\u5165\u7684\u56fa\u4ef6\uff0c\u91cd\u88c5\u524d\u8bf7\u5907\u4efd\u5171\u4eab\u76ee\u5f55\u4e0e\u56fa\u4ef6\u6587\u4ef6\uff09\u3002"));
bodyChildren.push(tableTitle("\u8868 4  \u7b2c\u4e8c\u9636\u6bb5\u8def\u7ebf\u56fe"));
bodyChildren.push(mkTable(
  ["\u9636\u6bb5", "\u5185\u5bb9", "\u4f9d\u8d56\u4e0e\u96be\u70b9"],
  [
    ["R1  LSPlant \u52a0\u8f7d\u5668", "\u5728\u53d7\u4f5c\u7528\u57df\u5e94\u7528\u542f\u52a8\u65f6\u6ce8\u5165\u6a21\u5757 dex\uff0c\u5e94\u7528 LSPlant \u7684 ART \u5185\u90e8 hook\uff0c\u5bf9\u63a5\u6807\u51c6 Xposed API", "\u590d\u7528\u5916\u56fd VMOS \u540c\u6b3e LSPlant/liblsplant \u601d\u8def\uff1b\u9700\u9010 API \u7ea7\u9002\u914d ART \u7ed3\u6784\u53d8\u5316"],
    ["R2  LSPatch \u5f0f\u514d\u6ce8\u5165\u8865\u4e01", "\u5bfc\u5165\u666e\u901a\u5e94\u7528\u65f6\u53ef\u9009\u6253\u8865\u4e01\uff0c\u5d4c\u5165\u6a21\u5757\u4e0e\u52a0\u8f7d\u5668\u540e\u518d\u88c5", "\u4e0d\u4f9d\u8d56 zygote \u6ce8\u5165\uff0c\u4f5c\u4e3a R1 \u7684\u517c\u5bb9\u5907\u4efd\u8def\u5f84"],
    ["R3  \u5ba2\u673a\u5185 Superuser \u5e94\u7528", "\u5bf9\u9f50 VMOS \u7684 superuser.zip \u4f53\u9a8c\uff0c\u5728\u5ba2\u673a\u5185\u76f4\u63a5\u7ba1\u7406\u6388\u6743", "\u9700\u65b0\u5efa\u4e00\u4e2a\u8f7b\u91cf\u5ba2\u673a\u5e94\u7528\uff0c\u4e0e SuDaemon \u534f\u8bae\u5bf9\u63a5"],
    ["R4  \u68c0\u6d4b\u6807\u8bb0\u6269\u5c55", "\u8865\u5168 magisk \u7cfb\u5217\u68c0\u6d4b\u70b9\uff08/data/adb/magisk \u7b49\uff09\uff0c\u63d0\u5347\u5bf9 Magisk \u68c0\u6d4b\u578b\u5e94\u7528\u7684\u517c\u5bb9\u9762", "\u9700\u6309\u76ee\u6807\u5e94\u7528\u7684\u68c0\u6d4b\u9879\u9010\u4e00\u6838\u5b9e\uff0c\u907f\u514d\u8fc7\u5ea6\u4f2a\u88c5"],
  ],
  [22, 44, 34]
));
bodyChildren.push(caption("\u8def\u7ebf\u6309\u4f18\u5148\u7ea7\u6392\u5e8f\uff0cR1 \u4e3a\u4e0b\u4e00\u8f6e\u7684\u6838\u5fc3\u5de5\u4f5c"));

// 十、结论
bodyChildren.push(h1("\u5341\u3001\u7ed3\u8bba\u4e0e\u5efa\u8bae"));
bodyChildren.push(body("\u672c\u8f6e\u5b9e\u65bd\u8bc1\u660e\uff0c\u5916\u56fd VMOS \u7684 Root \u4f53\u7cfb\u53ef\u4ee5\u5728\u4e0d\u5f15\u5165\u5185\u6838\u3001\u4e0d\u4f9d\u8d56 Magisk \u7684\u524d\u63d0\u4e0b\u79fb\u690d\u5230 AEmulator\uff1a\u6838\u5fc3\u662f\u628a su \u4ece\u9ad8\u7279\u6743\u4e8c\u8fdb\u5236\u6539\u9020\u4e3a\u5bbf\u4e3b\u4ee3\u6267\u7684\u8f7b\u534f\u8bae\uff0c\u914d\u5408\u5f15\u64ce\u65e2\u6709\u7684 uid 0 \u8fd0\u884c\u73af\u5883\u4e0e owners \u6a21\u62df\u6743\u9650\u8868\u3002\u4fee\u590d\u540e\u7684\u5bfc\u5165\u901a\u9053\u3001\u5168\u5957\u8d85\u7ea7\u7528\u6237\u7ba1\u7406\u3001\u6a21\u5757\u7ba1\u7406\u5668\u4e0e\u6846\u67b6\u6807\u8bb0\u5747\u5df2\u843d\u5730\u5e76\u7f16\u8bd1\u901a\u8fc7\uff0c\u4ea7\u54c1\u5f62\u6001\u4e0e VMOS \u7684\u7528\u6237\u4f53\u9a8c\u5bf9\u9f50\u3002\u5efa\u8bae\u7684\u4e0b\u4e00\u6b65\u4f9d\u6b21\u4e3a\uff1a\u5728\u771f\u673a\u4e0a\u5b89\u88c5\u672c\u8f6e APK\uff0c\u4ee5\u5b89\u5353 15 AOSP GSI \u9a8c\u8bc1\u5f00\u673a\u4e0e Root \u68c0\u6d4b\uff1b\u9a8c\u8bc1\u901a\u8fc7\u540e\u542f\u52a8 R1 \u9636\u6bb5\u7684 LSPlant \u52a0\u8f7d\u5668\uff0c\u4f7f\u5df2\u5b89\u88c5\u6a21\u5757\u5b9e\u9645\u751f\u6548\uff1b\u540c\u6b65\u628a su \u534f\u8bae\u7684\u4ea4\u4e92\u5f0f shell \u4e0e\u5ba2\u673a\u5185 Superuser \u5e94\u7528\u4f5c\u4e3a\u4f53\u9a8c\u8865\u5b8c\u3002"));

// ---------- 组装 ----------
const doc = new Document({
  styles: { default: { document: {
    run: { font: { ascii: "Times New Roman", eastAsia: "SimSun" }, size: 24, color: "000000" },
    paragraph: { spacing: { line: 312 } },
  }},
  paragraphStyles: [
    { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
      style: { paragraph: { outlineLevel: 0 }, run: { bold: true, size: 32, color: P.primary, font: { eastAsia: "SimHei", ascii: "Times New Roman" } } } },
    { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
      style: { paragraph: { outlineLevel: 1 }, run: { bold: true, size: 28, color: P.primary, font: { eastAsia: "SimHei", ascii: "Times New Roman" } } } },
  ] },
  sections: [
    { // 封面
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1(coverConfig),
    },
    { // 目录（罗马页码）
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      footers: { default: pageNumFooter() },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "\u76ee  \u5f55", bold: true, size: 32, font: { eastAsia: "SimHei", ascii: "Times New Roman" } })] }),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({ spacing: { before: 200 },
          children: [new TextRun({ text: "\u6ce8\uff1a\u672c\u76ee\u5f55\u7531\u57df\u4ee3\u7801\u751f\u6210\uff0c\u5982\u7f16\u8f91\u540e\u9875\u7801\u53d8\u52a8\uff0c\u8bf7\u53f3\u952e\u76ee\u5f55\u9009\u62e9\u201c\u66f4\u65b0\u57df\u201d\u5237\u65b0\u9875\u7801\u3002",
            italics: true, size: 18, color: "888888" })] }),
      ],
    },
    { // 正文（阿拉伯页码从 1）
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
  fs.writeFileSync("/home/z/my-project/download/AEmulator\u5347\u7ea7\u5b9e\u65bd\u62a5\u544a-Root\u7ba1\u7406\u4e0e\u6a21\u5757\u4f53\u7cfb.docx", buf);
  console.log("OK docx written");
});
