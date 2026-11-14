# 02 - AEmulator 升级路线图与上一轮实施记录

> 目标由用户在第 4 轮确定，第 7 轮完成第一轮实施（产物随沙盒重置丢失，本文记录"做了什么、怎么做的"，供复现）。

## 1. 升级目标（用户原文要求，长期有效）

1. 更方便地管理 root（超级用户开关管理）
2. 模块兼容 + LSPosed/Xposed 兼容（Xposed 资源管理、模块安装使用）
3. 若需固件，选 **Android 15 为底的 AOSP GSI arm64**
4. 修改后 ROM 能识别 ROOT 并自动应用于全局可识别应用

## 2. 上一轮（第 7 会话）实施产物（全部丢失，待复现）

| 产物 | 说明 |
| --- | --- |
| `download/AEmulator-0.0.0.3-root-xposed-upgrade.apk` | 0.0.0.3 升级版 |
| `download/AEmulator-0.0.0.4-root-xposed-upgrade.apk` | 0.0.0.4 升级版（root + xposed 增强） |
| `download/AEmulator-0.0.0.4-side-by-side-v0003.apk` | 0.0.0.4 并行共存变体 v0003 |
| `download/aemulator-root-modules.patch` / `-v04.patch` | root 模块补丁（v04 为终版） |
| `download/AEmulator-upgraded-src.zip` | 升级后源码打包 |
| `scripts/build-aemu.sh` | 一键构建脚本 |
| `scripts/aemu-release.jks` | 发布签名 keystore（丢失；重建时需新生成并告知用户口令自管） |
| `download/AEmulator升级实施报告-Root管理与模块体系.docx/.pdf` | 实施报告 |
| `download/VirtualMaster逆向分析与AEmulator迁移方案.docx/.pdf` | 逆向与迁移方案报告 |
| `download/ROM解密产物/` | ROM 解密流水线产物（见 docs/01 第 5 节） |

（以上路径与存在性来自 `artifacts/file-manifest-initial.json`，12,649 文件清单蒸馏。）

## 3. 工程基线（第 1 轮建成，源码在本仓库 template-round1/）

- Next.js 16 + bun 栈，工作台组件：`ExplorerApp` / `CloudCockpit` / `TerminalView` / `AgentLiveFeed`（实时指令捕捉）/ `CloudFileExplorer` / `UploadView` / `ApkLabView` / `ExportDeployView` / `ScriptPlayground`。
- 关键设施：
  - `src/lib/process-watcher.ts`：轮询 ps 实现指令自动捕捉（1s 周期）
  - `src/instrumentation.ts`：Next.js 启动挂钩
  - `src/app/api/upload/route.ts`：2GB 流式上传
  - `src/app/api/apk/job/route.ts` + `scripts/apk-job-runner.sh`：后台反编译作业（jadx 1.5.6 / apktool 3.0.3 / JDK 21）
  - `src/app/api/apk/tools/route.ts`：工具状态
- 上一会话还追加了 `src/app/api/deliverables/*` 交付下载中心与 `DeliverablesView.tsx`（清单见 artifacts）。

## 4. 复现与继续升级的步骤

1. 取上游源码：`uxazu/AEmulator`，参考 commit `3b97ed5`（agent-log 记录 `git worktree add /tmp/aemu-check 3b97ed5`）。GitHub 直连受阻用 ghfast.top 镜像。
2. 以 `template-round1/` 为工作台底座，重挂 upload/apk-job/deliverables API。
3. 按 docs/01 第 7/8 节移植 root 体系（Magisk 可插拔 zip + superuser 开关管理）与 hook 层（LSPlant/Pine + Xposed API 适配）。
4. 重建 `scripts/build-aemu.sh` 构建链（APK 打包 + apksigner 签名，jks 新建）。
5. 产物命名沿用 `AEmulator-<版本>-root-xposed-upgrade.apk` 惯例，方便对照。

## 5. 稳定性红线（用户明确要求）

- 改版不得破坏 ROM 原有功能，特别是**网络**（当前回归 bug 见 docs/04）。
- 每次改版必须保留原版对照构建（side-by-side 变体即为此目的），并做冒烟清单：启动 / 网络 / root 开关 / 模块安装 / 应用导入。

## 6. 2026-11-14 增量：0.0.0.5（Xposed API 100）

- **API 100 桥接 jar**：`de.robv.android.xposed.*` 真实 API 类（XposedBridge VERSION=100 / XC_MethodHook / XposedHelpers / IXposedHookLoadPackage·ZygoteInit / XSharedPreferences），javac+d8 构建为 `XposedBridge.jar`（classes.dex 11KB）。
- **XposedManager.kt**：xposed.prop `version/versionCode=93→100`；seedMarkers 优先从 `res/raw/xposedbridge.jar` 复制真实桥接（资源名 `app.aemu:raw/xposedbridge` 已验证入包），无资源时回退标记 jar（MANIFEST 带 `Xposed-Bridge-Version: 100`）。
- **版本**：versionCode 5 / versionName 0.0.0.5；`app-standard-release.apk`（`app.aemu`）+ `app-v0003-release.apk`（`app.aemu.v0003`）均以 `aemu-release.jks`（口令 aemu-root-modules，见 keystore.properties）签名，与 0.0.0.4 同证书可直接覆盖安装。
- **补丁**：`aemulator-root-modules-v05.patch`（基准 = AEmulator-upgraded-src.zip 树）。
- **ROM v2**：见 docs/04 第 7 节（root+xposed 文件直接烧入系统树，与 app 侧 seedGuestFiles/seedMarkers 协议完全一致）。
- 遗留：LSPlant/Pine 进程内加载器仍未落地（VMOS 的 liblsplant 在加密插件内，取回需动态抓取）；API 100 的 hook 执行通路是下一阶段。

## 7. 2026-11-14 增量：固件方向落地（Android 15 GSI + VMRoot v1）

- 用户拍板切换主线：**固件底座 = 安卓 15 AOSP GSI arm64**，安卓 12（VMOS ROM）线终止、相关文件全部删除。
- 已完成 GSI 开包分析与 **VMRoot v1 改版**：system-mode Magisk v31.1（daemon/su/magiskpolicy/busybox + Magisk 管理器 priv-app 预装）+ init 服务 vmroot.rc + LSPosed v1.9.3_mod zygisk 种子（可自动安装）+ `ro.aemu.*` 契约 props。全流程、引擎接入契约与已知限制见 **docs/07**；镜像在 Release tag `android15-gsi-vmroot-v1`。
- 与本计划的对应关系：目标 1（root 开关管理）→ Magisk 管理器 priv-app + su；目标 2（LSPosed/Xposed 兼容）→ 种子模块 + API 100 桥接（§6）对齐；目标 3（安卓 15 AOSP GSI arm64）→ 本轮落地；目标 4（ROOT 自动应用于全局应用）→ Magisk 管理器 auto-response=Allow（可在引擎首启配置中预设）。
- 下一步（hook 执行通路）：LSPlant/Pine 进程内加载器仍为 app 侧遗留项；建议基于 LSPosed 官方依赖链（org.lsplant maven 预编译产物）接入，避免自行编译 NDK（当前沙盒无 NDK）。
