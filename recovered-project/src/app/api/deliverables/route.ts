import { readdir, stat } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const DOWNLOAD_DIR = '/home/z/my-project/download';

export async function GET() {
  try {
    const names = await readdir(DOWNLOAD_DIR);
    const files = await Promise.all(
      names
        .filter((n) => !n.startsWith('.'))
        .map(async (n) => {
          const p = join(DOWNLOAD_DIR, n);
          try {
            const s = await stat(p);
            return {
              name: n,
              size: s.size,
              isDir: s.isDirectory(),
              mtime: s.mtimeMs,
            };
          } catch {
            return null;
          }
        })
    );
    const list = files
      .filter((f): f is { name: string; size: number; isDir: boolean; mtime: number } => f !== null)
      .filter((f) => !f.isDir)
      .sort((a, b) => b.mtime - a.mtime);
    return new Response(JSON.stringify({ success: true, files: list }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e), files: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
