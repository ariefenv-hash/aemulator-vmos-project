# HANDOFF - AEmulator 升级工程 + 虚拟大师(VMOS)逆向工作台 · 全量交接快照

> **本仓库的唯一目的**：任何新对话拿到本仓库地址后，读完本文档即可完整接续工作，无需向用户索要历史背景。
> 生成时间：2026-11-14（北京时间）。生成者：接手第七轮任务的工作会话（沙盒重置后的首个会话）。

---

## 0. 一页状态总览

| 项目 | 状态 |
| --- | --- |
| 产品逆向分析（虚拟大师 3.2.67 + 安卓12 ROM） | 已完成七轮，结论全部沉淀在 docs/01 |
| AEmulator 升级（root 管理 / Xposed / 模块体系） | 已产出 0.0.0.3 与 0.0.0.4 两版 APK + root-modules-v04 补丁，产物随沙盒重置丢失，需重建 |
| ROM 解密（e=x RC4 体系） | 上一会话已跑通（曾产出 magisk_v27.0_已解密.zip），脚本与产物丢失，方向已验证可复现 |
| 导入 bug（内置导入报"导入失败"） | 修复方向已定：改走 ADB shell + pm install，代码未落地 |
| ROM 改版后网络丢失（回归 bug） | 症状确认，代码级排查未开始，排查协议见 docs/04 |
| 大文件（APK 169MB / ROM 537MB） | 随沙盒重置丢失，需要用户重新上传 |
| 平台问题（预览被文件阅览占用 / 下载不可达） | 未解决，规避策略见 docs/06 |

## 1. 阅读顺序（给下一个对话）

1. 本文件（HANDOFF.md）—— 全景
2. `docs/01-vmos-re-findings.md` —— 虚拟大师逆向全部结论
3. `docs/02-aemulator-upgrade-plan.md` —— 升级路线图与已完成进度
4. `docs/03-import-bug-fix.md`、`docs/04-rom-network-regression.md` —— 两个待修 bug
5. `docs/05-artifact-manifest.md` —— 上一会话全部产物清单（12,649 文件蒸馏）与恢复方式
6. `artifacts/agent-log.jsonl` —— 上一会话 1,036 行工作日志（含构建/验证命令实录）
7. `docs/06-platform-issues.md` —— 平台坑与规避策略

## 2. 七轮工作史（压缩版）

- **第 1 轮**：搭建 Next.js 工作台（项目名 `cloud-sandbox-explorer-next`，源码完整保存在 `template-round1/`）：实时指令捕捉（process-watcher 轮询 ps）、2GB 流式上传、后台 APK 反编译作业（jadx 1.5.6 + apktool 3.0.3，JDK 21）。
- **第 2-5 轮**：对虚拟大师破解版 APK（169MB，包名 `com.clone.android.dual.space`，加固壳 3KB classes.dex）及其安卓 12 ROM 分发包（537MB）深度逆向，摸清加固/加密/插件/root 全套体系（详见 docs/01）。
- **第 6 轮**：确认产品真身（香港有限公司注册、仅海外分发）；用户拍板转入实施：直接升级 AEmulator（uxazu/AEmulator，GPL-3.0）+ 修复导入 bug。
- **第 7 轮（上一会话，2026-11-13）**：产出 0.0.0.3/0.0.0.4 升级 APK、root-modules-v04 补丁、ROM 解密脚本与产物、两份实施报告（docx/pdf）。**会话结束后平台重置沙盒，上述产物全部丢失**（仅文件清单与日志幸存，即本仓库 artifacts/）。
- **第 8 轮（当前会话）**：平台下载通道与预览窗口持续故障，用户下达"建立 GitHub 接力仓库"指令 → 本仓库诞生。

## 3. 用户意图原文要点（必须长期遵守）

