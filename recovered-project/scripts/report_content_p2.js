// Report content part 2: chapters 5-9 + appendix
// All strings use backtick template literals so Chinese curly quotes are safe.

const ch5 = {
  title: `第五章 Root 实现方案深度解析`,
  paras: [
    `客户端以 IVMStartupTask 启动任务的形式实现 Root 组件的注入与卸载，按 ROM 版本提供两套互补方案：SuperuserTask 面向 Android 5.1/7.1 旧固件，MagiskTask 面向 Android 9 及以上新固件。两套方案的全部字符串常量经 StringFog 解密还原，文件路径与逻辑流程完整可见。`,
    `SuperuserTask（install_superuser）采用 koushikdutta 开源 Superuser 的注入形态：把 Superuser.apk 连同 Superuser.odex 与 arm/oat/arm64 编译缓存写入 guest 的 /system/app/Superuser/；在 /system/xbin/ 放置 su 二进制与 daemonsu 守护进程，并在 /system/bin/su 建立指向；改写 /system/etc/init/hw/init.rc（或 rootfs 顶层 init.rc）以在开机时拉起守护进程；授权通道为 Unix 域套接字 /dev/socket/com.koushikdutta.superuser.daemon。guest 内应用请求 Root 时，su 客户端连接该套接字由守护进程弹窗授权——由于 guest 的内核语义由宿主引擎提供，守护进程与 su 进程的用户身份完全由引擎决定，因此这套机制在 guest 内表现为“真实生效的 Root”。`,
    `MagiskTask（install_magisk）则注入完整 Magisk 环境，组件来源即 ROM 包中的 magisk.zip（Magisk v27.0，URI 参数 v=27000）。注入路径包括：/sbin/ 下的 magisk、magisk32、magisk64、magiskpolicy、resetprop、su 与 stub.apk，以及 /sbin/.magisk/{block,preinit,mirror,worker} 运行时目录；/data/adb/magisk/ 下的 busybox、magiskboot、magiskinit、magiskpolicy（各含 32/64 位变体）与 /data/adb/{post-fs-data.d,service.d,modules} 模块目录；Magisk Manager 以 com.topjohnwu.magisk.apk 形式强制写入 /data/app/（指南也注明会强制安装旧版 Magisk）。init.rc 注入模板为一段以 # magisk start 与 # magisk end 标记的块：on post-fs-data 触发 exec /sbin/magisk --post-fs-data，on property:vold.decrypt=trigger_restart_framework 与 on nonencrypted 触发 --service，sys.boot_completed=1 触发 --boot-complete，zygote 重启事件触发 --zygote-restart；另含 pfdsvc 与 lssvc 两个显式服务定义（user root、seclabel u:r:magisk:s0、oneshot）。`,
    `卸载路径同样完备：关闭 Root 时任务会从 init.rc 中摘除标记块、删除 /sbin 与 /data/adb 下的注入文件、卸载 com.topjohnwu.magisk 包并清理 /cache/magisk.log 等痕迹。整个流程以 VMStatusEvent(install_magisk) 等事件上报宿主 UI。`,
    `值得注意的是，guest rootfs 是普通目录树，注入即写文件、改 init 即改文本——不存在刷机、boot image patch 或内核模块加载。Magisk 的 magiskinit 之所以能工作，是因为 guest 的 init 与内核语义都由引擎解释执行：引擎读取 init.rc 并按其语义拉起服务，/sbin/magisk 服务进程以引擎赋予的特权身份运行。这正是“引擎内核”架构下 Root 的实现本质，也是迁移到 AEmulator 时可以直接复用的关键。`,
  ],
  table: {
    caption: `表 5-1  两套 Root 方案注入路径对比`,
    header: [`要素`, `SuperuserTask（5.1/7.1）`, `MagiskTask（9/11/12）`],
    rows: [
      [`管理器 APK`, `/system/app/Superuser/Superuser.apk`, `/data/app/com.topjohnwu.magisk.apk`],
      [`su 位置`, `/system/xbin/su、/system/bin/su、daemonsu`, `/sbin/su（经 /sbin/magisk 管理）`],
      [`守护/服务`, `/dev/socket/com.koushikdutta.superuser.daemon`, `/sbin/magisk --post-fs-data / --service 等`],
      [`init.rc 注入`, `守护进程服务段`, `# magisk start…# magisk end 标记块`],
      [`辅助目录`, `system/app/Superuser/arm、oat/arm64`, `/sbin/.magisk/*、/data/adb/magisk/*、modules、post-fs-data.d、service.d`],
      [`组件来源`, `su_uri（superuser.zip）`, `magisk_uri（magisk.zip?v=27000）`],
      [`卸载`, `摘 init.rc 段 + 删文件`, `摘标记块 + 删 /sbin、/data/adb + 卸载管理器`],
    ],
  },
};

