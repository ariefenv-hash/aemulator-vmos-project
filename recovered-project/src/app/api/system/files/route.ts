import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { WORKSPACE_ROOT, EXCLUDED_TOP_DIRS } from '@/lib/explorer-server';

export const dynamic = 'force-dynamic';

interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  mtime: string;
  truncated?: boolean;
  children?: FileNode[];
}

const MAX_CHILDREN = 60;
const SKIP_NAMES = new Set(['node_modules', '.git', '.next', 'dist', '.turbo', '.DS_Store']);

function readDirRecursive(rootDir: string, dir: string, depth: number): FileNode[] {
  if (depth > 3) return [];
  let items: fs.Dirent[];
  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  // 目录在前、文件在后，各自按名称排序
  const dirs = items
    .filter((i) => i.isDirectory() && !SKIP_NAMES.has(i.name) && !EXCLUDED_TOP_DIRS.has(i.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const files = items
    .filter((i) => i.isFile() && !i.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name));

  const nodes: FileNode[] = [];
  for (const item of [...dirs, ...files]) {
    if (nodes.length >= MAX_CHILDREN) {
      nodes.push({
        name: `…（还有 ${items.length - nodes.length} 项未展开）`,
        path: path.join(path.relative(rootDir, dir), '…'),
        isDir: false,
        size: 0,
        mtime: '',
        truncated: true,
      });
      break;
    }
    const fullPath = path.join(dir, item.name);
    const isDir = item.isDirectory();
    const relPath = path.relative(rootDir, fullPath);
    let size = 0;
    let mtime = '';
    try {
      const stat = fs.statSync(fullPath);
      size = stat.size;
      mtime = stat.mtime.toISOString();
    } catch {
      /* ignore */
    }
    nodes.push({
      name: item.name,
      path: relPath,
      isDir,
      size,
      mtime,
      children: isDir ? readDirRecursive(rootDir, fullPath, depth + 1) : undefined,
    });
  }
  return nodes;
}

export async function GET() {
  try {
    const tree = readDirRecursive(WORKSPACE_ROOT, WORKSPACE_ROOT, 0);
    return NextResponse.json({ success: true, rootDir: WORKSPACE_ROOT, tree });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
