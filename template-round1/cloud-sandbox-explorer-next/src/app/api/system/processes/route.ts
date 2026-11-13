import { NextResponse } from 'next/server';
import { execPromise } from '@/lib/explorer-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { stdout, exitCode } = await execPromise(
    'ps -eo pid,user,%cpu,%mem,time,comm,args --sort=-%cpu | head -n 26',
    { timeout: 5000 }
  );
  if (exitCode !== 0) {
    return NextResponse.json({ success: false, error: 'ps 执行失败' }, { status: 500 });
  }
  const rawLines = stdout.trim().split('\n');
  const processes = rawLines.slice(1).map((line) => {
    const parts = line.trim().split(/\s+/);
    return {
      pid: parts[0] ?? '?',
      user: parts[1] ?? '?',
      cpu: (parts[2] ?? '0') + '%',
      mem: (parts[3] ?? '0') + '%',
      time: parts[4] ?? '-',
      command: parts[5] ?? '?',
      fullArgs: parts.slice(6).join(' '),
    };
  });
  return NextResponse.json({ success: true, count: processes.length, processes });
}
