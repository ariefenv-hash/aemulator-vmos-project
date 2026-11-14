'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, PackageOpen, FileCode, FileText, FileArchive, Smartphone, File as FileIcon, HardDrive } from 'lucide-react';

interface Deliverable {
  name: string;
  size: number;
  isDir: boolean;
  mtime: number;
}

const NOTES: Record<string, string> = {
  'AEmulator-0.0.0.4-root-xposed-upgrade.apk': '替换安装版（包名 app.aemu）：需先卸载原版 AEmulator 才能安装，原版的镜像数据存于应用私有目录，卸载会清空 —— 想保留数据请用旁边的并存版',
  'AEmulator-0.0.0.4-side-by-side-v0003.apk': '并存安装版（包名 app.aemu.v0003）：与原版 AEmulator 共存、互不影响，各自的镜像数据独立保留 —— 推荐',
  'aemulator-root-modules-v04.patch': '相对上游 uxazu/AEmulator 0.0.0.3 的全部改动补丁（git apply 即可复现本 fork）',
  'AEmulator升级实施报告-Root管理与模块体系.docx': '上一轮升级实施的完整报告（Word 版）',
  'AEmulator升级实施报告-Root管理与模块体系.pdf': '上一轮升级实施的完整报告（PDF 版）',
  'VirtualMaster逆向分析与AEmulator迁移方案.docx': '虚拟大师逆向分析与迁移方案（Word 版）',
  'VirtualMaster逆向分析与AEmulator迁移方案.pdf': '虚拟大师逆向分析与迁移方案（PDF 版）',
  'README.md': '说明文件',
};

function iconFor(name: string) {
  const n = name.toLowerCase();
  if (n.endsWith('.apk')) return Smartphone;
  if (n.endsWith('.zip')) return FileArchive;
  if (n.endsWith('.patch') || n.endsWith('.md') || n.endsWith('.txt')) return FileCode;
  if (n.endsWith('.pdf') || n.endsWith('.docx') || n.endsWith('.xlsx')) return FileText;
  if (n.endsWith('.img')) return HardDrive;
  return FileIcon;
}

function fmtSize(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

function fmtTime(ms: number) {
  const d = new Date(ms);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function DeliverablesView() {
  const [files, setFiles] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');
  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/deliverables', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setFiles(json.files);
      else setError(json.error || '读取失败');
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const download = async (f: Deliverable) => {
    setDownloading(f.name);
    setProgress(0);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(`/api/deliverables/download?name=${encodeURIComponent(f.name)}`, { signal: ac.signal });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get('Content-Length') || f.size);
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        got += value.length;
        if (total > 0) setProgress(Math.round((got / total) * 100));
      }
      const blob = new Blob(chunks as BlobPart[]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(`下载失败: ${String(e)}`);
    } finally {
      setDownloading('');
      abortRef.current = null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-base font-bold text-white">
              <PackageOpen className="h-5 w-5 text-emerald-400" />
              交付文件下载中心
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              这里直接从沙箱的 <code className="rounded bg-slate-800 px-1 font-mono text-emerald-300">/home/z/my-project/download/</code> 目录提供文件，
              不依赖平台的文件预览通道。点击「下载」即可通过浏览器保存到本地；大文件（如 APK）带实时进度。
            </p>
          </div>
          <button
            onClick={load}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700/60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
        {error && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
        )}
      </div>

      {loading && files.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-500">正在读取交付文件列表…</div>
      ) : files.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-500">download/ 目录为空</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {files.map((f) => {
            const Icon = iconFor(f.name);
            const note = NOTES[f.name];
            const busy = downloading === f.name;
            return (
              <div key={f.name} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-sm font-medium text-slate-100" title={f.name}>{f.name}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                      <span>{fmtSize(f.size)}</span>
                      <span>•</span>
                      <span>{fmtTime(f.mtime)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => download(f)}
                    disabled={!!downloading}
                    className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                      busy
                        ? 'bg-sky-600/40 text-sky-200'
                        : 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/30 hover:bg-emerald-500'
                    } ${downloading && !busy ? 'cursor-not-allowed opacity-40' : ''}`}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {busy ? `${progress}%` : '下载'}
                  </button>
                </div>
                {note && <p className="mt-2 border-t border-slate-800/60 pt-2 text-[11px] leading-relaxed text-slate-400">{note}</p>}
                {busy && (
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
