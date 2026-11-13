'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  TerminalSquare,
  Server,
  RefreshCw,
  Search,
  FilePlus2,
  ScrollText,
  Radio,
  Clock,
  Radar,
} from 'lucide-react';
import { AgentActivity, AgentAction, AgentActionCategory } from './types';

interface AgentLiveFeedProps {
  onSendToTerminal: (cmd: string) => void;
}

const CATEGORY_STYLE: Record<AgentActionCategory, { label: string; chip: string; dot: string }> = {
  probe: { label: '探查', chip: 'bg-sky-500/15 text-sky-300 border-sky-500/30', dot: 'bg-sky-400' },
  build: { label: '构建', chip: 'bg-violet-500/15 text-violet-300 border-violet-500/30', dot: 'bg-violet-400' },
  fix: { label: '修复', chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30', dot: 'bg-amber-400' },
  verify: { label: '验证', chip: 'bg-teal-500/15 text-teal-300 border-teal-500/30', dot: 'bg-teal-400' },
  deliver: { label: '交付', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400' },
  note: { label: '动态', chip: 'bg-slate-500/15 text-slate-300 border-slate-500/30', dot: 'bg-slate-400' },
};

const SOURCE_META = {
  agent: { label: 'Agent', icon: Bot, chip: 'bg-teal-500/10 text-teal-300 border-teal-500/25' },
  terminal: { label: '你的终端', icon: TerminalSquare, chip: 'bg-rose-500/10 text-rose-300 border-rose-500/25' },
  system: { label: '系统', icon: Server, chip: 'bg-slate-500/10 text-slate-300 border-slate-500/25' },
} as const;

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false });
  } catch {
    return ts;
  }
}

