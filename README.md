# aemulator-vmos-project

AEmulator 升级工程 + 虚拟大师（VMOS 类产品）逆向分析工作台的**全量交接仓库**。

**新对话入口：先读 [`HANDOFF.md`](HANDOFF.md)。** 读完后即可无缝接续全部工作，无需向用户索要背景。

## 仓库构成

- `HANDOFF.md` —— 总交接文档（状态总览 / 七轮工作史 / 行动清单）
- `docs/` —— 六份专题文档：逆向结论、升级路线图、两个待修 bug、产物清单、平台问题
- `artifacts/` —— 上一会话幸存的文件清单（12.6K 条目）、工作日志（1,036 行）、第 1 轮工程源码 zip
- `template-round1/` —— 第 1 轮 Next.js 工作台源码（实时指令捕捉 / 2GB 上传 / APK 反编译作业）
- `platform/` —— 平台运行脚本原件

## 核心结论速览

- 虚拟大师 3.2.67：3KB 加固壳 + Epic 体系（Epic.vm = XOR 0x1F，已解密验证）+ libEPIC.so RC4 多 key 体系 + 内置加密插件（magisk/superuser/xposed/play）+ LSPlant/Pine Xposed 兼容层。
- ROM 分发包（安卓 12）：zip 容器明文，内容层 `e=x`(RC4) + `c=v2`(自定义压缩)，manifest 内置 Magisk v27000 + Superuser 可选拉取；解密流水线上一会话已跑通。
- AEmulator（uxazu/AEmulator，GPL-3.0）：QEMU 跑 2.3-4.4，5.0+ 走原生 arm64 + 用户态 syscall 拦截，与目标产品技术路线可类比迁移。

## 待办（接手即办）

1. 用户重传 APK（169MB）与 ROM 分发包（537MB）
2. 复现 AEmulator 0.0.0.4 升级构建与 ROM 解密流水线
3. 修复导入 bug（ADB + `pm install`）与 ROM 网络丢失回归
