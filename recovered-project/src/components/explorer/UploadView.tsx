'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CloudUpload,
  File as FileIcon,
  Trash2,
  RefreshCw,
  HardDrive,
  GaugeCircle,
  CheckCircle2,
  AlertTriangle,
  Package,
} from 'lucide-react';

interface UploadedFile {
  name: string;
  size: number;
  mtime: string;
  kind: string;
}

interface UploadState {
  fileName: string;
  fileSize: number;
  loaded: number;
  speedMBps: number;
  etaSec: number;
  status: 'idle' | 'uploading' | 'done' | 'error';
  error?: string;
}

const CHUNK_SIZE = 24 * 1024 * 1024; // 24MB 分块，失败自动续传
const MAX_BYTES = 2 * 1024 * 1024 * 1024;

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtEta(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '—';
  if (sec < 60) return `${Math.ceil(sec)} 秒`;
  if (sec < 3600) return `${Math.floor(sec / 60)} 分 ${Math.ceil(sec % 60)} 秒`;
  return `${Math.floor(sec / 3600)} 时 ${Math.floor((sec % 3600) / 60)} 分`;
}

export const UploadView: React.FC<{ onSendToTerminal?: (cmd: string) => void }> = ({ onSendToTerminal }) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [st, setSt] = useState<UploadState>({
    fileName: '',
    fileSize: 0,
    loaded: 0,
    speedMBps: 0,
    etaSec: 0,
    status: 'idle',
  });
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/upload', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setFiles(json.files || []);
        setTotalBytes(json.totalBytes || 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // 上传中每 3 秒刷新一次文件列表（分块完成后列表会变化）
  useEffect(() => {
    if (st.status !== 'uploading') return;
    const t = setInterval(fetchList, 3000);
    return () => clearInterval(t);
  }, [st.status, fetchList]);

  /** 分块上传单个文件：append 模式断点续传 */
  const uploadFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      setSt({
        fileName: file.name,
        fileSize: file.size,
        loaded: 0,
        speedMBps: 0,
        etaSec: 0,
        status: 'error',
        error: `文件超过 2GB 上限（当前 ${fmtSize(file.size)}）`,
      });
      return;
    }

    setSt({ fileName: file.name, fileSize: file.size, loaded: 0, speedMBps: 0, etaSec: 0, status: 'uploading' });

    // 服务端已有同名文件？询问续传基点
    let baseOffset = 0;
    try {
      const res = await fetch('/api/upload', { cache: 'no-store' });
      const json = await res.json();
      const existing = (json.files || []).find((f: UploadedFile) => f.name === file.name);
      if (existing && existing.size > 0 && existing.size < file.size) {
        baseOffset = existing.size; // 自动断点续传
      } else if (existing && existing.size >= file.size && existing.size !== file.size) {
        baseOffset = 0;
      } else if (existing && existing.size === file.size) {
        setSt({ fileName: file.name, fileSize: file.size, loaded: file.size, speedMBps: 0, etaSec: 0, status: 'done' });
        fetchList();
        return;
      }
    } catch {
      // ignore，从头传
    }

    const startedAt = Date.now();
    let offset = baseOffset;

    while (offset < file.size) {
      const end = Math.min(offset + CHUNK_SIZE, file.size);
      const blob = file.slice(offset, end);
      const ok = await new Promise<boolean>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open('POST', `/api/upload?name=${encodeURIComponent(file.name)}&append=${offset > 0 || baseOffset > 0 ? '1' : '0'}`, true);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            const loaded = offset + ev.loaded;
            const elapsedSec = (Date.now() - startedAt) / 1000;
            const speed = elapsedSec > 0 ? loaded / 1024 / 1024 / elapsedSec : 0;
            const remainBytes = file.size - loaded;
            setSt({
              fileName: file.name,
              fileSize: file.size,
              loaded,
              speedMBps: Number(speed.toFixed(1)),
              etaSec: speed > 0 ? remainBytes / 1024 / 1024 / speed : 0,
              status: 'uploading',
            });
          }
        };
        xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
        xhr.onerror = () => resolve(false);
        xhr.send(blob);
      });
      if (!ok) {
        setSt((s) => ({ ...s, status: 'error', error: '网络中断，点击"续传"可从断点继续' }));
        return;
      }
      offset = end;
    }

    setSt({
      fileName: file.name,
      fileSize: file.size,
      loaded: file.size,
      speedMBps: 0,
      etaSec: 0,
      status: 'done',
    });
    fetchList();
  };

  const handleFiles = (fl: FileList | null) => {
    if (!fl || fl.length === 0) return;
    uploadFile(fl[0]);
  };

  const deleteFile = async (name: string) => {
    await fetch(`/api/upload?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
    fetchList();
  };

  const percent = st.fileSize > 0 ? Math.min(100, Math.round((st.loaded / st.fileSize) * 100)) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-slate-900/80 border border-sky-900/40 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-3.5 relative">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-300 shadow-inner">
            <CloudUpload className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">大文件上传（单文件上限 2 GiB）</h2>
            <p className="text-xs text-slate-400 mt-1">
              流式直写磁盘 · 24MB 分块自动断点续传 · 落盘 <code className="text-sky-300 font-mono">/home/z/my-project/uploads</code> ·
              支持 APK / XAPK / ZIP / 固件镜像等
            </p>
          </div>
          <button
            onClick={fetchList}
            className="ml-auto p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            title="刷新列表"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed p-10 text-center transition cursor-pointer ${
          dragOver ? 'border-sky-400 bg-sky-500/10' : 'border-slate-700 bg-slate-900/60 hover:border-slate-500'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          data-testid="upload-input"
        />
        <CloudUpload className={`w-10 h-10 mx-auto mb-3 ${dragOver ? 'text-sky-300' : 'text-slate-500'}`} />
        <p className="text-sm text-slate-300 font-medium">拖拽文件到这里，或点击选择文件</p>
        <p className="text-[11px] text-slate-500 mt-1.5">
          单文件最大 2 GiB · 大文件自动分块续传 · 请勿关闭页面直至完成
        </p>
      </div>

      {/* Progress card */}
      {st.status !== 'idle' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              {st.status === 'done' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : st.status === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <GaugeCircle className="w-4 h-4 text-sky-400 shrink-0 animate-pulse" />
              )}
              <span className="text-sm text-slate-200 font-medium truncate" data-testid="upload-status">
                {st.status === 'done'
                  ? `上传完成: ${st.fileName}`
                  : st.status === 'error'
                    ? st.error || '上传失败'
                    : `正在上传: ${st.fileName}`}
              </span>
            </div>
            <span className="text-xs font-mono text-slate-400 shrink-0">
              {fmtSize(st.loaded)} / {fmtSize(st.fileSize)} · {percent}%
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                st.status === 'error' ? 'bg-rose-500' : st.status === 'done' ? 'bg-emerald-500' : 'bg-sky-500'
              }`}
              style={{ width: `${st.status === 'done' ? 100 : percent}%` }}
              data-testid="upload-progress"
            />
          </div>
          {st.status === 'uploading' && (
            <div className="flex items-center gap-4 mt-2.5 text-[11px] text-slate-400 font-mono">
              <span>速度 {st.speedMBps} MB/s</span>
              <span>剩余约 {fmtEta(st.etaSec)}</span>
            </div>
          )}
          {st.status === 'error' && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => {
                  const f = files.find((x) => x.name === st.fileName);
                  // 续传：重新选择同一文件即可自动从断点继续
                  inputRef.current?.click();
                  void f;
                }}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition cursor-pointer"
              >
                断点续传（重新选择同一文件）
              </button>
            </div>
          )}
        </div>
      )}

      {/* File list */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Package className="w-4 h-4 text-emerald-300" />
            <h3 className="font-bold text-white text-sm">已上传文件</h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
              {files.length} 个 · 共 {fmtSize(totalBytes)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
            <HardDrive className="w-3.5 h-3.5" />
            uploads/
          </div>
        </div>
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">读取中…</div>
        ) : files.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">
            <FileIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
            还没有上传文件。下一个 APK 就在这里传（最大 2GB）。
          </div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {files.map((f) => (
              <div
                key={f.name}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800/70 hover:border-slate-700 transition"
                data-testid={`uploaded-${f.name}`}
              >
                <FileIcon
                  className={`w-4 h-4 shrink-0 ${
                    f.kind === 'apk' ? 'text-emerald-400' : f.kind === 'archive' ? 'text-amber-400' : 'text-slate-400'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-200 font-medium truncate font-mono">{f.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {fmtSize(f.size)} · {new Date(f.mtime).toLocaleString('zh-CN', { hour12: false })}
                  </p>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono border shrink-0 ${
                    f.kind === 'apk'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                      : 'bg-slate-500/10 text-slate-400 border-slate-500/25'
                  }`}
                >
                  {f.kind}
                </span>
                <button
                  onClick={() => deleteFile(f.name)}
                  className="p-1.5 rounded-lg hover:bg-rose-500/15 text-slate-500 hover:text-rose-300 transition cursor-pointer shrink-0"
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {onSendToTerminal && files.length > 0 && (
          <button
            onClick={() => onSendToTerminal('ls -lah uploads/ && df -h /home/z/my-project')}
            className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition cursor-pointer"
          >
            在终端核对新文件
          </button>
        )}
      </div>
    </div>
  );
};
