import { NextResponse } from 'next/server';
import fs from 'fs';
import { resolveSafeWorkspacePath } from '@/lib/explorer-server';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 200 * 1024; // 200KB 预览上限
const TEXT_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.scss', '.html',
  '.md', '.txt', '.py', '.sh', '.yml', '.yaml', '.toml', '.prisma', '.env',
  '.gitignore', '.log', '.xml', '.svg', '.csv', '.caddyfile', '.mjs.txt',
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rel = searchParams.get('path') || '';
  const abs = resolveSafeWorkspacePath(rel);
  if (!abs) {
    return NextResponse.json({ success: false, error: '路径越界：仅允许访问工作区内文件' }, { status: 403 });
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(abs);
  } catch {
    return NextResponse.json({ success: false, error: '文件不存在或不可访问' }, { status: 404 });
  }
  if (stat.isDirectory()) {
    return NextResponse.json({ success: false, error: '目标是目录，请选择文件' }, { status: 400 });
  }

  const ext = (abs.match(/\.[^.]+$/) || [''])[0].toLowerCase();
  const looksText = TEXT_EXTS.has(ext) || ext === '';
  if (!looksText) {
    // 宽松二进制嗅探：读前 2KB 查 NUL
    let head: Buffer;
    try {
      const fd = fs.openSync(abs, 'r');
      const buf = Buffer.alloc(Math.min(2048, stat.size));
      fs.readSync(fd, buf, 0, buf.length, 0);
      fs.closeSync(fd);
      head = buf;
    } catch {
      return NextResponse.json({ success: false, error: '文件不可读' }, { status: 500 });
    }
    if (head.includes(0)) {
      return NextResponse.json(
        { success: false, error: `二进制文件（${ext || '未知类型'}）不支持内联预览，可在终端用 xxd/file 查看` },
        { status: 415 }
      );
    }
  }

  try {
    const size = stat.size;
    const truncated = size > MAX_BYTES;
    const content = truncated
      ? fs.readFileSync(abs, 'utf8').slice(0, MAX_BYTES)
      : fs.readFileSync(abs, 'utf8');
    return NextResponse.json({
      success: true,
      path: rel,
      name: abs.split('/').pop(),
      size,
      truncated,
      mtime: stat.mtime.toISOString(),
      content,
      lines: content.split('\n').length,
    });
  } catch {
    return NextResponse.json({ success: false, error: '读取失败（可能为非 UTF-8 文本）' }, { status: 500 });
  }
}
