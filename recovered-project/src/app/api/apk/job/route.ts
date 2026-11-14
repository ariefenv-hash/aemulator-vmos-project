/**
 * /api/apk/job — APK 反编译后台作业
 *
 * POST { action, file, outName?, extra? }
 *   action: 'jadx' | 'apktool' | 'unzip-list' | 'manifest' | 'custom'
 *   → 在沙箱内以分离进程启动反编译作业（几十分钟也不会被 HTTP 超时打断），
 *     日志实时写入 apk-jobs/<jobId>.log
 *
 * GET              → 列出全部作业
 * GET ?id=<jobId>  → 单个作业详情（含日志尾部 + 运行中判断）
 * DELETE ?id=<jobId> → 删除作业记录与产物
 */
import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { execPromise, resolveSafeWorkspacePath, recordAction, WORKSPACE_ROOT } from '@/lib/explorer-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const JOBS_DIR = '/home/z/my-project/apk-jobs';
const UPLOADS_DIR = '/home/z/my-project/uploads';
const DECOMPILE_DIR = '/home/z/my-project/decompiled';
const RUNNER = '/home/z/my-project/scripts/apk-job-runner.sh';

type JobMeta = {
  id: string;
  action: string;
  file: string;
  cmd: string;
  outDir?: string;
  status: 'running' | 'done' | 'failed';
  pid?: number;
  startedAt?: number;
  finishedAt?: number;
  exitCode?: number;
  durationSec?: number;
};

function ensureDirs() {
  fs.mkdirSync(JOBS_DIR, { recursive: true });
  fs.mkdirSync(DECOMPILE_DIR, { recursive: true });
}

function readMeta(jobId: string): JobMeta | null {
  try {
    const raw = fs.readFileSync(path.join(JOBS_DIR, `${jobId}.json`), 'utf8');
    return JSON.parse(raw) as JobMeta;
  } catch {
    return null;
  }
}

function writeMeta(meta: JobMeta) {
  const p = path.join(JOBS_DIR, `${meta.id}.json`);
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(meta, null, 2), 'utf8');
  fs.renameSync(tmp, p);
}

function listJobs(): JobMeta[] {
  ensureDirs();
  const out: JobMeta[] = [];
  for (const f of fs.readdirSync(JOBS_DIR)) {
    if (!f.endsWith('.json')) continue;
    const m = readMeta(f.replace(/\.json$/, ''));
    if (m) out.push(m);
  }
  out.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
  return out;
}

/** 检查进程是否仍存活 */
async function isAlive(pid?: number): Promise<boolean> {
  if (!pid) return false;
  const { exitCode } = await execPromise(`kill -0 ${pid} 2>/dev/null && echo alive`, { timeout: 3000 });
  return exitCode === 0;
}

function buildCommand(action: string, file: string, outName: string, extra: string): { cmd: string[]; outDir: string } {
  const JADX = 'tools/jadx/bin/jadx';
  const base = path.basename(file);
  switch (action) {
    case 'jadx': {
      const outDir = path.join(DECOMPILE_DIR, outName || `jadx-${base.replace(/\.apk$/i, '')}`);
      return { cmd: [JADX, ...extra.split(' ').filter(Boolean), '-d', outDir, file], outDir };
    }
    case 'apktool': {
      const outDir = path.join(DECOMPILE_DIR, outName || `apktool-${base.replace(/\.apk$/i, '')}`);
      return { cmd: ['java', '-jar', 'tools/apktool.jar', 'd', ...(extra ? extra.split(' ').filter(Boolean) : ['-f']), '-o', outDir, file], outDir };
    }
    case 'unzip-list': {
      return { cmd: ['unzip', '-l', file], outDir: '' };
    }
    case 'manifest': {
      const outDir = path.join(DECOMPILE_DIR, `apktool-${base.replace(/\.apk$/i, '')}`);
      return { cmd: ['java', '-jar', 'tools/apktool.jar', 'd', '--no-res', '--no-src', '-f', '-o', outDir, file], outDir };
    }
    default: {
      return { cmd: ['bash', '-c', extra || 'echo "no command"'], outDir: '' };
    }
  }
}

