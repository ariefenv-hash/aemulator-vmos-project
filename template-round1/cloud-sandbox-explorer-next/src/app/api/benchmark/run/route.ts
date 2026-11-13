import { NextResponse } from 'next/server';
import os from 'os';
import fs from 'fs';
import { execPromise, recordAction } from '@/lib/explorer-server';

export const dynamic = 'force-dynamic';

const PY_BENCH = `import time, math
t0 = time.time()
s = sum(math.sqrt(i) * math.sin(i) for i in range(1000000))
print(f"{time.time() - t0:.4f}")`;

export async function POST() {
  try {
    const startTime = Date.now();

    // Node.js (V8) 浮点 + 三角函数密集运算
    const nodeStart = Date.now();
    let sum = 0;
    for (let i = 0; i < 2_000_000; i++) {
      sum += Math.sqrt(i) * Math.sin(i);
    }
    const nodeDurationMs = Date.now() - nodeStart;
    if (!Number.isFinite(sum)) sum = 0; // 防 JIT 消除

    // Python 3 真实子进程基准（写临时文件规避 shell 引号问题）
    const pyFile = '/tmp/explorer_bench.py';
    fs.writeFileSync(pyFile, PY_BENCH, 'utf8');
    const pyRes = await execPromise(`python3 ${pyFile}`, { timeout: 20000 });
    const pyDuration = Math.round(parseFloat(pyRes.stdout.trim()) * 1000) || 0;

    const totalDurationMs = Date.now() - startTime;

    recordAction(
      'verify',
      '运行云端算力基准测试',
      `V8: ${nodeDurationMs}ms / 2M 次浮点三角运算 · Python3: ${pyDuration}ms / 1M 次迭代`
    );

    return NextResponse.json({
      success: true,
      cpuModel: os.cpus()[0]?.model || 'Cloud vCPU',
      coreCount: os.cpus().length,
      nodeBench: {
        operations: '2,000,000 Floating Point & Trig Ops',
        durationMs: nodeDurationMs,
        v8HeapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      pythonBench: {
        operations: '1,000,000 Math & Loop Iterations',
        durationMs: pyDuration,
      },
      totalDurationMs,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
