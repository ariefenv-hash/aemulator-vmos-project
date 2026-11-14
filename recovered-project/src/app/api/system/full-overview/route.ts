import { NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import { execPromise, hostFacts, WORKSPACE_ROOT } from '@/lib/explorer-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let osRelease = 'Unknown';
    try {
      osRelease = fs.readFileSync('/etc/os-release', 'utf8');
    } catch {
      /* 容器内通常存在 */
    }

    let memInfo = '';
    try {
      memInfo = fs.readFileSync('/proc/meminfo', 'utf8').split('\n').slice(0, 10).join('\n');
    } catch {
      /* ignore */
    }

    const [pythonVer, gitVer, diskUsage, unameOutput, bunVer] = await Promise.all([
      execPromise('python3 --version', { timeout: 4000 }),
      execPromise('git --version', { timeout: 4000 }),
      execPromise(`df -h ${WORKSPACE_ROOT} | tail -n 1`, { timeout: 4000 }),
      execPromise('uname -a', { timeout: 4000 }),
      execPromise('bun --version', { timeout: 4000 }),
    ]);

    const diskParts = diskUsage.stdout.trim().split(/\s+/);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      host: {
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        type: os.type(),
        arch: os.arch(),
        uptime: os.uptime(),
        loadavg: os.loadavg(),
        uname: unameOutput.stdout.trim() || unameOutput.stderr.trim() || 'N/A',
        osRelease,
      },
      hardware: {
        cpus: os.cpus().map((c) => ({ model: c.model, speed: c.speed })),
        totalMemBytes: os.totalmem(),
        freeMemBytes: os.freemem(),
        usedMemBytes: os.totalmem() - os.freemem(),
        memInfoSnippet: memInfo,
        disk: {
          filesystem: diskParts[0] || 'overlay',
          total: diskParts[1] || 'N/A',
          used: diskParts[2] || 'N/A',
          available: diskParts[3] || 'N/A',
          usePercent: diskParts[4] || 'N/A',
        },
      },
      runtimes: {
        node: process.version,
        python: pythonVer.stdout.trim() || pythonVer.stderr.trim() || 'N/A',
        git: gitVer.stdout.trim() || 'N/A',
        bun: bunVer.stdout.trim() ? `bun ${bunVer.stdout.trim()}` : 'N/A',
        v8: process.versions.v8,
        memoryUsage: process.memoryUsage(),
      },
      environment: {
        ...hostFacts(),
        nodeEnv: process.env.NODE_ENV || 'development',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
