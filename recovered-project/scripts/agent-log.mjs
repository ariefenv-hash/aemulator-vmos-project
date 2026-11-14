#!/usr/bin/env node
/**
 * agent-log.mjs — Agent 行动日志记录器
 *
 * 把 Agent(我) 的每一个关键动作追加写入 <workspace>/agent-log.jsonl，
 * 前端「Agent 行动直播」页签通过 /api/agent/activity 轮询此文件实时展示。
 *
 * 用法:
 *   node scripts/agent-log.mjs --category build --title "编写遥测 API" --detail "src/app/api/system/..."
 *
 * category: probe | build | fix | verify | deliver | note
 * source  : agent(默认) | terminal | system
 */
import fs from 'node:fs';
import path from 'node:path';

const WORKSPACE = '/home/z/my-project';
const LOG_PATH = path.join(WORKSPACE, 'agent-log.jsonl');
const VALID_CATEGORIES = ['probe', 'build', 'fix', 'verify', 'deliver', 'note'];
const VALID_SOURCES = ['agent', 'terminal', 'system'];

function parseArgs(argv) {
  const args = { category: 'note', source: 'agent', title: '', detail: '' };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--category' || key === '-c') args.category = argv[++i] ?? 'note';
    else if (key === '--source' || key === '-s') args.source = argv[++i] ?? 'agent';
    else if (key === '--title' || key === '-t') args.title = argv[++i] ?? '';
    else if (key === '--detail' || key === '-d') args.detail = argv[++i] ?? '';
  }
  return args;
}

function append(entry) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n', 'utf8');
}

export function logAction({ category = 'note', source = 'agent', title = '', detail = '' }) {
  const cat = VALID_CATEGORIES.includes(category) ? category : 'note';
  const src = VALID_SOURCES.includes(source) ? source : 'agent';
  const entry = {
    ts: new Date().toISOString(),
    source: src,
    category: cat,
    title: String(title).slice(0, 160),
    detail: String(detail).slice(0, 1200),
  };
  try {
    append(entry);
  } catch {
    // 日志失败不影响主流程
  }
  return entry;
}

// 读取最近 N 条（新增在前）
export function readActions(limit = 60) {
  try {
    if (!fs.existsSync(LOG_PATH)) return [];
    const raw = fs.readFileSync(LOG_PATH, 'utf8');
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);
    const parsed = [];
    for (const line of lines.slice(-limit * 3)) {
      try {
        const obj = JSON.parse(line);
        if (obj && typeof obj.ts === 'string') parsed.push(obj);
      } catch {
        // 跳过损坏行
      }
    }
    return parsed.slice(-limit).reverse();
  } catch {
    return [];
  }
}

// ---- CLI 入口 ----
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.url.replace('file://', ''))) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.title) {
    console.error('Usage: node scripts/agent-log.mjs --title "..." [--category build] [--detail "..."]');
    process.exit(1);
  }
  const entry = logAction(args);
  console.log(JSON.stringify(entry));
}
