# HANDOFF - AEmulator 升级工程 + 虚拟大师(VMOS)逆向工作台 · 全量交接快照

> **本仓库的唯一目的**：任何新对话拿到本仓库地址后，读完本文档即可完整接续工作，无需向用户索要历史背景。
> 生成时间：2026-11-14（北京时间）。生成者：接手第七轮任务的工作会话（沙盒重置后的首个会话）。
> **重大更新（同日）**：用户直觉验证成功——平台云端存有真实文件快照，`/tmp/my-project` 暂存区于 23:50 经第三次克隆尝试自动恢复上一会话全量文件；本仓库已升级为全量存档（git 源码 + Release 二进制）。

---

## 0. 一页状态总览

| 项目 | 状态 |
| --- | --- |
| 产品逆向分析（虚拟大师 3.2.67 + 安卓12 ROM） | 已完成七轮，结论全部沉淀在 docs/01 |
| AEmulator 升级（root 管理 / Xposed / 模块体系） | 0.0.0.5 已构建（Xposed API 100 桥接 + res/raw 真实 jar）；0.0.0.3/0.0.0.4 三枚 APK 与补丁均已恢复并推送 Release |
| ROM 解密（e=x RC4 体系） | 已跑通；解密脚本与 magisk_v27.0_已解密.zip（24MB）均已恢复（脚本在 recovered-project/download/，解密包在 Release） |
| 导入 bug（内置导入报"导入失败"） | 修复方向已定：改走 ADB shell + pm install，代码未落地 |
| ROM 改版后网络丢失（回归 bug） | 安卓 12 ROM 线已终止（ROM v2 及原包已按用户指示删除）；docs/04 保留为网络排查方法论，新 ROM 基线：GSI hosts 干净、网络配置零改动 |
| 大文件（APK 169MB / ROM 537MB） | 原 APK 已恢复并推送 Release；安卓 12 ROM 及衍生产物已于 2026-11-14 按用户指示删除（本地 + Release） |
| **安卓 15 GSI 固件（新主线）** | **已完成开包分析 + VMRoot v1 改版**（Magisk 31.1 系统内嵌 + LSPosed 种子 + aemu 契约 props，e2fsck 通过），Release tag `android15-gsi-vmroot-v1`，详见 docs/07 |
| 平台问题（预览被文件阅览占用 / 下载不可达） | 未解决，规避策略见 docs/06 |

## 1. 阅读顺序（给下一个对话）

1. 本文件（HANDOFF.md）—— 全景
2. `docs/01-vmos-re-findings.md` —— 虚拟大师逆向全部结论
3. `docs/02-aemulator-upgrade-plan.md` —— 升级路线图与已完成进度
4. `docs/03-import-bug-fix.md`、`docs/04-rom-network-regression.md` —— 两个待修 bug
5. `docs/05-artifact-manifest.md` —— 上一会话全部产物清单（12,649 文件蒸馏）与恢复方式
6. `artifacts/agent-log.jsonl` —— 上一会话 1,036 行工作日志（含构建/验证命令实录）
7. `docs/06-platform-issues.md` —— 平台坑与规避策略
8. `docs/07-android15-gsi-vmroot.md` —— **新主线**：安卓 15 GSI 开包分析与 VMRoot 改版全记录 + 引擎接入契约

## 2. 工作史（压缩版）

- **第 1 轮**：搭建 Next.js 工作台（项目名 `cloud-sandbox-explorer-next`，源码完整保存在 `template-round1/`）：实时指令捕捉（process-watcher 轮询 ps）、2GB 流式上传、后台 APK 反编译作业（jadx 1.5.6 + apktool 3.0.3，JDK 21）。
- **第 2-5 轮**：对虚拟大师破解版 APK（169MB，包名 `com.clone.android.dual.space`，加固壳 3KB classes.dex）及其安卓 12 ROM 分发包（537MB）深度逆向，摸清加固/加密/插件/root 全套体系（详见 docs/01）。
- **第 6 轮**：确认产品真身（香港有限公司注册、仅海外分发）；用户拍板转入实施：直接升级 AEmulator（uxazu/AEmulator，GPL-3.0）+ 修复导入 bug。
- **第 7 轮（上一会话，2026-11-13）**：产出 0.0.0.3/0.0.0.4 升级 APK、root-modules-v04 补丁、ROM 解密脚本与产物、两份实施报告（docx/pdf）。**会话结束后平台重置沙盒，上述产物全部丢失**（仅文件清单与日志幸存，即本仓库 artifacts/）。
- **第 8 轮（当前会话）**：平台下载通道与预览窗口持续故障，用户下达"建立 GitHub 接力仓库"指令 → 本仓库诞生；同日深夜用户要求深挖快照线索，确认平台 `/tmp/my-project` 暂存区经三次克隆尝试（attempts 2→3）于 23:50 将上一会话全量文件恢复成功（云端快照为真实文件快照，非仅清单）。
- **第 9 轮（2026-11-14）**：上一轮尾段实际完成 0.0.0.5（Xposed API 100 桥接）与安卓 12 ROM v2 并推送 Release。本轮用户拍板：**工作对象切换为安卓 15 GSI，安卓 12 系列文件全部删除**。已删 Release 三项（原包 513MB / ROM v2 495MB / extracted-rom 24MB）与本地全部安卓 12 大件；完成官方安卓 15 QPR2 GSI arm64 下载（SHA-256 与官方一致）→ debugfs 原位开包分析 → VMRoot v1 改版（system-mode Magisk 31.1 + LSPosed 种子 + aemu 契约 props）→ e2fsck 校验 → Release `android15-gsi-vmroot-v1` 推送（全流程见 docs/07）。中控台预览服务以生产模式（.next/standalone）重启。

