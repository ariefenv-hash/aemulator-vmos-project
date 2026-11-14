/**
 * /api/upload — 大文件流式上传（支持 2GB 及以上）
 *
 * POST /api/upload?name=<filename>&append=1
 *   - 以流方式把请求体直接写盘，全程不整块缓存进内存
 *   - append=1 时以追加模式写入（配合客户端分块/断点续传）
 *   - 文件落在 /home/z/my-project/uploads/
 *
 * GET /api/upload
 *   - 列出已上传文件（名称、大小、修改时间）
 */
import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import fs from 'fs';
import path from 'path';
import { recordAction } from '@/lib/explorer-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 3600;

export const UPLOAD_DIR = '/home/z/my-project/uploads';
/** 单文件上限 2 GiB */
export const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;

function sanitizeFilename(raw: string): string | null {
  if (!raw) return null;
  // 只保留文件名部分，去掉任何路径成分
  const base = path.basename(raw.replace(/\\/g, '/'));
  if (!base || base === '.' || base === '..') return null;
  // 过滤控制字符
  const cleaned = base.replace(/[\0-\x1f\x7f]/g, '_').slice(0, 180);
  return cleaned || null;
}

function listUploads() {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const entries = fs.readdirSync(UPLOAD_DIR, { withFileTypes: true });
    const files = [];
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      const full = path.join(UPLOAD_DIR, ent.name);
      try {
        const st = fs.statSync(full);
        files.push({
          name: ent.name,
          size: st.size,
          mtime: st.mtime.toISOString(),
          // 预判文件类型
          kind: /\.(apk|xapk|apks|apkm)$/i.test(ent.name)
            ? 'apk'
            : /\.(zip|jar|tgz|tar|gz|7z|rar)$/i.test(ent.name)
              ? 'archive'
              : /\.(img|dat|br)$/i.test(ent.name)
                ? 'image'
                : 'other',
        });
      } catch {
        // ignore
      }
    }
    files.sort((a, b) => b.mtime.localeCompare(a.mtime));
    return files;
  } catch {
    return [];
  }
}

export async function GET() {
  const files = listUploads();
  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  return NextResponse.json({
    success: true,
    dir: UPLOAD_DIR,
    maxFileBytes: MAX_FILE_BYTES,
    totalBytes,
    count: files.length,
    files,
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const name = sanitizeFilename(url.searchParams.get('name') || '');
  const append = url.searchParams.get('append') === '1';

  if (!name) {
    return NextResponse.json({ success: false, error: '缺少合法的 name 查询参数' }, { status: 400 });
  }
  if (!request.body) {
    return NextResponse.json({ success: false, error: '请求体为空（需要流式 body）' }, { status: 400 });
  }

  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const target = path.join(UPLOAD_DIR, name);
    const existingSize = fs.existsSync(target) ? fs.statSync(target).size : 0;
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 0 && (append ? existingSize + contentLength : contentLength) > MAX_FILE_BYTES) {
      return NextResponse.json(
        { success: false, error: `超过单文件上限 ${(MAX_FILE_BYTES / 1024 / 1024 / 1024).toFixed(0)} GiB` },
        { status: 413 }
      );
    }

    const startedAt = Date.now();
    const nodeStream = Readable.fromWeb(request.body as Parameters<typeof Readable.fromWeb>[0]);
    await pipeline(
      nodeStream,
      fs.createWriteStream(target, { flags: append ? 'a' : 'w', highWaterMark: 4 * 1024 * 1024 })
    );
    const finalSize = fs.statSync(target).size;
    const durationMs = Date.now() - startedAt;

    recordAction(
      append ? 'build' : 'deliver',
      `${append ? '续传' : '上传'}文件: ${name}`,
      `size=${(finalSize / 1024 / 1024).toFixed(1)}MB · 耗时 ${(durationMs / 1000).toFixed(1)}s · 落盘 ${UPLOAD_DIR}`,
      'system'
    );

    return NextResponse.json({
      success: true,
      name,
      path: target,
      size: finalSize,
      appended: append,
      previousSize: existingSize,
      durationMs,
      speedMBps: durationMs > 0 ? Number(((finalSize - (append ? existingSize : 0)) / 1024 / 1024 / (durationMs / 1000)).toFixed(2)) : 0,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/** DELETE /api/upload?name=xxx — 删除已上传文件 */
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const name = sanitizeFilename(url.searchParams.get('name') || '');
  if (!name) {
    return NextResponse.json({ success: false, error: '缺少合法的 name 查询参数' }, { status: 400 });
  }
  const target = path.join(UPLOAD_DIR, name);
  try {
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
      recordAction('fix', `删除上传文件: ${name}`, target, 'system');
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: '文件不存在' }, { status: 404 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
