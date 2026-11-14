/**
 * /api/apk/tools — 检测沙箱内可用的反编译工具链
 */
import { NextResponse } from 'next/server';
import { execPromise } from '@/lib/explorer-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOOL_DEFS: { id: string; name: string; versionCmd: string; home: string }[] = [
  { id: 'jadx', name: 'jadx（APK → Java 源码）', versionCmd: 'tools/jadx/bin/jadx --version', home: 'tools/jadx' },
  { id: 'apktool', name: 'apktool（资源/清单解包）', versionCmd: 'java -jar tools/apktool.jar --version', home: 'tools/apktool.jar' },
  { id: 'java', name: 'Java 运行时', versionCmd: 'java -version', home: '/usr/bin/java' },
  { id: 'unzip', name: 'unzip（直读 ZIP 结构）', versionCmd: 'unzip -v | head -1', home: '/usr/bin/unzip' },
  { id: 'aapt', name: 'aapt（Android 资产工具）', versionCmd: 'which aapt', home: '/usr/bin/aapt' },
];

export async function GET() {
  const tools = [];
  for (const t of TOOL_DEFS) {
    const { stdout, stderr, exitCode } = await execPromise(t.versionCmd, { timeout: 6000 });
    const raw = (stdout || stderr).trim().split('\n')[0] || '';
    tools.push({
      id: t.id,
      name: t.name,
      home: t.home,
      available: t.id === 'java' ? /version "(.+?)"/.test(stdout + stderr) : exitCode === 0,
      version:
        t.id === 'java'
          ? (stdout + stderr).match(/version "(.+?)"/)?.[1] || ''
          : raw.replace(/^jadx v?/i, '').trim(),
    });
  }

  // 磁盘余量（反编译大 APK 很占空间）
  const { stdout: dfOut } = await execPromise("df -h /home/z/my-project | tail -1 | awk '{print $4}'", {
    timeout: 4000,
  });

  return NextResponse.json({
    success: true,
    tools,
    diskFree: dfOut.trim() || '未知',
    uploadDir: '/home/z/my-project/uploads',
    decompileOutDir: '/home/z/my-project/decompiled',
  });
}
