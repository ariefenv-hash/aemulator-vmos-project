export type TerminalTheme = 'classic' | 'matrix' | 'amber' | 'dracula' | 'slate';

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system' | 'info';
  content: string;
  timestamp: string;
  durationMs?: number;
}

export interface RealSystemOverview {
  success: boolean;
  timestamp: string;
  host: {
    hostname: string;
    platform: string;
    release: string;
    type: string;
    arch: string;
    uptime: number;
    loadavg: number[];
    uname: string;
    osRelease: string;
  };
  hardware: {
    cpus: { model: string; speed: number }[];
    totalMemBytes: number;
    freeMemBytes: number;
    usedMemBytes: number;
    memInfoSnippet: string;
    disk: {
      filesystem: string;
      total: string;
      used: string;
      available: string;
      usePercent: string;
    };
  };
  runtimes: {
    node: string;
    python: string;
    git: string;
    bun?: string;
    v8: string;
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
  };
  environment: {
    hostname: string;
    platform: string;
    arch: string;
    user: string;
    cwd: string;
    nodeEnv: string;
  };
}

export interface ProcessItem {
  pid: string;
  user: string;
  cpu: string;
  mem: string;
  time: string;
  command: string;
  fullArgs: string;
}

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  mtime: string;
  truncated?: boolean;
  children?: FileNode[];
}

export interface FilePreview {
  success: boolean;
  path: string;
  name?: string;
  size: number;
  truncated?: boolean;
  mtime?: string;
  content?: string;
  lines?: number;
  error?: string;
}

export interface BenchmarkResult {
  success: boolean;
  cpuModel: string;
  coreCount: number;
  nodeBench: {
    operations: string;
    durationMs: number;
    v8HeapUsedMB: number;
  };
  pythonBench: {
    operations: string;
    durationMs: number;
  };
  totalDurationMs: number;
}

export interface CapabilityCategory {
  id: string;
  title: string;
  shortDesc: string;
  icon: string;
  badge: string;
  badgeColor: string;
  features: {
    name: string;
    description: string;
    exampleCmd: string;
    expectedOutput?: string;
    tip: string;
  }[];
}

export interface CodeSnippet {
  id: string;
  title: string;
  language: 'bash' | 'javascript' | 'python';
  code: string;
  description: string;
  output: string;
}

export interface SystemSpec {
  label: string;
  value: string;
  detail: string;
  status: 'active' | 'supported' | 'secured';
}

/* ---- Agent 行动直播 ---- */

export type AgentActionCategory = 'probe' | 'build' | 'fix' | 'verify' | 'deliver' | 'note';
export type AgentActionSource = 'agent' | 'terminal' | 'system';

export interface AgentAction {
  ts: string;
  source: AgentActionSource;
  category: AgentActionCategory;
  title: string;
  detail: string;
}

export interface RecentFileChange {
  path: string;
  name: string;
  size: number;
  mtime: string;
  relativeSec: number;
}

export interface AgentActivity {
  success: boolean;
  serverTime: string;
  boot: {
    hostname: string;
    platform: string;
    processUptimeSec: number;
    pid: number;
  };
  actions: AgentAction[];
  recentFiles: RecentFileChange[];
  devLogTail: string;
}

export interface ZipInfo {
  filename: string;
  zipSize: number;
  uncompressedSize: number;
  fileCount: number;
  sha256: string;
  files: { name: string; size: number }[];
}
