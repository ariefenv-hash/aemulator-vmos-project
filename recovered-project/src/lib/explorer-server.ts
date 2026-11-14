/**
 * explorer-server.ts — Cloud Sandbox Explorer 服务端共享工具
 * 适配本沙箱：工作区根目录为 /home/z/my-project（Next.js dev 进程 cwd）。
 */
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logAction } from './agent-log';

export const WORKSPACE_ROOT = '/home/z/my-project';

export const EXCLUDED_TOP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  'tool-results',
  '.zscripts',
  'drafts-r39',
]);

/** 执行 shell 命令并返回 stdout/stderr/exitCode */
export function execPromise(
  cmd: string,
  opts: { timeout?: number; maxBuffer?: number; cwd?: string } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number; killed: boolean }> {
  const { timeout = 8000, maxBuffer = 1024 * 1024 * 2, cwd = WORKSPACE_ROOT } = opts;
  return new Promise((resolve) => {
    exec(cmd, { timeout, maxBuffer, cwd }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: error ? (error as NodeJS.ErrnoException & { code?: number }).code || 1 : 0,
        killed: error ? (error as { killed?: boolean }).killed || false : false,
      });
    });
  });
}

/** 校验用户给定路径必须位于工作区内（防目录穿越） */
export function resolveSafeWorkspacePath(userPath: string): string | null {
  if (!userPath || typeof userPath !== 'string') return null;
  const cleaned = userPath.replace(/\0/g, '');
  const abs = path.isAbsolute(cleaned) ? path.normalize(cleaned) : path.join(WORKSPACE_ROOT, cleaned);
  const resolved = path.resolve(abs);
  const rootResolved = path.resolve(WORKSPACE_ROOT);
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) return null;
  return resolved;
}

/** 追加一条 Agent/终端 行动记录（转发到 JSONL 通道） */
export function recordAction(category: string, title: string, detail = '', source = 'agent') {
  logAction({ category, title, detail, source });
}

/** 读取最近改动的工作区文件（基于 mtime，自动排除噪音目录） */
export function recentWorkspaceFiles(
  withinMs = 45 * 60 * 1000,
  limit = 14
): { path: string; name: string; size: number; mtime: string; relativeSec: number }[] {
  const cutoff = Date.now() - withinMs;
  const found: { path: string; name: string; size: number; mtimeMs: number }[] = [];

  const walk = (dir: string, depth: number) => {
    if (depth > 4) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name.endsWith('.log') && ent.name !== 'dev.log') continue;
      const full = path.join(dir, ent.name);
      let st: fs.Stats;
      try {
        st = fs.statSync(full);
      } catch {
        continue;
      }
      if (ent.isDirectory()) {
        if (EXCLUDED_TOP_DIRS.has(ent.name)) continue;
        if (ent.name === 'e2e-shots' || ent.name === 'assets' || ent.name === 'vendor') continue;
        walk(full, depth + 1);
      } else if (ent.isFile()) {
        if (st.mtimeMs >= cutoff) {
          found.push({
            path: path.relative(WORKSPACE_ROOT, full),
            name: ent.name,
            size: st.size,
            mtimeMs: st.mtimeMs,
          });
        }
      }
    }
  };

  walk(WORKSPACE_ROOT, 0);
  found.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return found.slice(0, limit).map((f) => ({
    path: f.path,
    name: f.name,
    size: f.size,
    mtime: new Date(f.mtimeMs).toISOString(),
    relativeSec: Math.max(1, Math.round((Date.now() - f.mtimeMs) / 1000)),
  }));
}

/** 读取 dev server 日志尾部 */
export function readDevLogTail(lines = 40): string {
  const candidates = [path.join(WORKSPACE_ROOT, 'dev.log')];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        return raw.split('\n').slice(-lines).join('\n').trimEnd();
      }
    } catch {
      // ignore
    }
  }
  return '(dev.log 暂不可读)';
}

/** 主机真实信息摘要（供前端文案动态渲染） */
export function hostFacts() {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    user: ((): string => {
      try {
        return os.userInfo().username;
      } catch {
        return process.env.USER || 'z';
      }
    })(),
    cwd: WORKSPACE_ROOT,
  };
}
