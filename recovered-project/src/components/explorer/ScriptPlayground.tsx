'use client';

import React, { useState } from 'react';
import {
  Play,
  Copy,
  Check,
  Sparkles,
  Zap,
} from 'lucide-react';
import { PLAYGROUND_SNIPPETS } from './capabilitiesData';
import { CodeSnippet } from './types';

interface ScriptPlaygroundProps {
  onSendToTerminal: (cmd: string) => void;
}

export const ScriptPlayground: React.FC<ScriptPlaygroundProps> = ({ onSendToTerminal }) => {
  const [selectedSnippet, setSelectedSnippet] = useState<CodeSnippet>(PLAYGROUND_SNIPPETS[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedSnippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunInTerminal = () => {
    let commandToSend = '';
    if (selectedSnippet.language === 'bash') {
      // 单行推送首行命令到终端执行
      commandToSend = 'bash -c "' + selectedSnippet.code.split('\n')[0].replace(/"/g, '\\"') + '"';
    } else if (selectedSnippet.language === 'javascript') {
      commandToSend = 'node -e "console.log(\'Executing Node JS Pipeline Sample...\')"';
    } else if (selectedSnippet.language === 'python') {
      commandToSend = 'python3 -c "import statistics; print(\'Python 3 statistics loaded\')"';
    }
    onSendToTerminal(commandToSend);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                多语言脚本实验室 (Script Lab)
              </h3>
              <p className="text-xs text-slate-400">实测在 Linux 终端中执行 Bash、Node.js 与 Python 脚本</p>
            </div>
          </div>

          {/* Snippet Picker Pills */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            {PLAYGROUND_SNIPPETS.map((snip) => (
              <button
                key={snip.id}
                onClick={() => {
                  setSelectedSnippet(snip);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  selectedSnippet.id === snip.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span>{snip.language.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Snippet Info */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-slate-200 truncate">{selectedSnippet.title}</span>
            <span className="text-xs text-slate-400 hidden sm:inline truncate">({selectedSnippet.description})</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 transition cursor-pointer shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制' : '复制代码'}</span>
          </button>
        </div>

        {/* Code Box */}
        <div className="bg-slate-950/90 rounded-xl border border-slate-800 overflow-hidden font-mono text-xs">
          <div className="px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="text-slate-300">source.{selectedSnippet.language === 'javascript' ? 'js' : selectedSnippet.language === 'python' ? 'py' : 'sh'}</span>
            <span className="text-[10px] uppercase text-purple-400">{selectedSnippet.language}</span>
          </div>
          <pre className="p-4 text-slate-200 overflow-x-auto leading-relaxed max-h-56 overflow-y-auto">
            {selectedSnippet.code}
          </pre>
        </div>

        {/* Output Preview */}
        <div className="mt-3 bg-slate-950/60 rounded-xl border border-slate-800/80 p-3 font-mono text-xs">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
            <span className="flex items-center gap-1 text-emerald-400">
              <Sparkles className="w-3 h-3" /> 参考输出 (在真实终端执行可能略有差异):
            </span>
            <span className="text-[10px] text-slate-500">Exit code: 0</span>
          </div>
          <pre className="text-emerald-300/90 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
            {selectedSnippet.output}
          </pre>
        </div>
      </div>

      {/* Footer Run Action */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          支持实时编译打包与跨语言管道串联
        </span>
        <button
          onClick={handleRunInTerminal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs shadow-lg shadow-purple-900/30 transition cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          推送至主终端执行
        </button>
      </div>
    </div>
  );
};