export async function GET(request: Request) {
  ensureDirs();
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    const jobs = listJobs();
    // 顺手校正 running 状态（服务器重启后 pid 可能已消失）
    for (const j of jobs) {
      if (j.status === 'running' && j.pid && !(await isAlive(j.pid))) {
        j.status = 'failed';
        j.exitCode = -1;
        writeMeta(j);
      }
    }
    return NextResponse.json({ success: true, jobs, decompileDir: DECOMPILE_DIR });
  }

  const meta = readMeta(id);
  if (!meta) {
    return NextResponse.json({ success: false, error: '作业不存在' }, { status: 404 });
  }
  if (meta.status === 'running' && meta.pid && !(await isAlive(meta.pid))) {
    meta.status = 'failed';
    meta.exitCode = -1;
    writeMeta(meta);
  }

  let logTail = '';
  let logSize = 0;
  try {
    const logPath = path.join(JOBS_DIR, `${id}.log`);
    const st = fs.statSync(logPath);
    logSize = st.size;
    const fd = fs.openSync(logPath, 'r');
    const readLen = Math.min(st.size, 64 * 1024);
    const buf = Buffer.alloc(readLen);
    fs.readSync(fd, buf, 0, readLen, st.size - readLen);
    fs.closeSync(fd);
    logTail = buf.toString('utf8');
    if (st.size > readLen) logTail = `…（仅显示日志尾部）\n` + logTail;
  } catch {
    logTail = '(暂无日志输出)';
  }

  // 产物统计
  let outFiles: { name: string; size: number }[] = [];
  if (meta.outDir && fs.existsSync(meta.outDir)) {
    const walk = (dir: string, depth: number) => {
      if (depth > 3) return;
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        try {
          if (ent.isDirectory()) walk(full, depth + 1);
          else {
            const st = fs.statSync(full);
            outFiles.push({ name: path.relative(meta.outDir!, full), size: st.size });
          }
        } catch {
          // ignore
        }
      }
    };
    walk(meta.outDir, 0);
    outFiles = outFiles.slice(0, 100);
  }

  return NextResponse.json({
    success: true,
    job: meta,
    logTail,
    logSize,
    alive: meta.status === 'running',
    outDir: meta.outDir,
    outFiles,
  });
}

export async function POST(request: Request) {
  ensureDirs();
  let body: { action?: string; file?: string; outName?: string; extra?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: '请求体必须是 JSON' }, { status: 400 });
  }

  const action = body.action || '';
  const relFile = body.file || '';
  const extra = typeof body.extra === 'string' ? body.extra.slice(0, 500) : '';
  const allowed = new Set(['jadx', 'apktool', 'unzip-list', 'manifest', 'custom']);

  if (!allowed.has(action)) {
    return NextResponse.json({ success: false, error: `不支持的 action: ${action}` }, { status: 400 });
  }
  if (action !== 'custom') {
    // 兼容裸文件名：只传文件名时自动到 uploads/ 下解析
    let relFileResolved = relFile;
    if (relFile && !relFile.includes('/') && !fs.existsSync(path.join(WORKSPACE_ROOT, relFile))) {
      const candidate = path.posix.join('uploads', relFile);
      if (fs.existsSync(path.join(WORKSPACE_ROOT, candidate))) relFileResolved = candidate;
    }
    const resolved = resolveSafeWorkspacePath(relFileResolved);
    if (!resolved || !fs.existsSync(resolved)) {
      return NextResponse.json({ success: false, error: `文件不存在或越界: ${relFile}` }, { status: 400 });
    }
    if (!resolved.startsWith(UPLOADS_DIR) && !resolved.startsWith(DECOMPILE_DIR)) {
      return NextResponse.json(
        { success: false, error: '仅允许对 uploads/ 或 decompiled/ 内的文件操作' },
        { status: 403 }
      );
    }
  }

  // custom 命令安全防护（与终端一致）
  if (action === 'custom') {
    const dangerous = [/rm\s+-rf\s+[/~]/, /mkfs/, /dd\s+if=/, /shutdown/, /reboot/, /:(){ :\|:& };:/];
    for (const re of dangerous) {
      if (re.test(extra)) {
        return NextResponse.json({ success: false, error: '安全沙箱：命令被拦截' }, { status: 403 });
      }
    }
  }

  const jobId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const target = action === 'custom' ? '' : resolveSafeWorkspacePath(relFile)!;
  const { cmd, outDir } =
    action === 'custom'
      ? { cmd: ['bash', '-c', extra], outDir: '' }
      : buildCommand(action, target!, body.outName || '', extra);

  const meta: JobMeta = {
    id: jobId,
    action,
    file: target ? path.relative('/home/z/my-project', target) : '(custom)',
    cmd: cmd.join(' ').slice(0, 500),
    outDir,
    status: 'running',
    startedAt: Date.now(),
  };
  writeMeta(meta);

  // 分离进程启动：脱离 HTTP 请求生命周期，日志与退出码落盘
  const child = spawn('bash', [RUNNER, jobId, path.join(JOBS_DIR, `${jobId}.json`), path.join(JOBS_DIR, `${jobId}.exit`), path.join(JOBS_DIR, `${jobId}.log`), ...cmd], {
    cwd: '/home/z/my-project',
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  meta.pid = child.pid;
  writeMeta(meta);

  recordAction('build', `启动反编译作业 ${jobId}`, `${action}: ${meta.cmd}`, 'agent');

  return NextResponse.json({ success: true, jobId, pid: child.pid, cmd: meta.cmd });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: '缺少 id' }, { status: 400 });
  const meta = readMeta(id);
  if (!meta) return NextResponse.json({ success: false, error: '作业不存在' }, { status: 404 });

  if (meta.status === 'running' && meta.pid) {
    await execPromise(`kill -TERM -${meta.pid} 2>/dev/null; kill -TERM ${meta.pid} 2>/dev/null`, { timeout: 4000 });
  }
  for (const suffix of ['.json', '.log', '.exit']) {
    try {
      fs.unlinkSync(path.join(JOBS_DIR, `${id}${suffix}`));
    } catch {
      // ignore
    }
  }
  recordAction('fix', `终止/删除反编译作业 ${id}`, meta.cmd, 'system');
  return NextResponse.json({ success: true });
}
