import { execPromise } from '@/lib/explorer-server';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const ZIP_PATH = '/tmp/cloud-sandbox-explorer-next.zip';

export async function GET() {
  // 每次请求都重新生成，保证内容新鲜
  const { exitCode } = await execPromise('python3 scripts/make_explorer_zip.py', { timeout: 15000 });
  if (exitCode !== 0 || !fs.existsSync(ZIP_PATH)) {
    return new Response(JSON.stringify({ success: false, error: 'Failed to generate zip file' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ZIP 体积小（几十 KB），直接以 Buffer 返回，避免 Node 流 → Web 流转换的生命周期问题
  const buf = await fs.promises.readFile(ZIP_PATH);
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(buf.length),
      'Content-Disposition': 'attachment; filename="cloud-sandbox-explorer-next.zip"',
    },
  });
}