const ch6 = {
  title: `第六章 Xposed 与模块兼容体系`,
  paras: [
    `XposedTask（install_xposed）实现了经典 rovo89 式的框架注入：将 guest 的 /system/bin/app_process32 与 app_process64 复制为 app_process_orig 与 app_process_xposed 并替换原文件，使 guest 的所有 Java 进程（含 zygote 派生的应用进程）启动时加载 Xposed 桥接层；同时在 /system/framework/ 放置 XposedBridge.jar（Xposed API），在 /system/lib 与 /system/lib64 放置 libxposed_art.so（ART 版 hook 引擎），写 /system/xposed.prop 版本属性，并把 XposedInstaller.apk（de.robv.android.xposed.installer）连同 odex/oat 缓存写入 /system/app/XposedInstaller/。该方案面向 Android 5.1/7.1 固件，与 SuperuserTask 配套。`,
    `对新固件（Android 9/11），官方指南给出的路线是：导入 Magisk APK 自动注入 Magisk 环境，再按常规方式刷入 LSPosed（Zygisk 版 v1.9.2-7024-7024 release zip）模块包——即 guest 内的 Magisk 负责装载 Zygisk，Zygisk 注入 LSPosed，LSPosed 提供现代 Xposed API 与模块管理。由于 Magisk Manager 被强制安装为旧版，模块刷入依赖旧版管理器的模块安装通道。`,
    `宿主侧另有一条与 guest 系统级 Xposed 并行的应用级 hook 路线：四套 hook 引擎（Epic、Pine、LSPlant、AliuHook）配合 pine_xposed_api.dex 与 aliu_xposed_api.dex，为“克隆空间”中被克隆的应用提供 XposedBridge 兼容 API。这表明开发团队同时维护着免 Root 的、进程注入式的 Xposed 兼容实现——该思路与 LSPatch（免 Root、向目标 APK 内嵌 dex/so）同类，对 AEmulator 的引擎级注入方案同样具有参考价值。`,
    `生态现状提示：LSPosed 官方仓库已于 2024 年初归档停更，社区由 JingMatrix/Vector（原 LSPosed fork 重构，基于 LSPlant 的 Zygisk 模块）接续维护，Zygisk 本身则由 PerformanC/ReZygisk 等项目续作。AEmulator 在选型 Xposed 兼容层时应以 LSPlant + libxposed API 兼容为基座，兼容模块生态则同时考虑经典 Xposed API 与现代 LSPosed API 两种模块形态。`,
  ],
  table: {
    caption: `表 6-1  XposedTask 注入清单（经典 Xposed 路线）`,
    header: [`目标路径`, `内容`, `作用`],
    rows: [
      [`/system/bin/app_process{32,64}`, `替换为 xposed 版，原件存为 _orig/_xposed`, `zygote 启动即注入 hook`],
      [`/system/framework/XposedBridge.jar`, `Xposed API 桥接`, `模块运行时依赖`],
      [`/system/lib{,64}/libxposed_art.so`, `ART hook 引擎`, `方法 hook 实现`],
      [`/system/xposed.prop`, `版本属性`, `框架状态标记`],
      [`/system/app/XposedInstaller/XposedInstaller.apk`, `管理器（含 odex/oat/arm）`, `模块安装与开关 UI`],
    ],
  },
};

