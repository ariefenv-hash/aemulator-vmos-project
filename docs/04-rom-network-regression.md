# 04 - ROM 网络丢失回归 bug 排查协议

## 1. 症状（第 7 轮用户报告，尚未排查）

- 原版 ROM（安卓 12 分发包）进入后**网络正常**。
- 上一轮改版（加入 root/Xposed 组件后的 ROM）后**容器内网络消失**。
- 用户未能下载到改版产物，无法现场复测；要求先做**代码层面检查**。

## 2. 排查原则

- 改版来源只有三类改动面：① rom.img 内系统改动（init.rc / props / sepolicy / hosts）；② Magisk 组件部署（magisk.img / sepolicy.rule / 模块挂载）；③ superuser/xposed 组件挂载。逐层二分定位，不要并行改。

## 3. 代码层检查清单（拿到两版 rom.img 后按序执行）

1. **diff 系统配置**（解包两版 rom.img，逐文件对比）：
   - `/init*.rc` 与 `/system/etc/init/*.rc`：netd / dnsmasq / tethering 相关服务段是否被改动或丢失；
   - `/system/etc/hosts`：是否被改写为 0.0.0.0 条目；
   - `build.prop`：`ro.dns`、`net.dns1`、`persist.sys.proxy`、`ro.ethernet.*` 是否被改；
   - `/system/etc/security`、`/system/etc/public.libraries.txt` 是否被意外替换。
2. **sepolicy diff**：新加 Magisk/superuser 的 `sepolicy.rule` 或 patch 后的 `sepolicy` 是否缺了 `netd`、`dhcp`、`dnsproxyd`、`netd_service` 相关 allow；改版常见翻车点是 magiskinit patch 后 `netdomain` 被拒。
3. **iptables/init 链**：改版 init 脚本若加过 NAT/forward 规则，检查是否漏了 `ip_forward` 或清空了 nat 表。
4. **权限层**：目标应用（浏览器/壳进程）`INTERNET` 权限与 `net_raw` 组未被剥离。
5. **引擎层**（libkr shim）：syscall 拦截表改动是否误伤 `socket/connect/getaddrinfo` 相关调用（对照上游 commit `3b97ed5` 与改版 diff）。
6. **DNS 实证**：容器内 `getprop net.dns1`、`ping 8.8.8.8`（IP 通但域名不通 = DNS 层）、`ping 网关`（网关不通 = 引擎/iptables 层），三步即可把故障定位到具体层。

## 4. 逐层回滚法（配置 diff 无果时）

1. 原版 rom.img + 仅 Magisk → 测网络；
2. + superuser → 测；
3. + xposed（LSPlant/Pine 层）→ 测；
4. 第一步引入即断网 → 锁定 Magisk 部署脚本；第二步断 → superuser init 注入；第三步断 → hook 层在 zygote 前的注入影响 netd 启动。

## 5. 修复后必须做的冒烟清单

启动进入 ROM / Wi-Fi-图标与 Settings 网络页 / 浏览器加载外网 / root 开关 / 模块启用停用 / 应用导入（docs/03 通路）/ side-by-side 共存变体同样跑一遍。

## 6. 备注

- 对照输入已齐备：原版 ROM 分发包（Release `rom_default_12.1.0_1034.zip`）与修改版（`rom_default_12.1.0_1034_root_xposed_api100.zip`）均在 Release，可直接 diff。
- 若装机后无网且时间紧张：优先做第 3 节三步 DNS 实证 + 第 7 节哈希比对，覆盖 80% 常见翻车面。

## 7. 2026-11-14 实施结果：ROM v2（构建期修复）

- 产出 `rom_default_12.1.0_1034_root_xposed_api100.zip`（Release）：以**原档条目更新式**重打包（2907 原始条目全部保真 + 8 项纯新增：`fs/system/bin/su`、`fs/system/xbin/su`、`fs/sbin/su`（0755，请求文件协议对齐 SuDaemon）、`fs/data/aemu-su/{req,resp}`（0777）、`fs/system/xposed.prop`（version=100）、`fs/system/framework/XposedBridge.jar`（API 100 真实桥接）、`fs/system/app/Superuser.apk` 标记）。
- **网络文件零改动**（修复策略 = 只增不改）。注入后基线哈希（sha256，装机后可用 `sha256sum` 比对）：
  - `system/build.prop` 4114B `8d53a1686acec35f779c57013c2da3e682e2909e8f83fab6bc2341eedb279880`
  - `system/etc/hosts` 56B `425c3e713d5bae19b031bc8639c20c6a23e311a54647ba1824cbf45969a11ff4`
  - `init.environ.rc` 463B `cb612c1ab9a5edf2a70664a881e6f80aa3b97088c98ef7a8dca69d569c1a8b14`
  - `system/bin/netd` 602504B `aa9b215417d3a4427695748d929a115c86d33f7869d8c6a56488fb09737d1917`
  - `system/etc/ueventd.rc` 3084B `f2223150afaa7dcaf20fe47dfe8a0fbf0d377f5f8065fecf373049e316a6d446`
- 宿主侧 DNS 桥（dnsproxyd）与 netd 通路未触碰；若装机后仍无网络，按第 3/4 节协议走 VM 菜单 → Network 自检行定位（桥未接管 = "Restart netd"）。
- 工具链：真 7-Zip 25.01（py7zr 拒绝树外符号链接，不可用）；重打包方式 = 以原 7z 为底 `7zz a` 条目更新，条目总数 2907→2918。
