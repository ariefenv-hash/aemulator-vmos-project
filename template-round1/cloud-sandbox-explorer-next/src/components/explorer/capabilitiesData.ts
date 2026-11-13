import { CapabilityCategory, CodeSnippet, SystemSpec } from './types';

export const SYSTEM_SPECS: SystemSpec[] = [
  {
    label: '操作系统内核 (OS & Kernel)',
    value: 'Linux 容器沙箱 / x86_64',
    detail: '隔离化云沙箱，具备完整的 POSIX 兼容性与真实文件系统',
    status: 'active',
  },
  {
    label: '命令行解释器 (Shell)',
    value: 'GNU Bash (/usr/bin/bash)',
    detail: '原生支持管道 (|)、重定向 (> / >>)、子进程与自动化脚本',
    status: 'active',
  },
  {
    label: 'JavaScript/TypeScript 引擎',
    value: 'Node.js + bun 运行时',
    detail: '预装 bun 与 npm，Next.js 16 App Router 热重载开发服务',
    status: 'active',
  },
  {
    label: 'Python 解释器',
    value: 'Python 3 (/usr/bin/python3)',
    detail: '支持 Python 标准库、数据处理、自动化脚本与单行计算',
    status: 'active',
  },
  {
    label: '开发与打包工具链',
    value: 'Next.js 16 + Tailwind CSS 4',
    detail: 'React 19 + App Router API Routes + shadcn/ui 组件库',
    status: 'active',
  },
  {
    label: '网络与外部通信',
    value: 'Curl, Fetch, Git CLI',
    detail: '支持对公共开放 REST API、HTTPS 资源的请求与拉取（部分外网受限）',
    status: 'supported',
  },
];

