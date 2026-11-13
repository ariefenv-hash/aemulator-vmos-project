import { NextResponse } from 'next/server';
import os from 'os';
import { readActions } from '@/lib/agent-log';
import { recentWorkspaceFiles, readDevLogTail, hostFacts } from '@/lib/explorer-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actions = readActions(50);
  const recentFiles = recentWorkspaceFiles(45 * 60 * 1000, 14);
  const devLogTail = readDevLogTail(42);

  return NextResponse.json({
    success: true,
    serverTime: new Date().toISOString(),
    boot: {
      hostname: hostFacts().hostname,
      platform: `${os.type()} ${os.release()} ${os.arch()}`,
      processUptimeSec: Math.round(process.uptime()),
      pid: process.pid,
    },
    actions,
    recentFiles,
    devLogTail,
  });
}
