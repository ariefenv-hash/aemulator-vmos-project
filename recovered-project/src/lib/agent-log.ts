/**
 * agent-log.ts — Agent 行动日志（服务端 canonical 实现）
 * JSONL 通道：<WORKSPACE>/agent-log.jsonl，前端行动直播页轮询展示。
 * CLI 版本：scripts/agent-log.mjs（供 Agent 在 Bash 中随手调用，格式一致）。
 */
import fs from 'fs';
import path from 'path';

export const AGENT_LOG_PATH = path.join('/home/z/my-project', 'agent-log.jsonl');

export type AgentActionCategory = 'probe' | 'build' | 'fix' | 'verify' | 'deliver' | 'note';
export type AgentActionSource = 'agent' | 'terminal' | 'system';

export interface AgentAction {
  ts: string;
  source: AgentActionSource;
  category: AgentActionCategory;
  title: string;
  detail: string;
}

const VALID_CATEGORIES: AgentActionCategory[] = ['probe', 'build', 'fix', 'verify', 'deliver', 'note'];
const VALID_SOURCES: AgentActionSource[] = ['agent', 'terminal', 'system'];

export function logAction(opts: {
  category?: string;
  source?: string;
  title?: string;
  detail?: string;
}): AgentAction {
  const category = (VALID_CATEGORIES as string[]).includes(opts.category || '')
    ? (opts.category as AgentActionCategory)
    : 'note';
  const source = (VALID_SOURCES as string[]).includes(opts.source || '')
    ? (opts.source as AgentActionSource)
    : 'agent';
  const entry: AgentAction = {
    ts: new Date().toISOString(),
    source,
    category,
    title: String(opts.title || '').slice(0, 160),
    detail: String(opts.detail || '').slice(0, 1200),
  };
  try {
    fs.mkdirSync(path.dirname(AGENT_LOG_PATH), { recursive: true });
    fs.appendFileSync(AGENT_LOG_PATH, JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // 日志失败不影响主流程
  }
  return entry;
}

export function readActions(limit = 60): AgentAction[] {
  try {
    if (!fs.existsSync(AGENT_LOG_PATH)) return [];
    const raw = fs.readFileSync(AGENT_LOG_PATH, 'utf8');
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);
    const parsed: AgentAction[] = [];
    for (const line of lines.slice(-limit * 3)) {
      try {
        const obj = JSON.parse(line);
        if (obj && typeof obj.ts === 'string') parsed.push(obj as AgentAction);
      } catch {
        // 跳过损坏行
      }
    }
    return parsed.slice(-limit).reverse();
  } catch {
    return [];
  }
}
