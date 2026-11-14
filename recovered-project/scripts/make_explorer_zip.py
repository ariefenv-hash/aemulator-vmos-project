#!/usr/bin/env python3
"""make_explorer_zip.py — 打包 Cloud Sandbox Explorer (Next.js 适配版) 源码为 ZIP。

输出: /tmp/cloud-sandbox-explorer-next.zip
stdout: JSON 摘要 (filename/zipSize/uncompressedSize/fileCount/sha256/files)
"""
import hashlib
import json
import os
import zipfile
from datetime import datetime, timezone

WORKSPACE = "/home/z/my-project"
OUT = "/tmp/cloud-sandbox-explorer-next.zip"

MANIFEST = [
    "src/app/page.tsx",
    "src/app/layout.tsx",
    "src/components/explorer/types.ts",
    "src/components/explorer/capabilitiesData.ts",
    "src/components/explorer/ExplorerApp.tsx",
    "src/components/explorer/CloudCockpit.tsx",
    "src/components/explorer/TerminalView.tsx",
    "src/components/explorer/CloudProcessMonitor.tsx",
    "src/components/explorer/CloudFileExplorer.tsx",
    "src/components/explorer/CloudBenchmarkModal.tsx",
    "src/components/explorer/ScriptPlayground.tsx",
    "src/components/explorer/CapabilityCard.tsx",
    "src/components/explorer/FaqSection.tsx",
    "src/components/explorer/ExportDeployView.tsx",
    "src/components/explorer/AgentLiveFeed.tsx",
    "src/app/api/system/full-overview/route.ts",
    "src/app/api/system/processes/route.ts",
    "src/app/api/system/files/route.ts",
    "src/app/api/system/file-content/route.ts",
    "src/app/api/terminal/execute/route.ts",
    "src/app/api/benchmark/run/route.ts",
    "src/app/api/project/zip-info/route.ts",
    "src/app/api/download/project-zip/route.ts",
    "src/app/api/agent/activity/route.ts",
    "src/lib/explorer-server.ts",
    "src/lib/agent-log.ts",
    "scripts/agent-log.mjs",
    "scripts/make_explorer_zip.py",
    "package.json",
    "next.config.ts",
    "tsconfig.json",
]

def main():
    files = []
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        for rel in MANIFEST:
            full = os.path.join(WORKSPACE, rel)
            if not os.path.isfile(full):
                continue
            zf.write(full, arcname=os.path.join("cloud-sandbox-explorer-next", rel))
            files.append({"name": rel, "size": os.path.getsize(full)})

    zip_size = os.path.getsize(OUT)
    uncompressed = sum(f["size"] for f in files)
    h = hashlib.sha256()
    with open(OUT, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)

    print(json.dumps({
        "filename": os.path.basename(OUT),
        "zipSize": zip_size,
        "uncompressedSize": uncompressed,
        "fileCount": len(files),
        "sha256": h.hexdigest(),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "files": files,
    }, ensure_ascii=False))

if __name__ == "__main__":
    main()
