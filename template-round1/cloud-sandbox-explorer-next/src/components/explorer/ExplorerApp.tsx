'use client';

import React, { useState } from 'react';
import {
  Terminal,
  Layers,
  HelpCircle,
  Code2,
  Server,
  Activity,
  HardDrive,
  Zap,
  Radar,
  FolderArchive,
  Download,
  Bot,
} from 'lucide-react';
import { TerminalView } from './TerminalView';
import { CloudCockpit } from './CloudCockpit';
import { CloudProcessMonitor } from './CloudProcessMonitor';
import { CloudFileExplorer } from './CloudFileExplorer';
import { CloudBenchmarkModal } from './CloudBenchmarkModal';
import { ScriptPlayground } from './ScriptPlayground';
import { FaqSection } from './FaqSection';
import { CapabilityCard } from './CapabilityCard';
import { ExportDeployView } from './ExportDeployView';
import { AgentLiveFeed } from './AgentLiveFeed';
import { CAPABILITY_CATEGORIES } from './capabilitiesData';

type TabType = 'agent' | 'cockpit' | 'terminal' | 'deploy' | 'processes' | 'files' | 'capabilities' | 'playground' | 'faq';

const TABS: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'agent', label: 'Agent 行动直播 (Live)', icon: Radar },
  { id: 'cockpit', label: '全景透视中枢 (Cockpit)', icon: Server },
  { id: 'terminal', label: '真实云端终端 (Terminal)', icon: Terminal },
  { id: 'processes', label: '实时进程监视 (Processes)', icon: Activity },
  { id: 'files', label: '工作区文件树 (Files)', icon: HardDrive },
  { id: 'playground', label: '多语言脚本实验室 (Script Lab)', icon: Code2 },
  { id: 'capabilities', label: '能力矩阵大图 (Capabilities)', icon: Layers },
  { id: 'deploy', label: 'ZIP 打包与迁移 (Deploy)', icon: FolderArchive },
  { id: 'faq', label: '常见问答 (FAQ)', icon: HelpCircle },
];

export default function ExplorerApp() {
  const [activeTab, setActiveTab] = useState<TabType>('agent');
  const [externalCommand, setExternalCommand] = useState<string>('');
  const [externalCommandNonce, setExternalCommandNonce] = useState<number>(0);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState(false);

  const handleRunCommand = (cmd: string) => {
    setExternalCommand(cmd);
    setExternalCommandNonce((n) => n + 1);
    setActiveTab('terminal');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20 shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-bold text-base sm:text-lg text-white tracking-tight truncate">
                  云端开发环境全景透视工作台
                </h1>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  ● Z.ai 沙箱直连
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block truncate">
                全景式实时监测内核、硬件算力、文件系统、运行进程、交互终端与 Agent 行动流
              </p>
            </div>
          </div>

          {/* Quick status & download button */}
          <div className="flex items-center gap-2.5 text-xs shrink-0">
            <button
              onClick={() => setActiveTab('agent')}
              className="hidden md:flex px-3 py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 font-medium text-xs transition cursor-pointer flex items-center gap-1.5"
              title="查看 Agent 实时行动"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>看 Agent 在干嘛</span>
            </button>

            <a
              href="/api/download/project-zip"
              download="cloud-sandbox-explorer-next.zip"
              className="hidden sm:flex px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition cursor-pointer items-center gap-1.5 shadow-sm shadow-emerald-900/30"
              title="下载本工作台完整源代码 ZIP 压缩包"
            >
              <Download className="w-3.5 h-3.5" />
              <span>下载 ZIP 包</span>
            </a>

            <button
              onClick={() => setIsBenchmarkOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-medium text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">算力测试</span>
            </button>

            <button
              onClick={() => handleRunCommand('uname -a && cat /etc/os-release')}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>进入终端</span>
            </button>
          </div>
        </div>

        {/* Panoramic Navigation Tabs */}
        <nav aria-label="工作台页签" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto py-1.5 border-t border-slate-900">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Tab 0: Agent Live Feed */}
        {activeTab === 'agent' && (
          <AgentLiveFeed onSendToTerminal={handleRunCommand} />
        )}

        {/* Tab 1: Panoramic Cloud Cockpit */}
        {activeTab === 'cockpit' && (
          <CloudCockpit
            onQuickCommand={handleRunCommand}
            onOpenBenchmark={() => setIsBenchmarkOpen(true)}
          />
        )}

        {/* Tab 2: Live Real Cloud Terminal */}
        {activeTab === 'terminal' && (
          <TerminalView
            key={`terminal-${externalCommandNonce}`}
            externalCommand={externalCommand}
          />
        )}

        {/* Tab 3: Real Process Monitor */}
        {activeTab === 'processes' && (
          <CloudProcessMonitor onSendToTerminal={handleRunCommand} />
        )}

        {/* Tab 4: Real File Explorer */}
        {activeTab === 'files' && (
          <CloudFileExplorer onSendToTerminal={handleRunCommand} />
        )}

        {/* Tab 5: Multi-language Script Playground */}
        {activeTab === 'playground' && (
          <ScriptPlayground onSendToTerminal={handleRunCommand} />
        )}

        {/* Tab 6: Capability Matrix */}
        {activeTab === 'capabilities' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">终端与沙箱工程能力矩阵</h3>
                <p className="text-xs text-slate-400">细化列举本沙箱支持的操作类别、示例命令及对应行为</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {CAPABILITY_CATEGORIES.map((cat) => (
                <CapabilityCard
                  key={cat.id}
                  category={cat}
                  onRunCommand={handleRunCommand}
                />
              ))}
            </div>
          </div>
        )}

        {/* Tab 7: Export & Deploy ZIP Package */}
        {activeTab === 'deploy' && (
          <ExportDeployView />
        )}

        {/* Tab 8: FAQ */}
        {activeTab === 'faq' && (
          <FaqSection />
        )}

      </main>

      {/* Benchmark Modal */}
      <CloudBenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
        onSendToTerminal={handleRunCommand}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span>Cloud Environment Panoramic Cockpit</span>
            <span>•</span>
            <span>Next.js 16 适配版 · 工作区 /home/z/my-project</span>
            <span>•</span>
            <span>Port 3000 Full-Stack API</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/api/download/project-zip"
              download="cloud-sandbox-explorer-next.zip"
              className="text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
            >
              一键下载 ZIP 包
            </a>
            <button
              onClick={() => handleRunCommand('uptime')}
              className="hover:text-slate-300 transition cursor-pointer"
            >
              系统负载探查
            </button>
            <button
              onClick={() => handleRunCommand('node -v && python3 --version && bun --version')}
              className="hover:text-slate-300 transition cursor-pointer"
            >
              运行时规格
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