const ch7 = {
  title: `第七章 迁移蓝图：AEmulator 的 Root 与 Xposed 实现方案`,
  paras: [
    `架构前提。AEmulator 对 Android 5.0-17 固件的处理方式是：固件自身的 arm64 程序在手机核心上原生运行，每个 Android 版本一个引擎内核拦截系统调用，binder 由守护进程替代，图形经 GL 桥接，guest 端以小库（audio HAL、LD_PRELOAD shim 等）适配。这与 Virtual Master 的引擎内核架构同源。由此得出关键判断：guest 内进程的 uid、SELinux、文件权限等内核语义全部由引擎决定，Root 无需内核级补丁，可以在引擎与 rootfs 两个层面直接实现。AEmulator 的固件导入器（importer）本就会读取固件 boot image 中的 init 脚本并构建系统服务启动计划——这正是注入 Root 与 Xposed 的天然挂载点。`,
    `第一层：组件化 RootKit 注入。照搬 Virtual Master 的 manifest 组件模式，在 AEmulator 的固件导入流程中加入 Root 预处理通道：rootfs 解包后，将 RootKit 组件写入文件系统——推荐 Android 15 路线直接注入 Magisk 组件（magiskinit、magiskpolicy、busybox、magisk 主程序进 /sbin，32/64 位按固件 ABI 取舍），并把与 Virtual Master 同构的 init.rc 标记块（# magisk start…# magisk end，on post-fs-data / late_start service / boot-complete / zygote-restart 四类触发）写入 init.rc；引擎启动计划按该块拉起 magiskd。管理器 APK（Magisk Manager 或自研）放入 guest /data/app 使其随系统加载。旧固件兼容则用 Superuser 轻量路线（su + daemonsu + 授权套接字）。`,
    `第二层：引擎级超级用户管理。这是可以超越 Virtual Master 的部分：把授权决策从 guest 内的守护进程上移到宿主应用——guest 内 su 客户端经引擎 IPC（引擎内核本就拦截全部系统调用，可规定专用的授权协议通道）向宿主 SuperuserManager 发起请求，宿主弹窗或按策略库裁决，批准后由引擎将该 guest 进程的 uid 置零。此设计带来三项能力：全局超级用户总开关（一键启停 Root）、逐应用授权策略（永久/一次性/限时）与完整授权日志。同时满足“修改后的 ROM 能被识别为已 Root 并自动应用于全局”的目标：guest 内应用的常规 Root 检测点（PATH 中的 su、getuid 置零能力、/data/adb 目录、ro.debuggable 与 ro.build.tags 等）全部由 rootfs 注入与引擎应答共同覆盖。`,
    `第三层：Xposed/模块兼容。提供双路线：其一，完整生态路线——guest 内置 Magisk 后按标准方式装载 Zygisk 与 LSPosed/Vector，模块仓库生态原样可用（Android 15 GSI 上优先验证此路线）；其二，引擎注入路线——利用 AEmulator 已有的 guestshim/LD_PRELOAD 注入点，在 zygote fork 应用进程时由引擎注入 LSPlant/Pine hook 与 XposedBridge API 兼容层（类似 Virtual Master 宿主侧 pine_xposed_api.dex 的做法），实现免 Magisk 的全局 hook。配套在宿主应用内实现模块管理器：扫描 guest /data 中的模块 APK、解析其 assets/xposed_init 与 scope 元数据、提供模块开关/作用域/日志管理，对齐 LSPosed Manager 的核心体验。`,
    `第四层：ROM 分发与 adb 修复。ROM 分发建议照搬“manifest.json 清单 + 组件 URI（rom/magisk/su/xposed/play）+ 可选组件按需拉取”的架构——它天然支持“通刷包 + 功能组件”的解耦与后续在线更新；加密层不必沿用可被已知明文攻破的 16 字节 XOR，改用 AES-GCM 并对清单签名。针对 AEmulator 现存痛点 adb shell 残废（多数命令失效），根因是引擎内核对 toybox 常用命令所需的系统调用集拦截不全：建议按 bionic 常用命令的系统调用画像补全引擎 syscall 表，或让 shell 会话经引擎 IPC 由宿主代为执行；Root 注入完成后，shell 进程经授权即为 uid 0，配合补全的 syscall 即可提供完整 root shell。`,
  ],
  table: {
    caption: `表 7-1  迁移实施阶段规划`,
    header: [`阶段`, `内容`, `依赖/验证`],
    rows: [
      [`P1 基础 Root`, `rootfs 注入 su+daemonsu、init.rc 服务段、宿主授权弹窗`, `Android 12/15 GSI 导入后 guest 内 su 可用`],
      [`P2 管理面`, `SuperuserManager：全局开关、逐应用策略、日志`, `guest 内应用 Root 检测全通过`],
      [`P3 Magisk 路线`, `magiskinit/policy/busybox 注入 /sbin、init.rc 标记块、Manager APK`, `guest 内 Magisk 正常启动、可装 Magisk 模块`],
      [`P4 Zygisk+LSPosed`, `Zygisk 装载、LSPosed/Vector 刷入`, `经典 LSPosed 模块可用`],
      [`P5 引擎注入 Xposed`, `guestshim 注入 LSPlant/Pine + API 兼容层`, `免 Magisk 全局 hook 生效`],
      [`P6 组件化分发`, `manifest 清单 + 组件 URI + AES-GCM 加密`, `通刷包 + Root/Xposed 组件按需安装`],
      [`P7 adb 修复`, `syscall 表补全 / 宿主代执行 shell`, `root shell 下常用命令全通`],
    ],
  },
};

