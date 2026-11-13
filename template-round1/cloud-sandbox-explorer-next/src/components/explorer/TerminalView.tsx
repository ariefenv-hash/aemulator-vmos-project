'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Trash2,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Play,
  Sparkles,
  CornerDownLeft,
  CloudLightning,
  Shield,
  Loader2,
} from 'lucide-react';
import { TerminalLine, TerminalTheme, RealSystemOverview } from './types';

interface TerminalViewProps {
  externalCommand?: string;
  className?: string;
}

const THEME_STYLES: Record<TerminalTheme, {
  bg: string;
  text: string;
  prompt: string;
  border: string;
  header: string;
  cursor: string;
  accent: string;
}> = {
  slate: {
    bg: 'bg-[#0b1120]',
    text: 'text-slate-200',
    prompt: 'text-sky-400',
    border: 'border-slate-800',
    header: 'bg-slate-900/90 text-slate-300',
    cursor: 'bg-sky-400',
    accent: 'text-sky-400',
  },
  matrix: {
    bg: 'bg-[#030d03]',
    text: 'text-emerald-400 font-mono',
    prompt: 'text-emerald-300 font-bold',
    border: 'border-emerald-950',
    header: 'bg-[#071907] text-emerald-300',
    cursor: 'bg-emerald-400',
    accent: 'text-emerald-400',
  },
  amber: {
    bg: 'bg-[#150f00]',
    text: 'text-amber-300 font-mono',
    prompt: 'text-amber-400 font-bold',
    border: 'border-amber-950',
    header: 'bg-[#221800] text-amber-300',
    cursor: 'bg-amber-400',
    accent: 'text-amber-400',
  },
  dracula: {
    bg: 'bg-[#181825]',
    text: 'text-[#cdd6f4]',
    prompt: 'text-[#cba6f7]',
    border: 'border-[#313244]',
    header: 'bg-[#11111b] text-[#cdd6f4]',
    cursor: 'bg-[#f5c2e7]',
    accent: 'text-[#89b4fa]',
  },
  classic: {
    bg: 'bg-black',
    text: 'text-gray-100 font-mono',
    prompt: 'text-green-400 font-bold',
    border: 'border-neutral-800',
    header: 'bg-neutral-900 text-neutral-300',
    cursor: 'bg-white',
    accent: 'text-green-400',
  },
};

const INITIAL_LINES: TerminalLine[] = [
  {
    id: 'init-1',
    type: 'system',
    content: '★ 真实云端 Linux 容器直连建立成功 (Z.ai Sandbox · 工作区 /home/z/my-project)',
    timestamp: 'Init',
  },
  {
    id: 'init-2',
    type: 'info',
    content: '所有执行的指令将直接在本沙箱容器中执行并返回真实标准输出 (stdout/stderr)，且会同步出现在「Agent 行动直播」时间线。',
    timestamp: 'Ready',
  },
  {
    id: 'init-3',
    type: 'output',
    content: '输入任意 Bash / Node / Python 命令测试。例如: uname -a, ps aux, python3 -c "print(2**32)"',
    timestamp: 'Tips',
  },
];

