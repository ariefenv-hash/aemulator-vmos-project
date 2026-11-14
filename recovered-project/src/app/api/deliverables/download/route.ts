import { NextRequest } from 'next/server';
import { createReadStream, existsSync, statSync } from 'fs';
import { join, resolve, basename } from 'path';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';

const DOWNLOAD_DIR = resolve('/home/z/my-project/download');

const MIME: Record<string, string> = {
  '.apk': 'application/vnd.android.package-archive',
  '.zip': 'application/zip',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.patch': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.img': 'application/octet-stream',
  '.json': 'application/json',
};

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name') ?? '';
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) {
    return new Response(JSON.stringify({ success: false, error: 'bad name' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const path = join(DOWNLOAD_DIR, basename(name));
  if (!existsSync(path) || !statSync(path).isFile()) {
    return new Response(JSON.stringify({ success: false, error: 'not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const stat = statSync(path);
  const base = basename(name);
  const dot = base.lastIndexOf('.');
  const ext = dot >= 0 ? base.slice(dot).toLowerCase() : '';
  const nodeStream = createReadStream(path);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;
  const asciiName = base.replace(/[^\x20-\x7E]/g, '_');
  const encodedName = encodeURIComponent(base);
  return new Response(webStream, {
    headers: {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Content-Length': String(stat.size),
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
      'Cache-Control': 'no-store',
    },
  });
}
