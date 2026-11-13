'use client';

import React, { useState, useEffect } from 'react';
import {
  Server,
  Cpu,
  HardDrive,
  Activity,
  Clock,
  Layers,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Zap,
  ArrowUpRight,
} from 'lucide-react';
import { RealSystemOverview } from './types';

interface CloudCockpitProps {
  onQuickCommand: (cmd: string) => void;
  onOpenBenchmark: () => void;
}

export const CloudCockpit: React.FC<CloudCockpitProps> = ({ onQuickCommand, onOpenBenchmark }) => {
  const [data, setData] = useState<RealSystemOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [pingMs, setPingMs] = useState<number>(0);

  const fetchOverview = async () => {
    const t0 = performance.now();
    try {
      const res = await fetch('/api/system/full-overview');
      const json = await res.json();
      const elapsed = Math.round(performance.now() - t0);
      setPingMs(elapsed);
      if (json.success) {
        setData(json);
        setError(null);
        setLastUpdated(new Date());
      } else {
        setError(json.error || 'Failed to fetch telemetry');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchOverview();
    }, 6000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 MB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return '0分';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}小时 ${mins}分`;
    return `${mins}分 ${secs}秒`;
  };

  return (
    <div className="space-y-6">
      {/* Cockpit Status Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-sky-950/40 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-inner">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  云端 Linux 容器全景透视中枢
                </h2>
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Z.ai 沙箱实时联动
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                <span>延迟: <strong className="text-sky-300 font-mono">{pingMs}ms</strong></span>
                <span>•</span>
                <span>更新于: {lastUpdated.toLocaleTimeString()}</span>
                <span>•</span>
                <span>节点: <strong className="text-slate-300 font-mono">{data?.host.hostname || '…'}</strong> ({data?.host.arch || '…'})</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                autoRefresh
                  ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
              {autoRefresh ? '自动遥测 (6s)' : '已暂停自动刷新'}
            </button>
            <button
              onClick={fetchOverview}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
              title="立即刷新"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenBenchmark}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs shadow-lg shadow-purple-900/30 transition cursor-pointer flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              启动算力全检
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-xl bg-rose-950/40 border border-rose-900/50 text-rose-300 text-xs">
          遥测采集异常: {error}
        </div>
      )}

      {/* Main 4 Real Telemetry Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU Card */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
              <Cpu className="w-4 h-4" /> CPU 算力核心
            </span>
            <span className="font-mono text-emerald-400 font-bold">
              {data?.hardware.cpus.length || '…'} vCPUs
            </span>
          </div>
          <div className="text-sm font-semibold text-white font-mono truncate" title={data?.hardware.cpus[0]?.model}>
            {data?.hardware.cpus[0]?.model || '读取中…'}
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <span>系统平均负载 (1m/5m/15m):</span>
            <span className="font-mono text-slate-200">
              {data?.host.loadavg.map((v) => v.toFixed(2)).join(', ') || '…'}
            </span>
          </div>
        </div>

        {/* Memory Card */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="flex items-center gap-1.5 text-purple-400 font-semibold">
              <Activity className="w-4 h-4" /> 真实内存配额
            </span>
            <span className="font-mono text-purple-300 font-bold">
              {data ? Math.round((data.hardware.usedMemBytes / data.hardware.totalMemBytes) * 100) : '…'}% 已分配
            </span>
          </div>
          <div className="text-base font-bold text-white font-mono">
            {data ? formatBytes(data.hardware.usedMemBytes) : '…'} / {data ? formatBytes(data.hardware.totalMemBytes) : '…'}
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-500"
              style={{
                width: data ? `${Math.min(100, Math.round((data.hardware.usedMemBytes / data.hardware.totalMemBytes) * 100))}%` : '0%',
              }}
            />
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex justify-between">
            <span>V8 堆内存: {data ? Math.round(data.runtimes.memoryUsage.heapUsed / 1024 / 1024) + 'MB' : '…'}</span>
            <span>空闲可用: {data ? formatBytes(data.hardware.freeMemBytes) : '…'}</span>
          </div>
        </div>

        {/* Disk Card */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <HardDrive className="w-4 h-4" /> 存储卷挂载 ({data?.hardware.disk.filesystem || '…'})
            </span>
            <span className="font-mono text-amber-300 font-bold">
              {data?.hardware.disk.usePercent || '…'}
            </span>
          </div>
          <div className="text-base font-bold text-white font-mono">
            {data?.hardware.disk.used || '…'} / {data?.hardware.disk.total || '…'}
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-800">
            <div
              className="bg-amber-500 h-full transition-all duration-500"
              style={{ width: (data?.hardware.disk.usePercent || '0%').replace('%', '') + '%' }}
            />
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex justify-between">
            <span className="font-mono">挂载点: /home/z/my-project</span>
            <span>剩余可用: {data?.hardware.disk.available || '…'}</span>
          </div>
        </div>

        {/* Runtime Card */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <Clock className="w-4 h-4" /> 容器运行时长
            </span>
            <span className="font-mono text-emerald-400 font-bold">活跃</span>
          </div>
          <div className="text-base font-bold text-white font-mono">
            {data ? formatUptime(data.host.uptime) : '…'}
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <span>Node: <strong className="text-slate-200">{data?.runtimes.node || '…'}</strong></span>
            <span className="truncate" title={data?.runtimes.python}>
              Py: <strong className="text-slate-200">{data?.runtimes.python.split(' ')[1] || '…'}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Architecture Blueprint */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-white text-base">Z.ai 云沙箱全栈分层架构透视图</h3>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">点击任一层级可快速向终端派发探测指令</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {[
            {
              layer: 'LAYER 01',
              colorClass: 'text-sky-400',
              hoverClass: 'hover:border-sky-500/50',
              title: '容器硬件虚拟化',
              desc: `${data?.host.type || 'Linux'} ${data?.host.arch || 'x86_64'} 弹性云容器，安全隔离 POSIX 沙箱。`,
              cmd: 'uname -a',
            },
            {
              layer: 'LAYER 02',
              colorClass: 'text-sky-400',
              hoverClass: 'hover:border-sky-500/50',
              title: 'Linux 容器核心',
              desc: `${data?.host.release ? `Kernel ${data.host.release}` : 'Linux Kernel'}，完整 Bash 脚本、文本管道与 GNU 实用工具。`,
              cmd: 'cat /etc/os-release',
            },
            {
              layer: 'LAYER 03',
              colorClass: 'text-purple-400',
              hoverClass: 'hover:border-purple-500/50',
              title: '多语言运行时',
              desc: `Node.js ${data?.runtimes.node?.replace('v', '') || '…'} (V8 ${data?.runtimes.v8 || '…'}) + Python 3 + bun 工具链。`,
              cmd: 'node -v && python3 --version && bun --version',
            },
            {
              layer: 'LAYER 04',
              colorClass: 'text-emerald-400',
              hoverClass: 'hover:border-emerald-500/50',
              title: '全栈服务网关',
              desc: 'Next.js 16 App Router + API Routes 同进程，Caddy 网关对外只暴露 3000 一个端口。',
              cmd: 'ps aux | grep -E "next|bun" | grep -v grep',
            },
            {
              layer: 'LAYER 05',
              colorClass: 'text-amber-400',
              hoverClass: 'hover:border-amber-500/50',
              title: '应用持久文件区',
              desc: '工作区位于 /home/z/my-project，具备完整读写、修改、重命名与热重载权限。',
              cmd: 'ls -lah /home/z/my-project',
            },
          ].map((layer) => (
            <div
              key={layer.layer}
              onClick={() => onQuickCommand(layer.cmd)}
              className={`p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 ${layer.hoverClass} transition cursor-pointer group flex flex-col justify-between`}
            >
              <div>
                <div className={`flex items-center justify-between text-[11px] ${layer.colorClass} font-mono mb-1`}>
                  <span>{layer.layer}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                </div>
                <h4 className="font-bold text-slate-200 text-sm mb-1 group-hover:text-sky-300">{layer.title}</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">{layer.desc}</p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-900 text-[10px] font-mono text-slate-500 truncate">
                $ {layer.cmd}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Raw Environment Details */}
      {data && (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              云端环境详细证书与系统签名
            </span>
            <span className="font-mono text-[11px]">User: {data.environment.user} | CWD: {data.environment.cwd}</span>
          </div>
          <div className="bg-black/50 p-3 rounded-xl border border-slate-800/60 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto">
            <div><strong>Kernel Signature:</strong> {data.host.uname}</div>
            <div className="mt-1"><strong>Operating System:</strong> {data.host.osRelease.split('\n')[0].replace(/"/g, '')}</div>
            <div className="mt-1"><strong>Node V8 Engine:</strong> {data.runtimes.v8} | Git: {data.runtimes.git} | {data.runtimes.bun || 'bun N/A'}</div>
          </div>
        </div>
      )}

      {/* refresh hint for screen readers */}
      <span className="sr-only" aria-live="polite">
        {loading ? '遥测加载中' : `遥测已更新，延迟 ${pingMs} 毫秒`}
      </span>
    </div>
  );
};
