'use client';

import React, { useState } from 'react';
import {
  Zap,
  Cpu,
  Loader2,
  Play,
  Clock,
  X,
} from 'lucide-react';
import { BenchmarkResult } from './types';

interface CloudBenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToTerminal: (cmd: string) => void;
}

export const CloudBenchmarkModal: React.FC<CloudBenchmarkModalProps> = ({ isOpen, onClose, onSendToTerminal }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const runBenchmark = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/benchmark/run', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Benchmark execution failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">云端真实算力基准测试 (Live Compute Benchmark)</h3>
              <p className="text-xs text-slate-400">实测本沙箱容器 CPU 的浮点与三角函数密集运算性能</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-300 leading-relaxed">
            该测试将在当前沙箱容器中实时执行：
            <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-400 font-mono">
              <li><strong>Node.js (V8) 引擎:</strong> 2,000,000 次浮点与三角函数密集运算</li>
              <li><strong>Python 3 解释器:</strong> 1,000,000 次数学迭代与循环处理（真实子进程）</li>
            </ul>
          </div>

          {/* Action Button */}
          <div className="flex justify-center">
            <button
              onClick={runBenchmark}
              disabled={isRunning}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-600 hover:from-purple-500 hover:to-sky-500 text-white font-bold text-sm shadow-xl shadow-purple-900/30 transition cursor-pointer flex items-center gap-2.5 disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>正在云端容器执行算力测试...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>立即启动算力全检 (Run Live Benchmark)</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900/50 text-rose-300 text-xs">
              测试异常: {error}
            </div>
          )}

          {/* Result Cards */}
          {result && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Node benchmark */}
                <div className="bg-slate-950/90 border border-purple-500/30 rounded-xl p-4">
                  <div className="flex items-center justify-between text-xs text-purple-400 font-semibold mb-1">
                    <span>Node.js V8 引擎</span>
                    <span className="font-mono text-white text-base">{result.nodeBench.durationMs} ms</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {result.nodeBench.operations}
                  </div>
                  <div className="mt-2 text-[10px] text-slate-500 font-mono">
                    V8 堆内存使用: {result.nodeBench.v8HeapUsedMB} MB
                  </div>
                </div>

                {/* Python benchmark */}
                <div className="bg-slate-950/90 border border-sky-500/30 rounded-xl p-4">
                  <div className="flex items-center justify-between text-xs text-sky-400 font-semibold mb-1">
                    <span>Python 3 解释器</span>
                    <span className="font-mono text-white text-base">{result.pythonBench.durationMs} ms</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {result.pythonBench.operations}
                  </div>
                  <div className="mt-2 text-[10px] text-slate-500 font-mono">
                    Python 真实进程执行开销包含启动解析
                  </div>
                </div>
              </div>

              {/* Hardware Spec Summary */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs text-slate-300 font-mono">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  <span>{result.cpuModel} ({result.coreCount} 核心)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>总执行周期: {result.totalDurationMs} ms</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>测试结果直接来自于当前 Z.ai 沙箱容器</span>
          <button
            onClick={() => {
              onClose();
              onSendToTerminal('node -e "const t0=Date.now(); for(let i=0;i<1e7;i++){}; console.log(\'10M Loop Took:\', Date.now()-t0+\'ms\')"');
            }}
            className="text-sky-400 hover:text-sky-300 font-mono cursor-pointer"
          >
            在终端自定义测试 &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
