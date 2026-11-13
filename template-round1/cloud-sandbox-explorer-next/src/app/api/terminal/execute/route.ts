import { NextResponse } from 'next/server';
import { execPromise, recordAction } from '@/lib/explorer-server';

export const dynamic = 'force-dynamic';

const DANGEROUS_PATTERNS: { re: RegExp; why: string }[] = [
  { re: /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\s+[/~]/, why: '递归强删根/家目录' },
  { re: /:(){ :\|:& };:/, why: 'Fork 炸弹' },
  { re: /\bmkfs\b/, why: '格式化文件系统' },
  { re: /\bdd\s+if=/, why: '底层磁盘写入' },
  { re: /\bshutdown\b/, why: '关机指令' },
  { re: /\breboot\b/, why: '重启指令' },
  { re: /\binit\s+0\b/, why: '停机指令' },
  { re: /\bchmod\s+-R\s+777\s+\//, why: '全盘权限开放' },
];

export async function POST(request: Request) {
  let command = '';
  try {
    const body = await request.json();
    command = typeof body?.command === 'string' ? body.command : '';
  } catch {
    return NextResponse.json({ success: false, error: '请求体必须是 JSON 且包含 command 字段' }, { status: 400 });
  }

  const trimmed = command.trim();
  if (!trimmed) {
    return NextResponse.json({ success: false, error: 'Command is required' }, { status: 400 });
  }

  for (const pat of DANGEROUS_PATTERNS) {
    if (pat.re.test(trimmed)) {
      recordAction('fix', `拦截危险终端指令: ${trimmed.slice(0, 60)}`, `命中防护规则：${pat.why}`, 'system');
      return NextResponse.json(
        { success: false, error: `安全沙箱：已拦截危险指令（${pat.why}）。` },
        { status: 403 }
      );
    }
  }

  const startTime = Date.now();
  const { stdout, stderr, exitCode, killed } = await execPromise(trimmed, {
    timeout: 15000,
    maxBuffer: 1024 * 1024 * 2,
  });
  const durationMs = Date.now() - startTime;

  // 用户在网页终端执行的命令同样进入行动直播流（source=terminal）
  recordAction(
    'note',
    `$ ${trimmed.slice(0, 120)}`,
    `exit=${exitCode}${killed ? ' (timeout)' : ''} · ${durationMs}ms`,
    'terminal'
  );

  return NextResponse.json({
    success: true,
    command: trimmed,
    stdout,
    stderr,
    exitCode,
    killed,
    durationMs,
  });
}
