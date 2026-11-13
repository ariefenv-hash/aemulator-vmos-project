'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  RefreshCw,
  Search,
  Terminal,
  AlertCircle,
} from 'lucide-react';
import { ProcessItem } from './types';

interface CloudProcessMonitorProps {
  onSendToTerminal: (cmd: string) => void;
}

export const CloudProcessMonitor: React.FC<CloudProcessMonitorProps> = ({ onSendToTerminal }) => {
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchProcesses = async () => {
    try {
      const res = await fetch('/api/system/processes', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.processes) {
        setProcesses(data.processes);
        setError(null);
      } else {
        setError(data.error || '快照读取失败');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcesses();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchProcesses, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const filtered = processes.filter(
    (p) =>
      p.command.toLowerCase().includes(search.toLowerCase()) ||
      p.pid.includes(search) ||
      p.fullArgs.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base">云端进程监视器 (Live Process Explorer)</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {processes.length} 进程活跃
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              实时读取 Linux 容器 `ps -eo pid,user,%cpu,%mem,comm,args` 进程快照（每 4 秒刷新）
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="过滤 PID / 命令..."
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-purple-500 w-36 sm:w-48"
            />
          </div>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono transition cursor-pointer flex items-center gap-1 ${
              autoRefresh ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <RefreshCw className={`w-3 h-3 ${autoRefresh ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
            {autoRefresh ? '4s' : '暂停'}
          </button>

          <button
            onClick={() => onSendToTerminal('ps aux')}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
          >
            <Terminal className="w-3.5 h-3.5 text-purple-400" />
            在终端查看
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-rose-950/40 border border-rose-900/50 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {/* Process Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70">
        <table className="w-full text-left font-mono text-xs text-slate-300">
          <thead className="bg-slate-900/90 text-slate-400 text-[11px] uppercase border-b border-slate-800">
            <tr>
              <th className="px-3.5 py-2.5">PID</th>
              <th className="px-3 py-2.5">USER</th>
              <th className="px-3 py-2.5">CPU%</th>
              <th className="px-3 py-2.5">MEM%</th>
              <th className="px-3 py-2.5">TIME</th>
              <th className="px-3.5 py-2.5">COMMAND / ARGS</th>
              <th className="px-3 py-2.5 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.map((p) => (
              <tr key={p.pid} className="hover:bg-slate-800/40 transition">
                <td className="px-3.5 py-2 text-sky-400 font-semibold">{p.pid}</td>
                <td className="px-3 py-2 text-slate-400">{p.user}</td>
                <td className="px-3 py-2 text-emerald-400">{p.cpu}</td>
                <td className="px-3 py-2 text-purple-300">{p.mem}</td>
                <td className="px-3 py-2 text-slate-400">{p.time}</td>
                <td className="px-3.5 py-2 text-slate-200 max-w-md truncate" title={p.fullArgs}>
                  <strong className="text-white mr-1.5">{p.command}</strong>
                  <span className="text-slate-400 text-[11px]">{p.fullArgs}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => onSendToTerminal(`ps -p ${p.pid} -o pid,user,%cpu,%mem,etime,args`)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] cursor-pointer"
                  >
                    探查
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans">
                  {loading ? '快照加载中…' : '未匹配到相关进程'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
