'use client';

import React, { useState, useEffect } from 'react';
import {
  Download,
  Archive,
  Check,
  Copy,
  Terminal,
  ShieldCheck,
  FolderArchive,
  RefreshCw,
  FileCode,
  Container,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ZipInfo } from './types';

export const ExportDeployView: React.FC = () => {
  const [zipInfo, setZipInfo] = useState<ZipInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showFileList, setShowFileList] = useState(false);

  const fetchZipInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/project/zip-info', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setZipInfo(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZipInfo();
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const nodeCommand = `unzip cloud-sandbox-explorer-next.zip -d explorer && cd explorer && bun install && bun run dev`;
  const dockerCommand = `unzip cloud-sandbox-explorer-next.zip -d explorer && cd explorer && docker build -t sandbox-explorer . && docker run -d -p 3000:3000 sandbox-explorer`;

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-emerald-950/50 via-slate-900 to-indigo-950/40 border border-emerald-900/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner shrink-0">
              <FolderArchive className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  工作台源码已打包为标准 ZIP 格式
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Ready to Deploy
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                包含本工作台（Next.js 16 适配版）的完整源码：9 组 API Routes、全部前端组件、Agent 行动日志通道与打包脚本，可带走部署到任意 Node 18+ 环境。
              </p>
            </div>
          </div>

          {/* Download Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={fetchZipInfo}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
              title="重新打包"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <a
              href="/api/download/project-zip"
              download="cloud-sandbox-explorer-next.zip"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/40 transition cursor-pointer flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>下载 ZIP 源码包 ({zipInfo ? formatBytes(zipInfo.zipSize) : '…'})</span>
            </a>
          </div>
        </div>

        {/* Zip Metadata summary */}
        {zipInfo && (
          <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 block text-[10px]">压缩包大小</span>
              <span className="text-emerald-400 font-bold">{formatBytes(zipInfo.zipSize)}</span>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 block text-[10px]">解压后源码体积</span>
              <span className="text-sky-300 font-bold">{formatBytes(zipInfo.uncompressedSize)}</span>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 block text-[10px]">包含源码文件数</span>
              <span className="text-purple-300 font-bold">{zipInfo.fileCount} 个核心文件</span>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 block text-[10px]">SHA-256 完整性指纹</span>
              <span className="text-slate-300 text-[11px] truncate block" title={zipInfo.sha256}>
                {zipInfo.sha256.slice(0, 12)}...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Deployment Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Environment 1: Standard Linux / Node sandbox */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">通用 Linux / 云沙箱 / 本地终端</h3>
                  <span className="text-xs text-slate-400">支持 Debian, Ubuntu, macOS, WSL2 等</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
                Node 18+ / bun
              </span>
            </div>

            <p className="text-xs text-slate-300 mb-3">
              在目标环境中解压后，安装依赖并启动开发服务即可：
            </p>

            <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 font-mono text-xs text-slate-200 relative group">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                <span>一键执行指令:</span>
                <button
                  onClick={() => copyToClipboard(nodeCommand, 'node')}
                  className="flex items-center gap-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  {copiedKey === 'node' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'node' ? '已复制' : '复制'}</span>
                </button>
              </div>
              <div className="text-sky-300 select-all break-all leading-relaxed">
                {nodeCommand}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
            启动后访问：<code className="text-white bg-black/40 px-1 py-0.5 rounded">http://localhost:3000</code>（Next.js 需 `bun run dev` 常驻前台）
          </div>
        </div>

        {/* Environment 2: Docker Container */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Container className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Docker / 容器化平台部署</h3>
                  <span className="text-xs text-slate-400">ZIP 内附 Gemini 原版 Dockerfile（Node 22 Bookworm）</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                Containerized
              </span>
            </div>

            <p className="text-xs text-slate-300 mb-3">
              如果目标环境支持容器（Docker, Podman, Fly.io, Railway, Cloud Run）：
            </p>

            <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 font-mono text-xs text-slate-200 relative group">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                <span>Docker 构建运行指令:</span>
                <button
                  onClick={() => copyToClipboard(dockerCommand, 'docker')}
                  className="flex items-center gap-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  {copiedKey === 'docker' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'docker' ? '已复制' : '复制'}</span>
                </button>
              </div>
              <div className="text-purple-300 select-all break-all leading-relaxed">
                {dockerCommand}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
            容器内需预装 Debian 核心工具、Python 3 与 Node.js 18+。
          </div>
        </div>
      </div>

      {/* Expandable Packed Files List */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <button
          onClick={() => setShowFileList(!showFileList)}
          className="w-full flex items-center justify-between text-left cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <Archive className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-white text-sm group-hover:text-emerald-300 transition">
                查看 ZIP 包含的文件清单 ({zipInfo?.fileCount || 0} 个文件)
              </h3>
              <p className="text-xs text-slate-400">
                仅保留本工作台源代码与脚本，自动剔除 node_modules 与编译缓存
              </p>
            </div>
          </div>
          {showFileList ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showFileList && zipInfo && (
          <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 font-mono text-xs">
            {zipInfo.files.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800/60"
              >
                <div className="flex items-center gap-1.5 truncate text-slate-300 min-w-0">
                  <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">{file.name}</span>
                </div>
                <span className="text-[10px] text-slate-500 shrink-0">{formatBytes(file.size)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security note */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-start gap-2.5 text-xs text-slate-400">
        <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
        <p className="leading-relaxed">
          安全提示：内置终端执行器（/api/terminal/execute）已过滤 rm -rf、Fork 炸弹等破坏性指令，但未内置公网鉴权。
          若部署到公网环境，请自行在 API 层增加身份校验或内网隔离。
        </p>
      </div>
    </div>
  );
};
