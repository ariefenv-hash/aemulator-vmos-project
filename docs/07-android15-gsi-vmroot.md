# 07 - 安卓 15 AOSP GSI arm64：开包分析与 VMRoot v1 改版实录

> 第 9 轮（2026-11-14）。用户指示：工作对象从安卓 12（VMOS ROM）切换为安卓 15 GSI；安卓 12 相关文件删除（本地 + Release，见 docs/05 第 9 轮更新）。本文记录 GSI 的获取、开包分析、原位改版（system-mode Magisk + LSPosed 种子 + aemu 契约）全过程与引擎接入契约。

## 1. 底包来源与校验

| 项 | 值 |
| --- | --- |
| 发布页 | developer.android.com/about/versions/15/gsi-release-notes（Android 15 QPR2 stable，2025-01-21） |
| 直链模式 | `https://dl.google.com/developers/android/<代号>/images/gsi/<文件名>.zip`（安卓 15 代号 `vic`） |
| 实际直链 | https://dl.google.com/developers/android/vic/images/gsi/aosp_arm64-exp-BP11.241210.004-12926906-ac28fd4c.zip |
| 大小 | 888,258,397 B（847 MB）；SHA-256 `ac28fd4c189d1521c56b542a6391190f55d7059d8ebbc98d0eb817b058c76137` 与官方一致 |
| 包内容 | system.img（1,899,507,712 B，ext4）+ vbmeta.img（4 KB）+ 顶层 build.prop（5 KB） |

> 备注：GSI 发布页只给 Flash Tool 链接；直链模式来自社区实录（`dl.google.com/developers/android/<codename>/images/gsi/...`），对 vic/baklava 均有效。GMS 版（`gsi_gms_arm64-*`）同模式可取，本轮未集成（AOSP 版符合既定方向）。

## 2. 开包工具链（免 root）

沙盒无 e2fsprogs 且无免密 sudo，采用 **deb 解包法**：

```bash
apt-get download e2fsprogs libcom-err2 libext2fs2t64 libss2   # Debian 13 (trixie)
for d in *.deb; do dpkg -x "$d" e2f; done
export LD_LIBRARY_PATH=$PWD/e2f/usr/lib/x86_64-linux-gnu
e2f/usr/sbin/debugfs -R "ls -l /" system.img
```

debugfs（e2fsprogs 1.47.2）可读写（`-w`）ext4，支持 `write/rm/mkdir/sif/ea_set`，即**原位注入**：不重打包、不丢 SELinux xattr 与 uid/gid。改版后 `e2fsck -fy` 修复 debugfs 写入的元数据校验和（输出 FILE SYSTEM WAS MODIFIED 属预期）。

## 3. 开包分析结论

- **布局**：system-as-root。镜像根含 `acct/apex/bin(symlink)/etc(symlink)/init(symlink→/system/bin/init)/init.environ.rc/odm/oem/postinstall/linkerconfig/debug_ramdisk/...`，真正的系统树在 `/system/` 下（app/bin/etc/fonts/framework/lib/lib64/priv-app/product/system_ext/usr）。
- **版本**：`ro.build.version.sdk=35`（Android 15），fingerprint `Android/aosp_arm64/generic_arm64:15/BP11.241210.004/12926906:user/release-keys`，ab 集合 `arm64-v8a,armeabi-v7a,armeabi`。
- **init 脚本目录**：`/system/etc/init/*.rc` 有大量系统服务定义 → **新增自启 rc 文件即可生效**，无需动 ramdisk。
- **SELinux**：`/system/etc/selinux/` 内含 plat_sepolicy.cil（2.3MB）、plat_file_contexts、plat_seapp_contexts、plat_property_contexts 等。file_contexts 命中规则 `/system(/.*)?  u:object_r:system_file:s0` → 注入文件统一打 system_file 标签。GSI 无法在 system 分区层面扩策略（plat policy 编译态），因此 root 链路依赖**宽容模式启动**（引擎内核参数）。
- **hosts**：仅 localhost 条目，干净。VMOS 安卓 12 ROM 那类网络回归来源在 GSI 上不存在；docs/04 的排查协议保留为方法论。
- **资源预算**：Free blocks 16,410×4KB ≈ 64MB；**Free inodes 仅 57**。本轮注入用掉 11 个 inode，改版后余 46 个（后续加文件要节制；app 目录树如需大扩充应换"重新打包"路线，mke2fs 已随 deb 就位）。

## 4. VMRoot v1 改版内容（原位注入清单）

| 注入目标 | 来源 | 模式 | 作用 |
| --- | --- | --- | --- |
| `/system/bin/magisk` | Magisk v31.1 `libmagisk.so`（APK lib 重命名即执行体） | 0755 root:root | 主多调用体（daemon/su/install-module） |
| `/system/bin/magiskpolicy` | `libmagiskpolicy.so` | 0755 | sepolicy 现场修补（宽容模式直接可用） |
| `/system/bin/busybox` | `libbusybox.so`（静态） | 0755 | 脚本依赖 |
| `/system/bin/magiskinit` / `magiskboot` | 同名 so | 0755 | 保留完整能力（boot 修补备用） |
| `/system/bin/su` | 自写 wrapper：`exec /system/bin/magisk su "$@"` | 0755 | 全局 su 入口 |
| `/system/bin/vmroot-setup.sh` | 自写（stage1: 部署 /data/adb/magisk；stage2: LSPosed 一次性自动安装） | 0755 | 自举 |
| `/system/etc/init/vmroot.rc` | 自写（见 §5） | 0644 | init 服务 |
| `/system/priv-app/Magisk/Magisk.apk` | Magisk-v31.1.apk 原件 | 0644 | **超级用户开关管理 UI 预装** |
| `/system/etc/aemu/LSPosed-zygisk.zip` | mywalkb/LSPosed_mod v1.9.3_mod（zygisk 版，官方 LSPosed 仓库已下架） | 0644 | Xposed 种子模块 |
| `/system/etc/aemu/README.txt` | 镜像内契约说明 | 0644 | 引擎接入速查 |
| `/system/build.prop` | 原文件 + 11 行 aemu 契约 props（替换式，未动任何原值） | 0644 | ROM 识别 |

