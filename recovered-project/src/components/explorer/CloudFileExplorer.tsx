'use client';

import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileText,
  Terminal,
  RefreshCw,
  HardDrive,
  ChevronRight,
  ChevronDown,
  Play,
  Eye,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { FileNode, FilePreview } from './types';

interface CloudFileExplorerProps {
  onSendToTerminal: (cmd: string) => void;
}

export const CloudFileExplorer: React.FC<CloudFileExplorerProps> = ({ onSendToTerminal }) => {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [rootDir, setRootDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    'src': true,
    'src/components': true,
    'src/app': true,
  });

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/system/files', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setTree(data.tree);
        setRootDir(data.rootDir);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const openPreview = async (node: FileNode) => {
    setSelectedFile(node);
    setPreview(null);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/system/file-content?path=${encodeURIComponent(node.path)}`, { cache: 'no-store' });
      const data: FilePreview = await res.json();
      setPreview(data);
    } catch (err) {
      setPreview({ success: false, path: node.path, size: 0, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setPreviewLoading(false);
    }
  };

  const toggleFolder = (path: string) => {
    setOpenFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const renderFileNode = (node: FileNode, level = 0) => {
    const isOpen = openFolders[node.path] !== false;

    if (node.isDir) {
      return (
        <div key={node.path} className="select-none">
          <div
            onClick={() => toggleFolder(node.path)}
            className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-800/60 cursor-pointer text-xs text-slate-300 font-mono transition"
            style={{ paddingLeft: `${level * 16 + 8}px` }}
          >
            {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
            {isOpen ? <FolderOpen className="w-4 h-4 text-sky-400" /> : <Folder className="w-4 h-4 text-sky-400" />}
            <span className="font-semibold text-white">{node.name}/</span>
          </div>

          {isOpen && node.children && (
            <div>
              {node.children.map((child) => renderFileNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    const isCode = node.name.endsWith('.tsx') || node.name.endsWith('.ts') || node.name.endsWith('.js') || node.name.endsWith('.json') || node.name.endsWith('.mjs') || node.name.endsWith('.py') || node.name.endsWith('.css');
    const isSelected = selectedFile?.path === node.path;

    return (
      <div
        key={node.path}
        onClick={() => {
          if (node.truncated) return;
          openPreview(node);
        }}
        className={`flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer text-xs font-mono transition group ${
          isSelected ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'hover:bg-slate-800/40 text-slate-300 border border-transparent'
        }`}
        style={{ paddingLeft: `${level * 16 + 24}px` }}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {node.truncated ? (
            <span className="text-slate-500 shrink-0">…</span>
          ) : isCode ? (
            <FileCode className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          ) : (
            <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500 group-hover:text-slate-400 shrink-0">
          <span>{formatFileSize(node.size)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <HardDrive className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-white text-base">工作区文件系统探针 (Workspace Tree)</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 truncate max-w-[220px]">
                {rootDir || '/home/z/my-project'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              透视 Agent 与你共同的工作目录；点击文件即可内联预览内容（无需离开页面）
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchFiles}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition cursor-pointer"
            title="刷新目录树"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSendToTerminal('ls -lah')}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            在终端查看 (ls -lah)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* File Tree Left Column */}
        <div className="lg:col-span-2 bg-slate-950/70 border border-slate-800 rounded-xl p-3 max-h-[520px] overflow-y-auto">
          <div className="text-[11px] text-slate-500 font-mono mb-2 px-2 pb-1 border-b border-slate-900">
            ROOT: {rootDir || '/home/z/my-project'}
          </div>
          {loading && <div className="px-2 py-6 text-center text-xs text-slate-500">目录树加载中…</div>}
          {tree.map((node) => renderFileNode(node))}
        </div>

        {/* Selected File Details / Inline Preview Right Column */}
        <div className="lg:col-span-3 bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col min-h-[420px]">
          {selectedFile ? (
            <div className="flex flex-col h-full space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <FileCode className="w-5 h-5 text-sky-400 shrink-0" />
                <div className="truncate min-w-0 flex-1">
                  <div className="font-bold text-white text-sm truncate">{selectedFile.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{selectedFile.path}</div>
                </div>
                <button
                  onClick={() => openPreview(selectedFile)}
                  className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition shrink-0"
                  title="重新加载"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                <span>大小: <span className="text-white">{formatFileSize(selectedFile.size)}</span></span>
                <span>修改: <span className="text-white text-[11px]">
                  {selectedFile.mtime ? new Date(selectedFile.mtime).toLocaleString() : 'N/A'}
                </span></span>
                {preview?.lines !== undefined && <span>行数: <span className="text-white">{preview.lines}</span></span>}
                {preview?.truncated && <span className="text-amber-400">已截断至 200KB</span>}
              </div>

              {/* Inline Preview Area */}
              <div className="flex-1 min-h-0 bg-black/50 rounded-xl border border-slate-800/60 overflow-hidden flex flex-col">
                {previewLoading ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> 正在读取云端文件…
                  </div>
                ) : preview?.success ? (
                  <pre className="flex-1 overflow-auto p-3 text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap break-all max-h-[380px]">
                    {preview.content}
                  </pre>
                ) : preview ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8 text-xs text-slate-400">
                    <AlertTriangle className="w-6 h-6 text-amber-400 mb-2" />
                    {preview.error || '该文件无法预览'}
                    <button
                      onClick={() => onSendToTerminal(`file "${selectedFile.path}" || xxd "${selectedFile.path}" | head -n 4`)}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Play className="w-3 h-3 text-amber-400" />
                      用终端工具检查此文件
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-500">准备预览…</div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => onSendToTerminal(`cat "${selectedFile.path}" | head -n 40`)}
                  className="flex-1 py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
                >
                  <Play className="w-3.5 h-3.5" />
                  在终端 cat 此文件
                </button>
                <button
                  onClick={() => onSendToTerminal(`wc -l "${selectedFile.path}" && ls -lah "${selectedFile.path}"`)}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  统计信息
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12 text-slate-500 text-xs px-6">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              点击左侧任意文件，即可在此内联预览云端真实内容
              <span className="mt-2 text-[11px] text-slate-600">支持 ≤200KB 的文本文件；二进制文件会给出终端探查建议</span>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-slate-800/60 text-[11px] text-slate-500">
            提示：工作区内所有文件均支持实时修改并触发 Next.js 热重载。
          </div>
        </div>
      </div>
    </div>
  );
};