export const CAPABILITY_CATEGORIES: CapabilityCategory[] = [
  {
    id: 'shell-core',
    title: '系统底层与 Linux 实用工具',
    shortDesc: '执行任意标准的 Linux 命令、管道流转、文本过滤与文件管理',
    icon: 'Terminal',
    badge: 'Linux Core',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    features: [
      {
        name: '文件与目录探查',
        description: '高自由度操作目录结构，使用 ls、find、tree、cat、head、tail 快速定位与分析文件。',
        exampleCmd: 'ls -lah --color=never && pwd',
        expectedOutput: 'total 200K\ndrwxr-xr-x ... .\ndrwxr-xr-x ... ..\n-rw-r--r-- 1 z z  43K worklog.md\n-rw-r--r-- 1 z z 1.2K package.json\n/home/z/my-project',
        tip: '支持绝对路径与相对路径，结合 grep 可快速过滤指定扩展名。',
      },
      {
        name: '文本流与管道协同 (Piping)',
        description: '结合 grep、awk、sed、sort、uniq、wc 等工具链实现强大的数据清洗与文本处理。',
        exampleCmd: 'cat package.json | grep -E "name|version|next" | head -n 4',
        expectedOutput: '"name": "nextjs_tailwind_shadcn_ts",\n"version": "0.2.1",\n"next": "^16.1.1",\n"react": "^19.0.0",',
        tip: '多命令可以通过管道 | 连续串联，也可以使用 && 实现前置成功后继执行。',
      },
      {
        name: '硬件架构与环境探测',
        description: '获取 CPU 构架、Linux 发行版版本号、环境变量及系统负载。',
        exampleCmd: 'uname -srm && cat /etc/os-release | head -n 2',
        expectedOutput: 'Linux x86_64\nPRETTY_NAME="Debian GNU/Linux 12 (bookworm)"\nNAME="Debian GNU/Linux"',
        tip: '沙箱在受控的高性能云容器中安全运行，工作区为 /home/z/my-project。',
      },
    ],
  },
  {
    id: 'runtimes',
    title: '多语言运行时与脚本执行',
    shortDesc: '开箱即用的 Node.js、bun 工具链以及 Python 3 解释器',
    icon: 'Code2',
    badge: 'Runtimes',
    badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    features: [
      {
        name: 'Node.js 动态计算与单行执行',
        description: '无需写文件，直接通过 node -e 运行现代 JavaScript，支持加密哈希、数学计算和 JSON 处理。',
        exampleCmd: 'node -e "console.log(JSON.stringify({ runtime: process.version, memory: Math.round(process.memoryUsage().heapUsed/1024/1024) + \'MB\', timestamp: new Date().toISOString() }, null, 2))"',
        expectedOutput: '{\n  "runtime": "v22.x.x",\n  "memory": "9MB",\n  "timestamp": "2026-11-07T…Z"\n}',
        tip: 'Node 22 原生支持顶层 await 和 ECMAScript 最新规范。',
      },
      {
        name: 'Python 3 算法与数据处理',
        description: '利用 Python 3 执行算法、数学矩阵、文本统计与系统自动化任务。',
        exampleCmd: 'python3 -c "import sys, math; print(f\'Python {sys.version.split()[0]} | Pi: {math.pi:.6f} | Factorial 10: {math.factorial(10)}\')"',
        expectedOutput: 'Python 3.11.x | Pi: 3.141593 | Factorial 10: 3628800',
        tip: '支持标准模块如 sys, os, json, math, re, urllib, collections 等。',
      },
      {
        name: 'bun / npm 依赖管理',
        description: '可动态安装海量开源依赖库，支持 TypeScript 编译与语法检测。',
        exampleCmd: 'bun --version && node -v && python3 --version',
        expectedOutput: '1.2.x\nv22.x.x\nPython 3.11.x',
        tip: '本项目通过 bun 管理依赖，安装新包后 Next.js 热重载立即可用。',
      },
    ],
  },
  {
    id: 'tasks-processes',
    title: '后台任务与进程生命周期',
    shortDesc: '支持长驻开发服务、mini-services 后台微服务与进程监视',
    icon: 'Cpu',
    badge: 'Process & Tasks',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    features: [
      {
        name: '常驻开发服务 (Dev Server)',
        description: 'Next.js dev server 常驻 3000 端口，文件保存即热重载，编译日志实时写入 dev.log。',
        exampleCmd: 'ps aux | grep -E "next|bun" | grep -v grep',
        expectedOutput: 'z  1234  1.2  1.8  … next-server\\nbun run dev …',
        tip: '行动直播页的 dev.log 尾巴可以实时看到编译与服务日志。',
      },
      {
        name: 'mini-services 微服务',
        description: '可在 mini-services/ 目录下挂载独立 bun 微服务（如 socket.io 实时服务），经 Caddy 网关用 XTransformPort 转发访问。',
        exampleCmd: 'ls mini-services/ 2>/dev/null || echo "(尚未挂载微服务)"',
        expectedOutput: '(尚未挂载微服务)',
        tip: '前端一律以相对路径 + ?XTransformPort=端口 访问，禁止直写 localhost。',
      },
      {
        name: '进程快照与资源追踪',
        description: '实时读取容器进程表，按 CPU 排序，定位最耗资源的任务。',
        exampleCmd: 'ps -eo pid,user,%cpu,%mem,comm --sort=-%cpu | head -n 6',
        expectedOutput: 'PID USER %CPU %MEM COMMAND\n1   root 0.0  0.1  init\n…',
        tip: '进程监视页每 4 秒自动刷新一次快照。',
      },
    ],
  },
  {
    id: 'fullstack-web',
    title: '全栈 Web 开发与实时预览',
    shortDesc: 'Next.js 16 App Router：前端页面 + API Routes + Prisma 数据库一体化',
    icon: 'Layers',
    badge: 'Full Stack',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    features: [
      {
        name: 'App Router API Routes',
        description: '在 src/app/api/**/route.ts 中编写后端接口，本工作台的全部遥测/终端/文件 API 即由此实现。',
        exampleCmd: 'find src/app/api -name route.ts | sort',
        expectedOutput: 'src/app/api/agent/activity/route.ts\nsrc/app/api/benchmark/run/route.ts\n…（共 9 组路由）',
        tip: 'API 与页面同进程部署，无跨域问题，统一走 3000 网关。',
      },
      {
        name: 'Prisma + SQLite 持久化',
        description: '项目内置 Prisma ORM 与 SQLite，可定义 schema 后 db:push 即得数据库（本工作台未用到，属可扩展位）。',
        exampleCmd: 'cat prisma/schema.prisma 2>/dev/null | head -n 8',
        expectedOutput: 'generator client {\n  provider = "prisma-client-js"\n}\n…',
        tip: '适合为工作台扩展「任务收藏」「命令历史持久化」等能力。',
      },
      {
        name: 'Tailwind CSS 4 极速渲染',
        description: '集成最新版 Tailwind CSS 引擎，支持即时编译与零配置实用类名。',
        exampleCmd: 'echo "Tailwind v4: Zero config @import \\"tailwindcss\\"; loaded"',
        expectedOutput: 'Tailwind v4: Zero config @import "tailwindcss"; loaded',
        tip: '结合 framer-motion 可实现丝滑的流畅交互动效。',
      },
    ],
  },
  {
    id: 'agent-live',
    title: 'Agent 协作与行动直播（本沙箱特有）',
    shortDesc: 'AI Agent 与你在同一工作区协作：动作日志、文件改动流、终端联动',
    icon: 'Database',
    badge: 'Agent Live',
    badgeColor: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    features: [
      {
        name: '行动日志通道 (JSONL)',
        description: 'Agent 的每个关键动作经 scripts/agent-log.mjs 追加写入 agent-log.jsonl，行动直播页 3 秒轮询渲染。',
        exampleCmd: 'tail -n 3 agent-log.jsonl',
        expectedOutput: '{"ts":"…","source":"agent","category":"build","title":"…","detail":"…"}',
        tip: '你也能在网页终端执行命令，动作会以 terminal 来源出现在同一时间线。',
      },
      {
        name: '文件改动信号流',
        description: '行动直播页每 3 秒扫描工作区 mtime，45 分钟内被创建/修改的文件自动出现在「最近改动」栏。',
        exampleCmd: 'find src -newer agent-log.jsonl -type f 2>/dev/null | head -n 5',
        expectedOutput: 'src/components/explorer/…\nsrc/app/api/…',
        tip: '无需任何手动上报，Agent 写完文件你立刻能看到。',
      },
      {
        name: '内联文件预览',
        description: '文件树页点击任意文本文件即可就地预览内容（≤200KB），也可一键推送到终端 cat。',
        exampleCmd: 'curl -s "localhost:3000/api/system/file-content?path=package.json" | head -c 120',
        expectedOutput: '{"success":true,"path":"package.json","name":"package.json","size":…',
        tip: '路径经服务端白名单校验，越出工作区直接 403。',
      },
    ],
  },
];

