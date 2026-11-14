'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Smartphone,
  Hammer,
  FileText,
  ListTree,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  FolderTree,
  TerminalSquare,
  Clock,
  Trash2,
  Wrench,
} from 'lucide-react';

interface ToolInfo {
  id: string;
  name: string;
  home: string;
  available: boolean;
  version: string;
}

interface UploadedFile {
  name: string;
  size: number;
  mtime: string;
  kind: string;
}

interface JobMeta {
  id: string;
  action: string;
  file: string;
  cmd: string;
  outDir?: string;
  status: 'running' | 'done' | 'failed';
  pid?: number;
  startedAt?: number;
  exitCode?: number;
  durationSec?: number;
}

interface JobDetail {
  job: JobMeta;
  logTail: string;
  alive: boolean;
  outDir?: string;
  outFiles: { name: string; size: number }[];
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtTs(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false });
}

export const ApkLabView: React.FC<{ onSendToTerminal?: (cmd: string) => void }> = ({ onSendToTerminal }) => {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [diskFree, setDiskFree] = useState('');
  const [apkFiles, setApkFiles] = useState<UploadedFile[]>([]);
  const [selected, setSelected] = useState('');
  const [jobs, setJobs] = useState<JobMeta[]>([]);
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [customCmd, setCustomCmd] = useState('');
  const [busy, setBusy] = useState('');
  const logBoxRef = useRef<HTMLPreElement | null>(null);

  const fetchTools = useCallback(async () => {
    try {
      const res = await fetch('/api/apk/tools', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setTools(json.tools || []);
        setDiskFree(json.diskFree || '');
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/upload', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        const list: UploadedFile[] = json.files || [];
        setApkFiles(list);
        setSelected((prev) => (prev && list.some((f) => f.name === prev) ? prev : list[0]?.name || ''));
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/apk/job', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setJobs(json.jobs || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchTools();
    fetchFiles();
    fetchJobs();
  }, [fetchTools, fetchFiles, fetchJobs]);

  // 运行中的作业每 2 秒轮询刷新
  const hasRunning = jobs.some((j) => j.status === 'running');
  useEffect(() => {
    if (!hasRunning) return;
    const t = setInterval(fetchJobs, 2000);
    return () => clearInterval(t);
  }, [hasRunning, fetchJobs]);

  const openJob = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/apk/job?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setDetail(json);
    } catch {
      // ignore
    }
  }, []);

  // 详情面板：运行中时 1.5s 轮询日志
  const detailRunning = detail?.alive;
  useEffect(() => {
    if (!detailRunning || !detail?.job.id) return;
    const t = setInterval(() => openJob(detail.job.id), 1500);
    return () => clearInterval(t);
  }, [detailRunning, detail?.job.id, openJob]);

  // 日志自动滚底
  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [detail?.logTail]);

  const startJob = async (action: string, extra = '', outName = '') => {
    if (!selected && action !== 'custom') return;
    setBusy(action);
    try {
      const res = await fetch('/api/apk/job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, file: `uploads/${selected}`, extra, outName }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchJobs();
        setTimeout(() => openJob(json.jobId), 400);
      }
    } finally {
      setBusy('');
    }
  };

  const killJob = async (id: string) => {
    await fetch(`/api/apk/job?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    setDetail(null);
    fetchJobs();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900/80 border border-emerald-900/40 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-3.5 relative">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-300 shadow-inner">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">APK 反编译工作台</h2>
            <p className="text-xs text-slate-400 mt-1">
              jadx（Java 源码）+ apktool（资源/Manifest 解包）已就绪 · 作业后台分离运行，几十分钟也不中断 ·
              磁盘可用 <strong className="text-emerald-300 font-mono">{diskFree}</strong>
            </p>
          </div>
          <button
            onClick={() => {
              fetchTools();
              fetchFiles();
              fetchJobs();
            }}
            className="ml-auto p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            title="刷新"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toolchain status */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {tools.map((t) => (
          <div
            key={t.id}
            className={`rounded-xl border p-3.5 bg-slate-900/80 backdrop-blur ${
              t.available ? 'border-emerald-500/30' : 'border-slate-800'
            }`}
            data-testid={`tool-${t.id}`}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              {t.available ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span className="text-[11px] font-semibold text-slate-200 truncate">{t.id}</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">{t.name}</p>
            {t.available && t.version && (
              <p className="text-[10px] text-emerald-400/80 font-mono mt-1 truncate">{t.version}</p>
            )}
          </div>
        ))}
      </div>

      {/* Target selection + actions */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur">
        <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-amber-300" />
          选择目标 APK（来自 uploads/，先到「大文件上传」页签传 APK）
        </h3>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500 cursor-pointer"
            data-testid="apk-select"
          >
            {apkFiles.length === 0 && <option value="">（uploads/ 为空，请先上传 APK）</option>}
            {apkFiles.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name} · {fmtSize(f.size)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            disabled={!selected || busy !== ''}
            onClick={() => startJob('jadx')}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition cursor-pointer shadow-sm"
            data-testid="btn-jadx"
          >
            {busy === 'jadx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hammer className="w-4 h-4" />}
            jadx 反编译（Java 源码）
          </button>
          <button
            disabled={!selected || busy !== ''}
            onClick={() => startJob('apktool')}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-violet-600/90 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition cursor-pointer shadow-sm"
            data-testid="btn-apktool"
          >
            {busy === 'apktool' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderTree className="w-4 h-4" />}
            apktool 解包（资源）
          </button>
          <button
            disabled={!selected || busy !== ''}
            onClick={() => startJob('manifest')}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-teal-600/90 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition cursor-pointer shadow-sm"
            data-testid="btn-manifest"
          >
            {busy === 'manifest' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            只解 AndroidManifest
          </button>
          <button
            disabled={!selected || busy !== ''}
            onClick={() => startJob('unzip-list')}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
            data-testid="btn-unzip"
          >
            {busy === 'unzip-list' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListTree className="w-4 h-4" />}
            快速列出包结构
          </button>
        </div>

        {/* custom command */}
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <input
            value={customCmd}
            onChange={(e) => setCustomCmd(e.target.value)}
            placeholder="自定义命令（可选）：如 aapt dump badging uploads/app.apk / ls decompiled/xxx"
            className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
            data-testid="custom-cmd"
          />
          <button
            disabled={!customCmd.trim()}
            onClick={() => startJob('custom', customCmd)}
            className="px-4 py-2 rounded-xl bg-amber-600/90 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
          >
            <TerminalSquare className="w-3.5 h-3.5" />
            后台执行
          </button>
        </div>
      </div>

      {/* Job list */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur">
        <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-sky-300" />
          反编译作业队列
          {hasRunning && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/15 text-sky-300 border border-sky-500/25 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> 运行中
            </span>
          )}
        </h3>
        {jobs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">还没有作业。选好 APK 后点上面的按钮即可。</div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {jobs.map((j) => (
              <div
                key={j.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition cursor-pointer ${
                  detail?.job.id === j.id
                    ? 'bg-sky-950/30 border-sky-500/30'
                    : 'bg-slate-950/60 border-slate-800/70 hover:border-slate-700'
                }`}
                onClick={() => openJob(j.id)}
                data-testid={`job-${j.id}`}
              >
                {j.status === 'running' ? (
                  <Loader2 className="w-4 h-4 text-sky-400 animate-spin shrink-0" />
                ) : j.status === 'done' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-200 font-mono truncate">
                    [{j.action}] {j.file}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono truncate">{j.cmd}</p>
                </div>
                <span className="text-[10px] font-mono text-slate-500 shrink-0">{fmtTs(j.startedAt)}</span>
                {j.status === 'running' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      killJob(j.id);
                    }}
                    className="p-1.5 rounded-lg hover:bg-rose-500/15 text-slate-500 hover:text-rose-300 transition cursor-pointer shrink-0"
                    title="终止作业"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Job detail: live log + outputs */}
      {detail && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                实时日志
                <span className="font-mono text-[10px] text-slate-500">{detail.job.id}</span>
                {detail.alive && <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin" />}
              </h3>
              {onSendToTerminal && (
                <button
                  onClick={() => onSendToTerminal(`tail -n 30 apk-jobs/${detail.job.id}.log`)}
                  className="text-[10px] font-mono text-sky-400 hover:text-sky-300 cursor-pointer"
                >
                  终端查看 →
                </button>
              )}
            </div>
            <pre
              ref={logBoxRef}
              className="bg-black/60 rounded-xl border border-slate-800/60 p-3.5 text-[11px] font-mono text-slate-300 leading-relaxed max-h-[360px] overflow-auto whitespace-pre-wrap break-all"
              data-testid="job-log"
            >
              {detail.logTail || '(暂无输出)'}
            </pre>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur">
            <h3 className="font-bold text-white text-sm pb-3 mb-3 border-b border-slate-800 flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-violet-300" />
              产物文件 {detail.outFiles.length > 0 && <span className="font-mono text-[10px] text-slate-500">{detail.outFiles.length} 个</span>}
            </h3>
            {detail.outDir ? (
              detail.outFiles.length === 0 ? (
                <p className="text-[11px] text-slate-500 py-4 text-center">作业完成后这里会列出产物</p>
              ) : (
                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {detail.outFiles.map((f) => (
                    <div key={f.name} className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg hover:bg-slate-800/60">
                      <span className="text-[11px] font-mono text-slate-300 truncate min-w-0" title={f.name}>
                        {f.name}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0 font-mono">{fmtSize(f.size)}</span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <p className="text-[11px] text-slate-500 py-4 text-center">该作业无产物目录（如 unzip-list 仅输出列表）</p>
            )}
            {detail.outDir && detail.outFiles.length > 0 && onSendToTerminal && (
              <button
                onClick={() => onSendToTerminal(`ls -R "${detail.outDir}" | head -50`)}
                className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition cursor-pointer"
              >
                在终端浏览产物目录
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