## 3. 用户意图原文要点（必须长期遵守）

1. 继续增强 AEmulator：**root 超级用户开关管理**、**模块兼容 + LSPosed/Xposed 兼容**、需要固件时选 **Android 15 AOSP GSI arm64**、**ROM 识别 ROOT 后自动应用于全局可识别应用**。
2. 保证 ROM 稳定性（改版不能破坏原版功能，当前重点：网络丢失回归 bug）。
3. 修复导入 bug：导入走 ADB + `pm install` 自动安装路径。
4. 资源约束：磁盘余量有限（当前 8GB），及时清理中间产物；`/tmp` 在会话间会被清空，**重要产物必须立刻推送 GitHub 或放入 /home/z/my-project**。
5. 用户不再愿意重复历史背景：新对话请直接凭本仓库续作。

## 4. 下一会话立即行动清单（按优先级）

1. 无需用户重传任何文件：APK/ROM 及全部产物已恢复并入仓（源码在 `recovered-project/`，二进制在 GitHub Release）。
2. 工作底座：直接取用 `recovered-project/`（上一会话完整工程：src/scripts/db/apk-jobs/download 小件），Release 内含三枚升级 APK 与升级源码包 `AEmulator-upgraded-src.zip`；上游参考 uxazu/AEmulator @ `3b97ed5`（GitHub 直接受阻时用 `ghfast.top` 镜像加速约 30 倍）。
3. ROM 解密流水线脚本：`recovered-project/download/decrypt_rom_package.py`；解密产物：Release 资产 `magisk-v27.0-decrypted.zip`。
4. ~~ROM v2（安卓 12）~~ **已作废**（2026-11-14 用户指示删除安卓 12 系列）；0.0.0.5 两枚 APK（Xposed API 100 桥接，同证书覆盖安装）与 `aemulator-root-modules-v05.patch` 仍在 Release。
5. 按 docs/03 落地导入 bug 修复（0.0.0.4 已修，0.0.0.5 沿用同一通路）。
6. **新主线：安卓 15 GSI 装机联调** —— 按 docs/07 §9：引擎加 `androidboot.selinux=permissive` 内核参数挂载改版镜像；确认 `getprop ro.aemu.rom` 识别；验证 `su`（magiskd）与 Magisk 管理器；开启 Zygisk 后验证 LSPosed 种子模块加载。原第 4/6 条（ROM v2 推送与网络验证）随安卓 12 线终止作废，改版能力沉淀在 docs/07 流水线；app 侧 0.0.0.5 两枚 APK 仍在 Release。
7. 每完成一个阶段性产物：立即 commit + push 到本仓库（大文件走 Release 资产），防止再次因沙盒重置丢失。

## 5. 环境备忘

- 工作目录：`/home/z/my-project/`（upload/ 为用户上传入口，download/ 为交付出口，scripts/ 放脚本）。
- 工具链：jadx 1.5.6、apktool 3.0.3、JDK 21（tools/jdk-21.0.5+11）、Python3、bun/Next.js 16 栈。
- GitHub 直连常受限：`raw.githubusercontent.com`、`api.github.com` 可能超时；镜像 `ghfast.top`（https://ghfast.top/https://github.com/...）历史可用且快约 30 倍。
- 平台预览端口被"文件阅览"占用时，交付以 GitHub 仓库/Release 链接为主，本地预览为辅。
- GSI/镜像工具：无 root 时用 deb 解包法装 e2fsprogs（`apt-get download e2fsprogs libcom-err2 libext2fs2t64 libss2 && dpkg -x`，详见 docs/07 §2）；debugfs 可原位读写 ext4（write/rm/mkdir/sif/ea_set）；改版后必跑 e2fsck -fy。
- GSI 官方直链模式：`https://dl.google.com/developers/android/<代号>/images/gsi/<文件名>.zip`（安卓 15=vic，16=baklava；文件名+SHA-256 在 GSI release notes 页表格）。
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
│   ├── 06-platform-issues.md           ← 平台问题与规避策略
│   └── 07-android15-gsi-vmroot.md      ← 新主线：安卓 15 GSI 开包 + VMRoot 改版 + 引擎契约
├── artifacts/
│   ├── file-manifest-initial.json      ← 上一会话 12,649 文件完整清单（路径+时间戳）
│   ├── pending-clone-files.json        ← 平台待克隆清单（12,601 文件）
│   ├── agent-log.jsonl                 ← 上一会话 1,036 行实时工作日志
│   └── cloud-sandbox-explorer-next.zip ← 第 1 轮 Next.js 工程源码打包（原件）
├── template-round1/                    ← 第 1 轮工程源码（解包后，可直接 npm/bun 复用）
├── platform/                           ← 平台运行脚本幸存原件（.zscripts + Caddyfile）
├── recovered-project/                  ← 上一会话完整工程恢复件（src/scripts/db/apk-jobs/配置文件；download/ 内含补丁两版+四份报告+ROM解密脚本与说明）
└── GitHub Release  ← recovery-20261113（原APK 169MB / 0.0.0.3~0.0.0.5×5 APK / 升级源码包 / analysis·decompiled 包 / magisk 解密包 / 签名 jks；安卓12 ROM 三项已删）+ **android15-gsi-vmroot-v1**（改版 GSI 915MB + Magisk 31.1 + LSPosed 种子；GSI 注入流水线原件在本地 scripts/gsi-patch/）
```
