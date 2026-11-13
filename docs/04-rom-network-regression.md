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

- 上一轮产物已丢失，本排查依赖用户重新上传原版 ROM 分发包（537MB）后重建改版 rom.img 才能执行 diff。
- 若时间紧张：优先做第 6 节三步 DNS 实证 + 第 3 节 hosts/props/init.rc diff，覆盖 80% 常见翻车面。
