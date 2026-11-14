'use client';

import React, { useState } from 'react';
import {
  Terminal,
  Code2,
  Cpu,
  Layers,
  Database,
  Play,
  Info,
  Sparkles,
} from 'lucide-react';
import { CapabilityCategory } from './types';

interface CapabilityCardProps {
  category: CapabilityCategory;
  onRunCommand: (cmd: string) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Terminal: <Terminal className="w-5 h-5" />,
  Code2: <Code2 className="w-5 h-5" />,
  Cpu: <Cpu className="w-5 h-5" />,
  Layers: <Layers className="w-5 h-5" />,
  Database: <Database className="w-5 h-5" />,
};

export const CapabilityCard: React.FC<CapabilityCardProps> = ({ category, onRunCommand }) => {
  const [activeFeatureIdx, setActiveFeatureIdx] = useState(0);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const activeFeature = category.features[activeFeatureIdx] || category.features[0];

  const handleCopy = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 1800);
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg backdrop-blur transition-all flex flex-col justify-between">
      <div>
        {/* Category Header */}
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-sky-400 shadow-inner shrink-0">
              {ICON_MAP[category.icon] || <Terminal className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 text-base flex items-center gap-2">
                {category.title}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{category.shortDesc}</p>
            </div>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border shrink-0 ${category.badgeColor}`}>
            {category.badge}
          </span>
        </div>

        {/* Feature Tabs */}
        <div className="flex gap-1.5 p-1 bg-slate-950/60 rounded-lg border border-slate-800/80 mb-3 overflow-x-auto">
          {category.features.map((feat, idx) => (
            <button
              key={feat.name}
              onClick={() => setActiveFeatureIdx(idx)}
              className={`px-3 py-1.5 text-xs rounded-md font-medium whitespace-nowrap transition cursor-pointer ${
                activeFeatureIdx === idx
                  ? 'bg-slate-800 text-sky-300 shadow-sm border border-slate-700/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {feat.name}
            </button>
          ))}
        </div>

        {/* Active Feature Detail */}
        <div className="space-y-3">
          <p className="text-xs text-slate-300 leading-relaxed min-h-[36px]">
            {activeFeature.description}
          </p>

          {/* Example Command Box */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 relative group">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 pb-1 border-b border-slate-800/60">
              <span className="flex items-center gap-1 font-sans text-sky-400">
                <Sparkles className="w-3 h-3" /> 命令行测试用例
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleCopy(activeFeature.exampleCmd)}
                  className="px-1.5 py-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition text-[10px] cursor-pointer"
                >
                  {copiedCmd === activeFeature.exampleCmd ? '已复制' : '复制命令'}
                </button>
              </div>
            </div>
            <div className="text-sky-300 break-all select-all font-mono py-1">
              $ {activeFeature.exampleCmd}
            </div>

            {/* Expected Output Peek */}
            {activeFeature.expectedOutput && (
              <div className="mt-2 pt-2 border-t border-slate-900 text-[11px] text-slate-400/90 font-mono line-clamp-3 bg-black/40 rounded p-1.5">
                <span className="text-slate-500 text-[10px] block mb-0.5">预估真实输出:</span>
                {activeFeature.expectedOutput}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[11px] text-slate-400 min-w-0">
          <Info className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="truncate">{activeFeature.tip}</span>
        </div>
        <button
          onClick={() => onRunCommand(activeFeature.exampleCmd)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 hover:text-sky-300 border border-sky-500/30 font-medium text-xs transition cursor-pointer shadow-sm hover:shadow shrink-0"
        >
          <Play className="w-3 h-3 fill-sky-400/30" />
          在终端运行
        </button>
      </div>
    </div>
  );
};