所有新 inode 均已 `ea_set security.selinux = u:object_r:system_file:s0`（含 NUL 终止符）。

## 5. init 服务设计（system-mode Magisk 的关键决策）

读 Magisk v31.1 官方源码（daemon.rs / utils.cpp）确认的机制：

1. `magisk --daemon` 启动时把 SELinux context 写为 `u:r:magisk:s0` —— **best-effort**（失败静默），GSI 无 magisk 域时回落 init 域运行，宽容模式下功能完整。
2. 运行时目录探测 `get_magisk_tmp()`：优先 `/debug_ramdisk/.magisk`，其次 `/sbin/.magisk`，都没有则空 → socket/config 落到只读根会失败。**故 vmroot.rc 在 post-fs-data 给 /debug_ramdisk 挂 tmpfs 并建 .magisk 标记目录**。
3. daemon 自带模拟器识别（`ro.kernel.qemu` / `ro.boot.qemu` / vsoc 设备名）→ 引擎保持 `ro.kernel.qemu=1` 即可。
4. `magisk --install-module <zip>` 为官方子命令 → stage2 用它在首启自动安装 LSPosed 种子（`ro.aemu.xposed.autosetup=0` 可关）。

vmroot.rc 全文（注意 `exec_background` 而非 `exec background`——init 语言无后者）：

```
on post-fs-data
    mkdir /data/adb 0700 root root
    mkdir /data/adb/magisk 0755 root root
    mkdir /data/adb/modules 0700 root root
    mkdir /data/adb/post-fs-data.d 0700 root root
    mkdir /data/adb/service.d 0700 root root
    mount tmpfs tmpfs /debug_ramdisk mode=0700,uid=0,gid=0
    mkdir /debug_ramdisk/.magisk 0700 root root
    exec -- /system/bin/vmroot-setup.sh stage1

service magiskd /system/bin/magisk --daemon
    class late_start
    user root
    group root
    oneshot

on property:sys.boot_completed=1
    exec_background -- /system/bin/vmroot-setup.sh stage2
```

## 6. 契约 props（build.prop 追加）

```
ro.aemu.rom=1
ro.aemu.rom.name=aosp15-gsi-vmroot
ro.aemu.rom.version=15.1.0-vmroot.1
ro.aemu.rom.build=BP11.241210.004-12926906
ro.aemu.root.mode=magisk-system
ro.aemu.root.version=31.1
ro.aemu.xposed.api=100
ro.aemu.xposed.module=/system/etc/aemu/LSPosed-zygisk.zip
ro.aemu.xposed.autosetup=1
```

引擎侧：`getprop ro.aemu.rom` 即可识别本 ROM；`ro.aemu.xposed.api=100` 与 app 侧 XposedBridge VERSION=100（0.0.0.5 桥接 jar，docs/02 第 6 节）对齐。

## 7. 改版后校验（实录）

- debugfs 复查：全部注入文件 mode/uid/gid 正确；build.prop 尾部契约段在案；vmroot.rc 内容正确（cat）；`ea_list` 显示 `security.selinux (26) = "u:object_r:system_file:s0\000"`。
- `e2fsck -fy` 通过：`4212/4256 files, 444102/456409 blocks`，无错误。
- 压缩交付：`gzip -1` → 959,189,334 B；SHA-256 `288e44ad58dd6da97ede0e926dfdd872a9e96e80249f442fbf293379bce00bc5`。

## 8. 交付物

| 位置 | 内容 |
| --- | --- |
| GitHub Release `android15-gsi-vmroot-v1` | aosp15-gsi-arm64-vmroot-v1.img.gz（915MB）+ Magisk-v31.1.apk + LSPosed-zygisk-v1.9.3mod.zip |
| 本地 `download/aosp15-gsi-arm64-vmroot-v1.img.gz` | 同 gz（959MB） |
| 本仓库 `scripts/gsi-patch/` | apply.sh（可重跑的注入流水线）+ vmroot.rc / vmroot-setup.sh / su / README.txt 原件 |

## 9. 已知限制与下一阶段

1. **SELinux 必须宽容启动**（引擎内核参数 `androidboot.selinux=permissive`）：GSI 的 plat_sepolicy 无 magisk 域，强制模式下 magiskd/su 会受限。这与 VMOS 类产品做法一致（VM 内宽容、宿主侧隔离）。
2. **Zygisk 开关**：LSPosed 种子模块自动安装，但 Zygisk 需在 Magisk 管理器（或 magisk.db settings）开启后才实际加载——引擎可后续通过写 magisk.db 实现"全自动"。
3. **inode 余量 46**：继续往镜像加文件空间有限；若要预装大量 app，改走 mke2fs 重新打包（工具已就位）。
4. **LSPlant/Pine 进程内加载器（docs/02 遗留）仍是 hook 执行通路的下一阶段**：本 ROM 提供的是系统侧 root + LSPosed 运行环境；app 侧进程内 hook 与本 ROM 契约（props/su/magiskd）对接后即闭环。
5. GMS 版 GSI 同直链模式可取（`gsi_gms_arm64-*`），如需 Play 服务再开分支。
