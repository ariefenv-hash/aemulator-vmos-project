import { NextResponse } from 'next/server';
import { execPromise } from '@/lib/explorer-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { stdout, exitCode, stderr } = await execPromise('python3 scripts/make_explorer_zip.py', {
    timeout: 15000,
  });
  if (exitCode !== 0) {
    return NextResponse.json(
      { success: false, error: stderr.trim() || '打包脚本执行失败' },
      { status: 500 }
    );
  }
  try {
    const info = JSON.parse(stdout.trim());
    return NextResponse.json({ success: true, ...info });
  } catch {
    return NextResponse.json({ success: false, error: '打包摘要解析失败' }, { status: 500 });
  }
}
