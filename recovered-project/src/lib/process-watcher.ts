/**
 * process-watcher.ts — 沙箱指令自动捕捉器
 *
 * 嵌入 Next.js dev server（经 instrumentation.ts 随平台自动启动），
 * 每秒轮询 ps，捕捉沙箱内新出现的用户进程（Agent 通过 Bash 工具执行的
 * 命令、用户在网页终端跑的命令、curl/编译/反编译等），写入 agent-log.jsonl，
 * 前端「Agent 行动直播」页签即可实时看到 Agent 在干什么。
 */
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

const WORKSPACE = '/home/z/my-project';
const LOG_PATH = path.join(WORKSPACE, 'agent-log.jsonl');
const POLL_INTERVAL_MS = 1000;
const MAX_ENTRIES_PER_TICK = 12;

/** 已登记的 PID 集合（globalThis 保证 dev 热更新后仍是同一份） */
const g = globalThis as unknown as {
  __pw_seen?: Map<number, number>; // pid -> firstSeenMs
  __pw_timer?: NodeJS.Timeout;
  __pw_bootLogged?: boolean;
};

function appendLog(entry: Record<string, unknown>) {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // 日志失败不影响主流程
  }
}

/** 噪音正则：dev server 自身链路、监视器自身、Bash 工具的壳进程，不算"指令" */
const NOISE_PATTERNS: RegExp[] = [
  /next dev/,
  /next-server/,
  /turbopack/,
  /bun run dev/,
  /tee dev\.log/,
  /node .*zscripts/,
  /dev\.sh/,
  /caddy run/,
  /ps -eo /,
  /sh -c ps /,
  /\[kworker|\[ksoftirqd|\[rcu_|\[migration|\[idle/,
  // Bash 工具每次调用的壳层（su z -c / bash --noprofile --norc）
  /--noprofile --norc/,
  /^su z -c/,
  /^\/?bin\/bash --noprofile/,
];

/** 进程命令行去壳：bash -c "xxx" → xxx */
function unwrapShell(args: string): string {
  const m = args.match(/^(?:\/bin\/)?(?:ba)?sh -c ["']([\s\S]+)["']$/);
  if (m) return m[1];
  const m2 = args.match(/^(?:\/bin\/)?(?:ba)?sh -c (.+)$/);
  if (m2) return m2[1];
  return args;
}

function isNoise(args: string): boolean {
  return NOISE_PATTERNS.some((re) => re.test(args));
}

function pollOnce() {
  execFile(
    'ps',
    ['-eo', 'pid,ppid,user,etime,args', '--no-headers'],
    { timeout: 4000, maxBuffer: 1024 * 1024 },
    (err, stdout) => {
      if (err || !stdout) return;
      const now = Date.now();
      const seen = g.__pw_seen || new Map<number, number>();
      const currentPids = new Set<number>();
      const fresh: { pid: number; args: string; user: string; etime: string }[] = [];

      for (const line of stdout.split('\n')) {
        const t = line.trim();
        if (!t) continue;
        const parts = t.split(/\s+/);
        if (parts.length < 5) continue;
        const pid = Number(parts[0]);
        const user = parts[2];
        const etime = parts[3];
        const args = parts.slice(4).join(' ');
        if (!Number.isFinite(pid) || pid <= 1) continue;
        currentPids.add(pid);

        if (!seen.has(pid)) {
          seen.set(pid, now);
          const unwrapped = unwrapShell(args);
          if (!isNoise(args) && !isNoise(unwrapped)) {
            fresh.push({ pid, args: unwrapped, user, etime });
          }
        }
      }

      // 清理已消失进程，防止 Map 无限膨胀
      if (seen.size > 4000) {
        for (const pid of Array.from(seen.keys())) {
          if (!currentPids.has(pid)) seen.delete(pid);
        }
      }

      if (fresh.length > 0) {
        // 一秒内爆发式 fork 的子进程只保留前几条，避免刷屏
        const picked = fresh.slice(0, MAX_ENTRIES_PER_TICK);
        for (const p of picked) {
          appendLog({
            ts: new Date().toISOString(),
            source: 'agent',
            category: 'probe',
            title: `$ ${p.args.slice(0, 150)}`,
            detail: `pid=${p.pid} · user=${p.user} · elapsed=${p.etime}${fresh.length > MAX_ENTRIES_PER_TICK ? ` · (本轮另有 ${fresh.length - MAX_ENTRIES_PER_TICK} 个子进程略)` : ''}`,
          });
        }
      }
    }
  );
}

export function startProcessWatcher() {
  if (g.__pw_timer) return; // 已启动（dev 热更新防重复）
  g.__pw_seen = new Map();
  g.__pw_timer = setInterval(pollOnce, POLL_INTERVAL_MS);
  // 不阻止进程退出
  if (g.__pw_timer && typeof g.__pw_timer.unref === 'function') g.__pw_timer.unref();

  if (!g.__pw_bootLogged) {
    g.__pw_bootLogged = true;
    appendLog({
      ts: new Date().toISOString(),
      source: 'system',
      category: 'verify',
      title: '指令自动捕捉器已上线',
      detail: `process-watcher 随 Next.js 启动 (pid=${process.pid})，每 ${POLL_INTERVAL_MS}ms 轮询 ps，沙箱内新进程将实时进入本直播流`,
    });
  }
}