function formatRelative(sec: number): string {
  if (sec < 60) return `${sec} 秒前`;
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`;
  return `${Math.floor(sec / 3600)} 小时前`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const AgentLiveFeed: React.FC<AgentLiveFeedProps> = ({ onSendToTerminal }) => {
  const [data, setData] = useState<AgentActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState<'all' | 'agent' | 'terminal'>('all');
  const [keyword, setKeyword] = useState('');
  const [tick, setTick] = useState(0); // 每秒心跳，驱动相对时间刷新
  const lastFetchRef = useRef<number>(0);

  const fetchActivity = useCallback(async (silent = false) => {
    if (!silent) lastFetchRef.current = Date.now();
    try {
      const res = await fetch('/api/agent/activity', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setData(json);
        setError(null);
      } else {
        setError(json.error || '读取行动流失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // 静默高频轮询（3s），手动刷新按钮仍然可用
  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (Date.now() - lastFetchRef.current > 2500) {
        fetchActivity(true);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchActivity]);

  // 心跳：让「N 秒前」动起来
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const actions: AgentAction[] = data?.actions || [];
  const filtered = actions.filter((a) => {
    if (filter !== 'all' && a.source !== filter) return false;
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      return (
        a.title.toLowerCase().includes(kw) ||
        a.detail.toLowerCase().includes(kw) ||
        a.category.includes(kw)
      );
    }
    return true;
  });

  const agentCount = actions.filter((a) => a.source === 'agent').length;
  const terminalCount = actions.filter((a) => a.source === 'terminal').length;

  return (
    <div className="space-y-5" data-tick={tick}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-950/60 via-slate-900 to-slate-900/80 border border-teal-900/40 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/25 flex items-center justify-center text-teal-300 shadow-inner">
              <Radar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-white tracking-tight">Agent 行动直播</h2>
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                  LIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                <span>服务器时间: <strong className="text-slate-200 font-mono">{data ? formatTs(data.serverTime) : '…'}</strong></span>
                <span>•</span>
                <span>进程: <strong className="text-slate-200 font-mono">PID {data?.boot.pid || '…'}</strong> 已运行 {data ? Math.floor(data.boot.processUptimeSec / 60) : '…'} 分钟</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                autoRefresh
                  ? 'bg-teal-500/15 border-teal-500/30 text-teal-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
              {autoRefresh ? '实时轮询 (3s)' : '已暂停'}
            </button>
            <button
              onClick={() => fetchActivity()}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
              title="立即刷新"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSendToTerminal('tail -n 8 agent-log.jsonl')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition cursor-pointer flex items-center gap-1.5"
              title="在终端中查看原始 JSONL 日志"
            >
              <TerminalSquare className="w-3.5 h-3.5 text-teal-300" />
              终端核对
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-xl bg-rose-950/40 border border-rose-900/50 text-rose-300 text-xs">
          行动流读取异常: {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Action Timeline */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <Radio className="w-4 h-4 text-teal-300" />
              <h3 className="font-bold text-white text-sm">动作时间线</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-500/15 text-teal-300 border border-teal-500/25">
                Agent {agentCount} · 终端 {terminalCount}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
                {([
                  { id: 'all', label: '全部' },
                  { id: 'agent', label: 'Agent' },
                  { id: 'terminal', label: '你的终端' },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setFilter(t.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                      filter === t.id ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜索动作..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 w-32 sm:w-40"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
            {loading && (
              <div className="py-10 text-center text-xs text-slate-500">正在接入行动流…</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-500">
                <Radar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                暂无匹配的动作记录。Agent 写文件、跑命令、修 Bug 时这里会实时亮起来。
              </div>
            )}
            {filtered.map((a, idx) => {
              const src = SOURCE_META[a.source] || SOURCE_META.agent;
              const cat = CATEGORY_STYLE[a.category] || CATEGORY_STYLE.note;
              const SourceIcon = src.icon;
              const isHead = idx === 0;
              return (
                <div
                  key={`${a.ts}-${idx}-${a.title}`}
                  className={`relative pl-4 pr-3 py-3 rounded-xl border transition ${
                    isHead && autoRefresh
                      ? 'bg-teal-950/20 border-teal-500/25'
                      : 'bg-slate-950/60 border-slate-800/70 hover:border-slate-700'
                  }`}
                >
                  {/* timeline dot */}
                  <span className={`absolute left-[-5px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${cat.dot} ring-4 ring-slate-950`} />
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 mb-1">
                    <span className="font-mono text-[11px] text-slate-500 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatTs(a.ts)}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border shrink-0 ${cat.chip}`}>
                      {cat.label}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0 ${src.chip} flex items-center gap-1`}>
                      <SourceIcon className="w-3 h-3" />
                      {src.label}
                    </span>
                    <span className={`text-xs flex-1 min-w-0 ${isHead ? 'text-white font-semibold' : 'text-slate-200'}`}>
                      {a.title}
                    </span>
                  </div>
                  {a.detail && (
                    <p className="text-[11px] text-slate-400 leading-relaxed break-words">{a.detail}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: recent file changes + dev log */}
        <div className="space-y-5">
          {/* Recent file changes */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur">
            <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-slate-800">
              <FilePlus2 className="w-4 h-4 text-amber-300" />
              <h3 className="font-bold text-white text-sm">最近改动文件</h3>
              <span className="ml-auto text-[10px] text-slate-500 font-mono">45min 窗口</span>
            </div>
            <div className="space-y-1 max-h-[240px] overflow-y-auto">
              {(data?.recentFiles || []).map((f) => (
                <button
                  key={f.path}
                  onClick={() => onSendToTerminal(`ls -lah "${f.path}"`)}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800/60 transition text-left cursor-pointer group"
                  title={f.path}
                >
                  <span className="text-[11px] font-mono text-slate-300 group-hover:text-amber-200 truncate min-w-0">
                    {f.path}
                  </span>
                  <span className="text-[10px] text-slate-500 shrink-0 flex items-center gap-1.5">
                    <span>{formatSize(f.size)}</span>
                    <span className="text-amber-400/80">{formatRelative(f.relativeSec)}</span>
                  </span>
                </button>
              ))}
              {(!data || data.recentFiles.length === 0) && (
                <div className="py-6 text-center text-[11px] text-slate-500">
                  窗口期内没有文件改动
                </div>
              )}
            </div>
          </div>

          {/* dev.log tail */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-sky-300" />
                <h3 className="font-bold text-white text-sm">dev.log 尾部</h3>
              </div>
              <button
                onClick={() => onSendToTerminal('tail -n 20 dev.log')}
                className="text-[10px] font-mono text-sky-400 hover:text-sky-300 cursor-pointer"
              >
                终端查看 →
              </button>
            </div>
            <pre className="bg-black/50 rounded-xl border border-slate-800/60 p-3 text-[10px] font-mono text-slate-400 leading-relaxed max-h-[220px] overflow-auto whitespace-pre-wrap break-all">
              {data?.devLogTail || '(读取中…)'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
