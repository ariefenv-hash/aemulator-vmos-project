# 01 - 虚拟大师（VMOS 类产品）逆向分析全部结论

> 分析对象与轮次：第 2-5 轮完成，本文为最终结论汇编。所有结论均来自沙盒内实际解包/反编译/字符串分析，非推测处已标注"（验证）"。

## 1. 产品与样本

- 样本：`虚拟大师_3.2.67.apk`，169MB，包名 `com.clone.android.dual.space`。
- 性质：外国团队的 Android-on-Android 虚拟化产品（VMOS Pro 同类），香港有限公司注册主体，仅海外分发（第 6 轮用户确认搜索结论）。
- 核心形态：App 内运行完整 Android 系统（ROM 分发包按需下载），系统内可 root、装 Xposed 模块。

## 2. 加固壳与动态加载体系（验证）

- `classes.dex` 仅 3KB：纯加固壳，主逻辑加密存放、运行时动态加载。
- 主加载体系为 **Epic**：`assets/EPIC` 目录 + `Epic_so` + `Epic.vm`。
- `Epic.vm` 为 **单字节 XOR 0x1F 加密的 Dalvik 字节码**——已成功解密（产物 `/tmp/Epic_vm_dec.bin` 随沙盒丢失；复现方法：从 APK assets 取 Epic.vm，逐字节 XOR 0x1F，无需密钥）。这证明 VMOS 加密体系中至少一层是极简 XOR。

## 3. libEPIC.so 加密体系（验证：字符串/结构证据）

- RC4 多 key 体系，覆盖五类对象：`dex` / `epic_meta` / `vm` / `asset` / `axml`。
- 加固字段名三件套在 so 内明文可见：`method`、`rc4_key`、`xor_key`。
- so 内含 XposedBridge 接口字符串（说明 Epic 同时承担 hook 与加密加载）。

## 4. Native 库清单（提取自 lib/arm64-v8a，验证）

| 库 | 作用 |
| --- | --- |
| `libvm.so` | 9.7MB 核心虚拟化引擎 |
| `libkr32.so` / `libkr64.so` 及 `.11` / `.12` 变体 | 按 Android 版本（11/12）区分的用户态内核 shim（syscall 拦截） |
| `libadb.so` | 内置 ADB 通道（ROM 内 adb shell 可用） |
| `libun7z.so` | 7z 解包（ROM/插件部署） |
| `libkrloader64.so` | 加载器 |

## 5. ROM 分发包结构（验证）

- 样本：`user_96C1AFCD7A714C55DE801AAE51EFEBFC_rom_default_12.1.0_1034.zip`，537MB，安卓 12（12.1.0，build 1034）。
- **zip 容器层未加密**（第 3 轮 Python 校验 entry flags/magic 确认），加密在内容层。
- 包内：`manifest.json`、`magisk.zip`、`superuser.zip`、`rom.img`、`rom1.img`。
- manifest 关键字段：
  - `rom_uri: "rom.img?e=x&c=v2"` —— `e=x` = RC4 加密（key 藏于 native so），`c=v2` = 自定义压缩方案
  - `magisk_uri: "magisk.zip?v=27000&e=x"` —— 内置 Magisk v27000
  - `su_uri: "superuser.zip"`
  - `xposed_uri: ""`（Xposed 为可选拉取，ROM 默认不带）
- 上一会话已跑通解密流水线，产物（已丢失，方法见 docs/05）：`decrypt_rom_package.py`、`magisk_v27.0_已解密.zip`、解密后 `manifest.json`、`密钥与解密说明.txt`。

## 6. 插件体系 = root 方案核心（验证）

- APK `assets/plugins/` 内置四个加密 zip：`magisk.zip`（15.9MB）、`superuser.zip`（1.45MB）、`xposed.zip`（4.55MB）、`play.zip`（102MB，GApps）。
- **确定性加密证据**：`superuser.zip` 与 `xposed.zip` 头 16 字节密文完全相同 → 固定 key/nonce、无随机 IV（RC4 流密码确定性）。
- 体系结论：**ROM 分发时把 Magisk + Superuser 作为可选拉取组件 + 可插拔 zip 组件 + LSPlant/Pine hook 层**。

## 7. Xposed 兼容层（验证）

- so：`liblsplant.so` / `libpine.so` / `libaliuhook_{arch}.so`（LSPlant、Pine、AliuHook 三引擎并存）。
- dex：`pine_xposed_api.dex`、`aliu_xposed_api.dex`（应用级 Xposed API 适配）。
- APK 中确认存在 `top.canyie` 的 Pine 库。
- 结论：目标产品的"Xposed 兼容"不依赖经典 Rovo89/XposedBridge，而是 **LSPlant/Pine 应用级 hook + API 适配层**。AEmulator 升级应复用同路线（详见 docs/02）。

## 8. 对 AEmulator 的迁移含义

- AEmulator（uxazu/AEmulator，GPL-3.0）现状：QEMU 修补版跑旧版 Android（2.3-4.4）；5.0+ 固件为"原生 arm64 + 用户态引擎内核拦截 syscall"模式。
- 该模式与目标产品（libkr32/64 shim 拦截）同类，升级路线成立：root 体系移植 Magisk 方案、hook 层移植 LSPlant/Pine 方案、导入链路复用内置 ADB。
- 上游参考 commit：`3b97ed5`（见 docs/02）。
