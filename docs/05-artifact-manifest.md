# 05 - 产物清单与恢复方法

> 数据来源：`artifacts/file-manifest-initial.json`（上一会话 12,649 文件的路径+时间戳快照）与 `artifacts/pending-clone-files.json`（平台待克隆清单 12,601 条）。内容本体曾随沙盒重置丢失。
>
> **2026-11-14 恢复纪事**：用户要求深挖后确认平台云端为真实文件快照——`/tmp/my-project` 暂存区经第三次克隆尝试（attempts 2→3）于 23:50 自动恢复全量文件（mtime 保留原值）。下表"状态/恢复方式"为恢复前的悲观记录，仅作历史参考；**实际结果：全部关键产物已恢复**——源码与小件在本仓库 `recovered-project/`，二进制大件在 GitHub Release（tag `recovery-20261113`）。

## 1. 状态图例

- [在本仓库]：本仓库已有原件或源码
- [可复现]：方法已知，输入到位即可重建
- [需用户重传]：无法自动恢复
- [仅存清单]：只剩路径与时间戳证据

## 2. 关键产物一览

| 产物 | 原路径 | 大小 | 状态 | 恢复方式 |
| --- | --- | --- | --- | --- |
| 虚拟大师 3.2.67 APK | `upload/虚拟大师_3.2.67.apk` | 169MB | 需用户重传 | 用户本机重传（工具/提取物全部可由它重建） |
| 安卓12 ROM 分发包 | `upload/user_96C1AFCD7A714C55DE801AAE51EFEBFC_rom_default_12.1.0_1034.zip` | 537MB | 需用户重传 | 用户本机重传 |
| 0.0.4 root-xposed 升级 APK | `download/AEmulator-0.0.0.4-root-xposed-upgrade.apk` | 约 100MB 级 | 可复现 | docs/02 第 4 节流程重建 |
| 0.0.4 并行共存变体 | `download/AEmulator-0.0.0.4-side-by-side-v0003.apk` | 同上 | 可复现 | 同上 |
| 0.0.3 升级 APK | `download/AEmulator-0.0.0.3-root-xposed-upgrade.apk` | 同上 | 可复现（一般直接跳到 0.0.4） | - |
| root 模块补丁 v04 | `download/aemulator-root-modules-v04.patch` | 文本级 | 仅存清单 | 按 docs/02 重写（思路在案） |
| 升级版源码包 | `download/AEmulator-upgraded-src.zip` | - | 可复现 | 上游 `3b97ed5` + 升级改动重打 |
| 构建脚本 | `scripts/build-aemu.sh` | 文本级 | 仅存清单 | 重建（打包+签名链） |
| 签名 keystore | `scripts/aemu-release.jks` | 小 | 可复现（换新） | 重建时新生成，口令交用户自管 |
| ROM 解密脚本 | `download/ROM解密产物/decrypt_rom_package.py` | 文本级 | 可复现 | docs/01 第 5 节：RC4(e=x) + c=v2，key 在 native so |
| Magisk v27.0 解密 zip | `download/ROM解密产物/magisk_v27.0_已解密.zip` | 约 16MB | 可复现 | 重跑解密流水线 |
| 解密后 manifest | `download/ROM解密产物/manifest.json` | 小 | 可复现 | 同上 |
| 密钥与解密说明 | `download/ROM解密产物/密钥与解密说明.txt` | 小 | 可复现 | 重建时随脚本重新生成 |
| 逆向+迁移方案报告 | `download/VirtualMaster逆向分析与AEmulator迁移方案.docx/.pdf` | 文档 | 可复现 | docs/01 即其内容蒸馏 |
| 升级实施报告 | `download/AEmulator升级实施报告-Root管理与模块体系.docx/.pdf` | 文档 | 可复现 | docs/02 即其内容蒸馏 |
| Epic.vm 解密产物 | `/tmp/Epic_vm_dec.bin` | - | 可复现 | APK assets/Epic.vm 逐字节 XOR 0x1F |
| ROM 内部 zip（中间产物） | `/tmp/magisk_inner.zip`、`/tmp/superuser_inner.zip` | - | 可复现 | 重解 ROM 分发包 |
| 第 1 轮工作台源码 | 项目根（同名） | - | **在本仓库** | `template-round1/` + `artifacts/cloud-sandbox-explorer-next.zip` |
| 交付中心源码 | `src/app/api/deliverables/*`、`DeliverablesView.tsx` | - | 仅存清单 | 重建（功能明确：download/ 目录列表+下载） |
| 反编译作业记录 | `apk-jobs/mwf3q871-czef.*` 等 3 组 | 小 | 仅存清单 | 重跑即可（jadx/apktool 作业幂等） |
| 应用数据库 | `db/custom.db` | 小 | 仅存清单 | 新会话自动重建 |
| 全量文件清单 | 12,649 条路径 | - | **在本仓库** | `artifacts/file-manifest-initial.json` |
| 工作日志 | 1,036 行 | - | **在本仓库** | `artifacts/agent-log.jsonl` |

## 3. 恢复顺序（依赖链）

1. 用户重传两个大文件（APK → ROM 包）；
2. APK 落地 → 重提 lib/arm64-v8a 全套 so、assets/plugins 四个加密 zip、Epic.vm 解密复现；
3. ROM 包落地 → 解包 manifest + 内部 zip → 重跑 RC4 解密流水线（先以 libEPIC.so 字符串定位 key 再跑）；
4. AEmulator 上游源码（ghfast.top 拉 `uxazu/AEmulator` @ `3b97ed5`）→ 按 docs/02 重打升级 APK；
5. 每步产物立推本仓库 Release，防止再丢失。

## 4. 时间戳参考

清单内关键文件时间戳（epoch 秒）约 `1794597204` 附近 = 2026-11-13 晚（UTC），即上一会话收尾时刻，可供核对版本先后。