export const PLAYGROUND_SNIPPETS: CodeSnippet[] = [
  {
    id: 'bash-bench',
    title: '系统硬件与进程探针 (Bash)',
    language: 'bash',
    description: '查看 CPU 架构、系统负载、内存用量及主要已安装运行时工具',
    code: `echo "=== 系统信息汇总 ==="
uname -a
echo ""
echo "=== 核心工具探测 ==="
which bash node python3 git curl | xargs -n 1 ls -lh
echo ""
echo "=== 内存状态概览 ==="
free -h 2>/dev/null || cat /proc/meminfo | head -n 4`,
    output: `=== 系统信息汇总 ===
Linux sandbox 6.x #1 SMP x86_64 GNU/Linux

=== 核心工具探测 ===
-rwxr-xr-x 1 z z 1.4M /usr/bin/bash
-rwxr-xr-x 1 z z 105M /usr/local/bin/node
-rwxr-xr-x 1 z z 5.8M /usr/bin/python3
-rwxr-xr-x 1 z z 3.6M /usr/bin/git
-rwxr-xr-x 1 z z 280K /usr/bin/curl

=== 内存状态概览 ===
MemTotal:       4036180 kB
MemFree:        2210300 kB
MemAvailable:   3105400 kB`,
  },
  {
    id: 'node-json',
    title: '并发异步与 JSON 数据流水线 (Node.js)',
    language: 'javascript',
    description: '利用 Node.js 现代异步 API 处理虚拟数据流并计算聚合哈希',
    code: `const crypto = require('crypto');

const mockTasks = [
  { id: 101, name: 'Compile Applet', status: 'completed', durationMs: 420 },
  { id: 102, name: 'Lint TypeScript', status: 'passed', durationMs: 180 },
  { id: 103, name: 'Sync File Tree', status: 'completed', durationMs: 95 },
  { id: 104, name: 'Launch Dev Server', status: 'running', durationMs: 650 }
];

const totalTime = mockTasks.reduce((acc, cur) => acc + cur.durationMs, 0);
const checksum = crypto.createHash('sha256').update(JSON.stringify(mockTasks)).digest('hex').slice(0, 16);

console.log('✅ 任务批次聚合完成:');
console.log('总耗时:', totalTime + 'ms');
console.log('平均耗时:', (totalTime / mockTasks.length).toFixed(1) + 'ms');
console.log('数据校验指纹 (SHA-256):', checksum);
console.log('运行环境:', process.version, process.platform, process.arch);`,
    output: `✅ 任务批次聚合完成:
总耗时: 1345ms
平均耗时: 336.2ms
数据校验指纹 (SHA-256): 9b4a1f8e32c0d571
运行环境: v22.x.x linux x64`,
  },
  {
    id: 'python-calc',
    title: '算法与统计学指标分析 (Python 3)',
    language: 'python',
    description: '使用 Python 3 标准库计算中位数、方差与素数生成',
    code: `import statistics
import math

scores = [88.5, 92.0, 79.5, 95.0, 84.0, 91.5, 98.0, 89.0]

mean_val = statistics.mean(scores)
median_val = statistics.median(scores)
stdev_val = statistics.stdev(scores)

def is_prime(n):
    if n < 2: return False
    for i in range(2, int(math.isqrt(n)) + 1):
        if n % i == 0: return False
    return True

primes_under_50 = [x for x in range(2, 50) if is_prime(x)]

print(f"样本数量: {len(scores)}")
print(f"平均分 (Mean): {mean_val:.2f}")
print(f"中位数 (Median): {median_val:.2f}")
print(f"标准差 (StdDev): {stdev_val:.2f}")
print(f"50以内的素数列表: {primes_under_50}")`,
    output: `样本数量: 8
平均分 (Mean): 89.69
中位数 (Median): 90.25
标准差 (StdDev): 5.86
50以内的素数列表: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]`,
  },
];