const ch8 = {
  title: `第八章 Android 15 AOSP GSI 通刷包路线`,
  paras: [
    `目标固件选型。用户明确以 Android 15 为底的 AOSP 通刷包为目标，对应官方渠道为 Android 开发者站点的 Generic System Image（GSI）发布页：Google 为每个平台版本发布 arm64 与 x86_64 两个变体的 AOSP GSI（含 blobless 版），可直接用于支持 Project Treble 的设备验证。社区侧 TrebleDroid 系列 GSI（如 phhusson/trebledroid 谱系与 AndyYan 等维护的构建）在非原生设备上的兼容性调优更充分，也可作为备选。AEmulator 官方说明明确支持导入 GSI（Android 8-17），因此固件获取不是瓶颈。`,
    `落地要点。GSI 本质是 system 分区镜像，导入 AEmulator 后由 importer 提取 init 脚本构建启动计划。需要处理的适配点包括：其一，Root 注入按第七章方案对 system 镜像做文件级注入（GSI 可解包为目录树，或经 AEmulator 已有的 recovery ZIP/Odin/factory image 等导入管线处理）；其二，SELinux 语义——Android 15 默认 enforcing 且 neverallow 众多，引擎内核需伪造或放宽 magisk/su 域的检查（Virtual Master 的做法是在 init.rc 服务定义中直接标注 seclabel u:r:magisk:s0，AEmulator 可在引擎层等效实现）；其三，APEX 模块化组件（com.android.adbd、media 等）在 GSI 中以预装 APEX 存在，引擎需要支持其运行时语义；其四，32 位兼容——AOSP 15 GSI 主线为 arm64-only，support_a32 应置 false，旧 32 位应用依赖 AEmulator 对 2.3-4.4 固件的 QEMU 翻译管线而非本路线。`,
    `验证清单。建议按以下顺序验证：GSI 导入与首次启动（guest system_server 正常拉起）→ Root 组件注入与 su 可用 → 超级用户管理面（开关/策略/日志）→ Magisk 环境与 Zygisk → LSPosed/Vector 与代表性模块 → 宿主 adb 全量 root shell。每一步均对应第七章的阶段规划，任何一步失败都不阻塞前序成果的交付。`,
  ],
};