export const TerminalView: React.FC<TerminalViewProps> = ({ externalCommand, className = '' }) => {
  const [lines, setLines] = useState<TerminalLine[]>(INITIAL_LINES);
  const [inputVal, setInputVal] = useState('');
  const [theme, setTheme] = useState<TerminalTheme>('slate');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isCopied, setIsCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [useRealBackend, setUseRealBackend] = useState(true);
  const [hostLabel, setHostLabel] = useState('z@sandbox:~/my-project');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 拉取真实 user@host:cwd 组装提示符
    let cancelled = false;
    fetch('/api/system/full-overview')
      .then((r) => r.json())
      .then((data: RealSystemOverview) => {
        if (cancelled || !data?.success) return;
        const u = data.environment.user || 'z';
        const h = data.environment.hostname || 'sandbox';
        const cwd = data.environment.cwd || '/home/z/my-project';
        setHostLabel(`${u}@${h}:${cwd}`);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const runCommand = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    if (trimmed.toLowerCase() === 'clear') {
      setLines([]);
      return;
    }

    const timeStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const userLine: TerminalLine = {
      id: `cmd-${Date.now()}`,
      type: 'input',
      content: trimmed,
      timestamp: timeStr,
    };

    setHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);
    setLines((prev) => [...prev, userLine]);

    if (!useRealBackend) {
      setTimeout(() => {
        setLines((prev) => [
          ...prev,
          {
            id: `out-${Date.now()}`,
            type: 'output',
            content: `[离线模拟响应] $ ${trimmed}`,
            timestamp: timeStr,
          },
        ]);
      }, 50);
      return;
    }

    setIsExecuting(true);
    try {
      const res = await fetch('/api/terminal/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: trimmed }),
      });

      const data = await res.json();
      setIsExecuting(false);

      if (!res.ok || !data.success) {
        setLines((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            type: 'error',
            content: data.error || 'Execution failed on cloud container',
            timestamp: timeStr,
          },
        ]);
        return;
      }

      const newOutputs: TerminalLine[] = [];

      if (data.stdout) {
        newOutputs.push({
          id: `out-${Date.now()}`,
          type: 'output',
          content: data.stdout.trimEnd(),
          timestamp: `${data.durationMs}ms`,
          durationMs: data.durationMs,
        });
      }

      if (data.stderr) {
        newOutputs.push({
          id: `err-${Date.now()}`,
          type: 'error',
          content: data.stderr.trimEnd(),
          timestamp: `${data.durationMs}ms`,
          durationMs: data.durationMs,
        });
      }

      if (!data.stdout && !data.stderr) {
        newOutputs.push({
          id: `empty-${Date.now()}`,
          type: 'info',
          content: `(命令执行完成，无输出返回。退出码: ${data.exitCode}，耗时: ${data.durationMs}ms)`,
          timestamp: `${data.durationMs}ms`,
          durationMs: data.durationMs,
        });
      }

      setLines((prev) => [...prev, ...newOutputs]);
    } catch (err) {
      setIsExecuting(false);
      setLines((prev) => [
        ...prev,
        {
          id: `net-err-${Date.now()}`,
          type: 'error',
          content: `网络连接异常: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: timeStr,
        },
      ]);
    }
  };

  useEffect(() => {
    if (externalCommand) {
      runCommand(externalCommand);
    }
  }, [externalCommand]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (isExecuting) return;
      runCommand(inputVal);
      setInputVal('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIdx);
        setInputVal(history[nextIdx] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (history.length > 0 && historyIndex !== -1) {
        const nextIdx = historyIndex + 1;
        if (nextIdx >= history.length) {
          setHistoryIndex(-1);
          setInputVal('');
        } else {
          setHistoryIndex(nextIdx);
          setInputVal(history[nextIdx] || '');
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const suggestions = [
        'uname -a',
        'cat /etc/os-release',
        'node -v',
        'python3 --version',
        'ls -lah',
        'free -h',
        'df -h',
        'ps aux',
        'uptime',
        'whoami',
        'tail -n 5 agent-log.jsonl',
        'clear',
      ];
      const match = suggestions.find((s) => s.startsWith(inputVal.trim()));
      if (match) {
        setInputVal(match);
      }
    }
  };

  const copyTerminalContent = () => {
    const raw = lines.map((l) => (l.type === 'input' ? `$ ${l.content}` : l.content)).join('\n');
    navigator.clipboard.writeText(raw);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const currentTheme = THEME_STYLES[theme];

  return (
    <div
      className={`flex flex-col rounded-2xl overflow-hidden border shadow-2xl transition-all ${
        currentTheme.border
      } ${className} ${
        isExpanded ? 'fixed inset-4 z-50 shadow-2xl backdrop-blur-md' : 'h-[580px]'
      }`}
    >
      {/* Terminal Title Bar */}
      <div className={`px-4 py-2.5 flex items-center justify-between border-b ${currentTheme.border} ${currentTheme.header}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <div className="flex items-center gap-2 text-xs font-medium ml-2 min-w-0">
            <TerminalIcon className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="font-mono truncate hidden md:inline">{hostLabel} (bash)</span>
            <span className="font-mono truncate md:hidden">(bash)</span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 shrink-0">
              <CloudLightning className="w-3 h-3" />
              真实云端执行中
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setUseRealBackend(!useRealBackend)}
            className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border transition ${
              useRealBackend
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="点击切换真实云端执行 / 模拟模式"
          >
            <Shield className="w-3 h-3" />
            {useRealBackend ? '云端直连模式' : '模拟模式'}
          </button>

          <div className="hidden lg:flex items-center bg-black/40 rounded-lg p-0.5 border border-white/5">
            {(['slate', 'matrix', 'amber', 'dracula', 'classic'] as TerminalTheme[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-2 py-0.5 text-[11px] rounded transition capitalize font-mono ${
                  theme === t ? 'bg-white/20 text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t === 'slate' ? '极客蓝' : t === 'matrix' ? '黑客绿' : t === 'amber' ? '琥珀金' : t === 'dracula' ? '德古拉' : '纯黑'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setLines([])}
            className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition"
            title="清屏 (clear)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={copyTerminalContent}
            className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition"
            title="复制输出"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition"
            title={isExpanded ? '还原' : '全屏展开'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Quick Launch Buttons (Real Commands) */}
      <div className={`px-4 py-2 border-b ${currentTheme.border} bg-black/40 flex items-center gap-2 overflow-x-auto text-xs scrollbar-none`}>
        <span className="text-[11px] text-slate-400 whitespace-nowrap flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-sky-400" /> 真实云端指令速测:
        </span>
        {[
          { label: '内核探查', cmd: 'uname -a' },
          { label: '系统版本', cmd: 'cat /etc/os-release | head -n 5' },
          { label: 'CPU架构', cmd: 'lscpu | head -n 10 2>/dev/null || cat /proc/cpuinfo | grep -E "model name|cpu cores" | head -n 4' },
          { label: '内存状态', cmd: 'free -h 2>/dev/null || cat /proc/meminfo | head -n 4' },
          { label: '磁盘空间', cmd: 'df -h /' },
          { label: '实际进程', cmd: 'ps aux | head -n 8' },
          { label: 'Node版本', cmd: 'node -v && node -e "console.log(process.arch, process.platform)"' },
          { label: '行动日志', cmd: 'tail -n 3 agent-log.jsonl' },
          { label: '工作区文件', cmd: 'ls -lah' },
          { label: '网络状态', cmd: 'curl -sI https://www.cloudflare.com | head -n 4' },
        ].map((item) => (
          <button
            key={item.cmd}
            disabled={isExecuting}
            onClick={() => runCommand(item.cmd)}
            className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/5 font-mono text-[11px] whitespace-nowrap transition cursor-pointer flex items-center gap-1 disabled:opacity-40"
          >
            <Play className="w-2.5 h-2.5 text-sky-400" />
            {item.label}
          </button>
        ))}
      </div>

      {/* Terminal Output Area */}
      <div
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        className={`flex-1 p-4 overflow-y-auto font-mono text-sm ${currentTheme.bg} ${currentTheme.text} space-y-1.5 selection:bg-sky-500/30 selection:text-white`}
      >
        {lines.map((l) => (
          <div key={l.id} className="leading-relaxed break-words whitespace-pre-wrap">
            {l.type === 'input' && (
              <div className="flex items-center gap-2">
                <span className={`${currentTheme.prompt} select-none shrink-0`}>sandbox:~$</span>
                <span className="font-semibold text-white">{l.content}</span>
              </div>
            )}
            {l.type === 'system' && (
              <div className="text-slate-400/80 italic text-xs border-l-2 border-slate-700 pl-2 my-1">
                {l.content}
              </div>
            )}
            {l.type === 'info' && (
              <div className="text-sky-300/90 bg-sky-950/20 px-2 py-1 rounded border border-sky-800/30 text-xs">
                {l.content}
              </div>
            )}
            {l.type === 'output' && (
              <div className="opacity-95 pl-0.5">
                {l.content}
                {l.durationMs !== undefined && (
                  <span className="ml-2 text-[10px] text-slate-500 select-none">
                    [{l.durationMs}ms]
                  </span>
                )}
              </div>
            )}
            {l.type === 'error' && (
              <div className="text-rose-400 bg-rose-950/30 px-2.5 py-1.5 rounded border border-rose-900/40 text-xs">
                {l.content}
                {l.durationMs !== undefined && (
                  <span className="ml-2 text-[10px] text-rose-500/80 select-none">
                    [{l.durationMs}ms]
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {isExecuting && (
          <div className="flex items-center gap-2 text-sky-400 text-xs py-1 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>正在云端 Linux 容器执行命令...</span>
          </div>
        )}

        {/* Input prompt line */}
        <div className="flex items-center gap-2 pt-1">
          <span className={`${currentTheme.prompt} select-none font-bold shrink-0`}>sandbox:~$</span>
          <div className="flex-1 relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              disabled={isExecuting}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isExecuting ? '正在等待云端执行结果...' : '输入任意真实 Linux / Node / Python 命令...'}
              className="w-full bg-transparent outline-none border-none text-white font-mono text-inherit focus:ring-0 placeholder:text-slate-600 disabled:opacity-50"
              autoFocus
            />
          </div>
          <button
            onClick={() => {
              if (isExecuting) return;
              runCommand(inputVal);
              setInputVal('');
            }}
            disabled={!inputVal.trim() || isExecuting}
            className="p-1 rounded bg-white/10 hover:bg-white/20 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
            title="执行 (Enter)"
          >
            {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CornerDownLeft className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Terminal Footer Bar */}
      <div className={`px-4 py-2 border-t ${currentTheme.border} ${currentTheme.header} flex items-center justify-between text-xs`}>
        <div className="flex items-center gap-3 text-slate-400 text-[11px]">
          <span>按 <kbd className="px-1 py-0.5 rounded bg-white/10 text-slate-300">Tab</kbd> 自动补全</span>
          <span>按 <kbd className="px-1 py-0.5 rounded bg-white/10 text-slate-300">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-white/10 text-slate-300">↓</kbd> 历史指令</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
          <span>安全沙箱拦截危险破坏指令</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span className="text-emerald-400">云容器就绪</span>
        </div>
      </div>
    </div>
  );
};