export const TERMINAL_FAQS = [
  {
    question: '这个终端环境是真实运行的容器还是假模拟？',
    answer: '这是真实的 Z.ai 云沙箱 Linux 容器环境（工作区 /home/z/my-project）。你在终端中执行的 Linux 命令、Node.js 脚本、Python 代码均会在真实运行环境中执行，具有真实的文件读写、进程创建与依赖安装能力——左侧进程监视器里出现的 ps 快照就是证据。',
  },
  {
    question: '终端能安装新的系统软件或第三方库吗？',
    answer: '对于应用依赖，可以通过 bun add / npm install 安装 Node.js / TypeScript 生态的开源库（React UI、数据可视化、图形渲染等）。容器预装了 bash、git、curl、python3、node、bun 等核心工具；系统级 apt 安装受沙箱策略限制，普通命令不支持交互式 sudo 密码输入。',
  },
  {
    question: '终端能否访问互联网或调用外部 API？',
    answer: '可以，但有白名单限制。curl、原生 fetch 或 axios 等网络库能访问大多数公共 HTTPS REST API 与开放数据源；个别域名可能因沙箱出口策略超时（例如部分云厂商内网校验地址）。测试网络连通性可用「网络状态」快捷指令。',
  },
  {
    question: '能运行长时间的后台进程（如 Web 服务器）吗？',
    answer: '支持。Next.js dev server 本身就常驻 3000 端口对外提供预览；你也可以在 mini-services/ 目录挂载独立 bun 微服务（自带端口），经 Caddy 网关以相对路径 + XTransformPort 参数访问。注意：普通终端命令有 15 秒超时，超长任务建议以 nohup 后台方式运行。',
  },
  {
    question: '这个终端对文件有什么读写限制？',
    answer: '工作区 /home/z/my-project 内拥有完全的读写、修改、重命名与创建权限，编写的代码、组件、样式会立即被 Next.js 热重载感知。文件树探针与内联预览经服务端路径校验，越出工作区的访问会被 403 拒绝；upload/ 是上传目录，download/ 用于交付产物。',
  },
  {
    question: '「Agent 行动直播」是怎么做到实时显示 AI 动作的？',
    answer: '三层信号叠加：① Agent 在完成每个关键步骤时调用 scripts/agent-log.mjs 把动作写入 agent-log.jsonl；② 行动直播页每 3 秒扫描工作区 mtime，把最近修改的文件列出来；③ dev.log 尾部实时展示 Next.js 编译日志。三路信号共同构成完整的行动画面，无需刷新页面。',
  },
];