const ch9 = {
  title: `第九章 开源参考实现与实施边界`,
  paras: [
    `可复用的开源组件。LSPlant（LSPosed 的 ART hook 引擎，GPL）与 Pine（canyie）提供 Java 层 hook 基座；Vector（JingMatrix，LSPosed 社区接续）提供现代 Xposed 框架形态；ReZygisk（PerformanC）延续 Zygisk 装载能力；Magisk v27+ 的 magiskinit/magiskpolicy/busybox 组件可直接用于 rootfs 注入（遵循其 GPL 许可义务）；LSPatch 的“向 APK 内嵌 hook 组件”思路可参考于逐应用注入场景；KernelSU/APatch 的管理器 UI 与授权策略模型值得在宿主 SuperuserManager 设计中借鉴。Virtual Master 本体的逆向结论（本报告第四至六章）即是移植的直接蓝本。`,
    `实施边界与风险。其一，AEmulator 为 GPL-3.0 项目，集成上述 GPL 组件需保持许可一致；其二，Android 15 guest 对引擎内核的系统调用覆盖、APEX、linkerconfig 等新机制提出更高要求，P4/P5 阶段存在适配工作量不确定的风险；其三，LSPlant/Pine 对新 ART 内部结构的适配需要跟随 Android 大版本更新维护；其四，Root 能力的合规性——AEmulator 作为开源项目可以光明正大提供该功能（Virtual Master 隐藏开关是为规避 Play 审核），若未来上架 Google Play 需要参考其开关策略设计“导入即用、默认关闭”的产品形态。`,
    `本报告分析所用样本为用户提供的破解版 APK 与 ROM 数据包，全部结论仅用于个人学习与技术研究；相关商标与代码权利归属原开发者（Eden Technology HongKong Limited、topjohnwu、rovo89/LSPosed 团队及各开源作者）。`,
  ],
  table: {
    caption: `表 9-1  参考实现清单`,
    header: [`项目`, `定位`, `对本方案的用途`],
    rows: [
      [`uxazu/AEmulator`, `GPL-3.0，Android 2.3-17 固件模拟器`, `迁移目标宿主：importer/引擎内核/guestshim`],
      [`Magisk (topjohnwu)`, `v27+ 组件：magiskinit/policy/busybox`, `Android 15 路线的 Root 注入组件`],
      [`LSPlant`, `ART hook 引擎（LSPosed 系）`, `Xposed 兼容层基座`],
      [`JingMatrix/Vector`, `LSPosed 社区接续（Zygisk 模块）`, `现代模块框架装载`],
      [`PerformanC/ReZygisk`, `Zygisk 续作`, `Zygisk 注入通道`],
      [`canyie/Pine + Dreamland`, `ART hook 与 Xposed 框架`, `备选 hook 引擎`],
      [`LSPatch`, `免 Root Xposed（APK 内嵌）`, `逐应用注入思路参考`],
      [`KernelSU / APatch`, `内核级 Root 与管理器`, `SuperuserManager UI 与策略模型参考`],
    ],
  },
};

const appendix = {
  title: `附录 逆向产物与脚本清单`,
  paras: [
    `本次逆向在沙箱 /home/z/my-project 下产出以下持久化资产：分析脚本位于 scripts/（rom_zip_inspect.py、unpack_epic_dex.py、stringfog_decrypt.py、stringfog_decrypt2.py、rom_keystream_derive.py、rom_full_decrypt.py、rootfs_peek.py、plugin_decrypt_try.py）；解出的 4 个 DEX 位于 analysis/epic_dex/；APK native 库位于 analysis/native/lib/arm64-v8a/；完整反编译源码位于 decompiled/vm-dex/（9525 类）；StringFog 解密样例位于 decompiled/vm-dex-decrypted/ 与 decompiled/vm-classes-dec/（MagiskTask、SuperuserTask、XposedTask、RomConfig）。`,
    `关键结论速查：EPIC 壳 DEX 解密密钥为单字节 0x46；StringFog 为重复密钥 XOR；ROM 分发 e=x 密钥流为 16 字节 ASCII 串 %z89aviCM0KkbEs9（hex 257A3839617669434D304B6B62457339），c=v2 为 7z/LZMA；guest rootfs 为宿主私有目录树（fs/），Root/Xposed 全部由客户端启动任务（SuperuserTask/MagiskTask/XposedTask）按 manifest 组件配置注入 init.rc 与文件系统实现。`,
  ],
};

module.exports = { ch5, ch6, ch7, ch8, ch9, appendix };
