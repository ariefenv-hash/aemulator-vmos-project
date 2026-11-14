#!/bin/bash
# apk-job-runner.sh — APK 反编译后台作业执行器
# 用法: apk-job-runner.sh <jobId> <metaJson路径> <exitCodeFile> <logFile> <command...>
# 在后台分离运行：stdout/stderr 追加写入 logFile，结束时写入 exit code 并把 meta 状态置为 done
set -u
JOB_ID="$1"; META_FILE="$2"; EXIT_FILE="$3"; LOG_FILE="$4"
shift 4

echo "[$(date '+%H:%M:%S')] 任务 $JOB_ID 开始执行: $*" >> "$LOG_FILE"

start_ts=$(date +%s)
"$@" >> "$LOG_FILE" 2>&1
code=$?
end_ts=$(date +%s)

echo "$code" > "$EXIT_FILE"
echo "[$(date '+%H:%M:%S')] 任务 $JOB_ID 结束，exit=$code，耗时 $((end_ts - start_ts))s" >> "$LOG_FILE"

# 更新 meta 状态（jadx exit=3 表示部分类反编译告警，产物依然有效，计为完成）
if [ "$code" = "3" ]; then
  STATUS="done"
elif [ "$code" = "0" ]; then
  STATUS="done"
else
  STATUS="failed"
fi

if command -v python3 >/dev/null 2>&1; then
  python3 - "$META_FILE" "$code" "$STATUS" "$start_ts" "$end_ts" <<'PYEOF'
import json, sys, os
meta_path, code, status, start_ts, end_ts = sys.argv[1], int(sys.argv[2]), sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
try:
    with open(meta_path) as f:
        meta = json.load(f)
    meta['status'] = status
    meta['exitCode'] = code
    meta['finishedAt'] = end_ts
    meta['durationSec'] = end_ts - start_ts
    if code == 3:
        meta['note'] = 'jadx 部分类反编译告警，产物仍有效'
    tmp = meta_path + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(meta, f, ensure_ascii=False)
    os.replace(tmp, meta_path)
except Exception as e:
    print('meta update failed:', e)
PYEOF
fi