1. 继续增强 AEmulator：**root 超级用户开关管理**、**模块兼容 + LSPosed/Xposed 兼容**、需要固件时选 **Android 15 AOSP GSI arm64**、**ROM 识别 ROOT 后自动应用于全局可识别应用**。
2. 保证 ROM 稳定性（改版不能破坏原版功能，当前重点：网络丢失回归 bug）。
3. 修复导入 bug：导入走 ADB + `pm install` 自动安装路径。
4. 资源约束：磁盘余量有限（当前 8GB），及时清理中间产物；`/tmp` 在会话间会被清空，**重要产物必须立刻推送 GitHub 或放入 /home/z/my-project**。
5. 用户不再愿意重复历史背景：新对话请直接凭本仓库续作。

## 4. 下一会话立即行动清单（按优先级）

1. **请用户重新上传**（必要输入，本机已丢失）：
   - `虚拟大师_3.2.67.apk`（169MB，原路径 upload/虚拟大师_3.2.67.apk）
   - `user_96C1AFCD7A714C55DE801AAE51EFEBFC_rom_default_12.1.0_1034.zip`（537MB，安卓12 ROM 分发包）
2. 上传落地后：重建 AEmulator 上游源码（uxazu/AEmulator，参考 commit `3b97ed5`；GitHub 直连受阻时用 `ghfast.top` 镜像加速约 30 倍），并结合 `docs/05` 复现上一轮升级（补丁思路在 docs/02）。
3. 复现 ROM 解密流水线（docs/01 第 5 节 + docs/05 恢复方法）。
4. 按 docs/03 落地导入 bug 修复（ADB + pm install）。
5. 按 docs/04 排查 ROM 网络丢失回归（先代码层 diff 原版/改版 rom.img 配置）。
6. 每完成一个阶段性产物：立即 commit + push 到本仓库（大文件走 Release 资产），防止再次因沙盒重置丢失。

## 5. 环境备忘

- 工作目录：`/home/z/my-project/`（upload/ 为用户上传入口，download/ 为交付出口，scripts/ 放脚本）。
- 工具链：jadx 1.5.6、apktool 3.0.3、JDK 21（tools/jdk-21.0.5+11）、Python3、bun/Next.js 16 栈。
- GitHub 直连常受限：`raw.githubusercontent.com`、`api.github.com` 可能超时；镜像 `ghfast.top`（https://ghfast.top/https://github.com/...）历史可用且快约 30 倍。
- 平台预览端口被"文件阅览"占用时，交付以 GitHub 仓库/Release 链接为主，本地预览为辅。
- 本仓库由用户临时令牌创建（fine-grained PAT），**任务完成后用户应立即吊销该令牌**；本仓库内不含任何令牌或凭据。

## 6. 本仓库内容地图

```
aemulator-vmos-project/
├── HANDOFF.md                          ← 本文（总交接）
├── README.md                           ← 仓库简介
├── docs/
│   ├── 01-vmos-re-findings.md          ← 虚拟大师逆向结论（加固/Epic/RC4/插件/root 体系）
│   ├── 02-aemulator-upgrade-plan.md    ← 升级路线图 + 上一轮实施记录
│   ├── 03-import-bug-fix.md            ← 导入 bug 修复方案
│   ├── 04-rom-network-regression.md    ← ROM 网络丢失排查协议
│   ├── 05-artifact-manifest.md         ← 产物清单与恢复方法
│   └── 06-platform-issues.md           ← 平台问题与规避策略
├── artifacts/
│   ├── file-manifest-initial.json      ← 上一会话 12,649 文件完整清单（路径+时间戳）
│   ├── pending-clone-files.json        ← 平台待克隆清单（12,601 文件）
│   ├── agent-log.jsonl                 ← 上一会话 1,036 行实时工作日志
│   └── cloud-sandbox-explorer-next.zip ← 第 1 轮 Next.js 工程源码打包（原件）
├── template-round1/                    ← 第 1 轮工程源码（解包后，可直接 npm/bun 复用）
└── platform/                           ← 平台运行脚本幸存原件（.zscripts + Caddyfile）
```
