// Report content part 1: abstract + chapters 1-4
// All strings use backtick template literals so Chinese curly quotes are safe.

const abstractText = [
  `本报告基于对 Virtual Master - Android Clone（包名 com.clone.android.dual.space，开发者 Eden Technology HongKong Limited，版本 3.2.67）的完整逆向工程，还原其 Android-on-Android 虚拟化架构、ROM 分发加密格式、Root 注入方案与 Xposed 兼容体系，并给出向开源项目 AEmulator（uxazu/AEmulator）迁移的完整技术蓝图。`,
  `逆向核心成果包括：其一，破解了其 EPIC 壳保护——APK 中唯一的 classes.dex 仅有 3.3KB 桩代码，真实业务代码藏于 assets/EPIC/*.Epic，经分析为单字节 XOR（密钥 0x46）加密的标准 DEX 文件，解出 4 个共 17.8MB 的主代码并完成反编译；其二，还原了 ROM 数据包格式——外层为普通 ZIP 容器加 manifest.json 清单，rom.img/rom1.img 采用自研 e=x 加密与 c=v2 压缩，经已知明文推导与双 CRC32 验证，确认加密为 16 字节 ASCII 密钥流 %z89aviCM0KkbEs9 的循环异或，压缩为 7z，成功解出完整的 Android 12 rootfs 目录树；其三，完整还原了三套 Root/Xposed 注入任务（SuperuserTask、MagiskTask、XposedTask）的全部文件路径与 init.rc 注入模板。`,
  `迁移方案结论：AEmulator 与 Virtual Master 在 5.0+ 固件上同为引擎内核架构（guest 原生 arm64 执行、宿主拦截系统调用），因此 Virtual Master 的 Root 体系可以低成本移植。方案核心为组件化 RootKit（su 守护进程或完整 Magisk 组件注入 rootfs 并改写 init.rc）、引擎级超级用户管理器（授权 IPC、全局开关、逐应用策略）、基于 LSPlant/Zygisk 的 Xposed 兼容层与模块管理器，并以 Android 15 AOSP GSI 作为目标通刷固件。`,
];

const ch1 = {
  title: `第一章 产品身份确认与技术定位`,
  paras: [
    `本次分析的样本为用户提供的 APK（文件名“虚拟大师_3.2.67.apk”，169MB，含 arm64-v8a 与 armeabi-v7a 双架构）。经 AndroidManifest 反编译确认，其包名为 com.clone.android.dual.space，入口 Activity 为 com.android.vmapp.ui.MainActivity。按包名检索 Google Play 与 APKMirror 等分发站，确认该应用的正名为 Virtual Master - Android Clone，开发者登记为 Eden Technology HongKong Limited。它与国内湖南小算科技的 VMOS Pro（包名 com.vmos.pro，官网 vmos.cn）是两家完全不同的公司的产品，中文俗称“虚拟大师”造成的重名不应混淆。`,
    `Virtual Master 的产品形态是在宿主 Android 应用内运行一套完整的客座 Android 系统（guest）。Google Play 发行版内置 Android 7.1.2 镜像，其余版本（4.2.2 至 12.1）以额外系统镜像形式分发，其中较新版本仅通过开发者 Telegram 频道与 VIP 渠道提供——用户上传的 rom_default_12.1.0_1034.zip（Android 12.1，rom_version 1034）正是这一类配套 ROM 数据包。应用在 Google Play 约有百万级安装、3.7 分评分。`,
    `需要特别指出的是：该应用在设置界面中并不提供 Root 或 Xposed 的开关。这不是功能缺失，而是刻意为之的产品策略——公开文档（andnixsh 于 2024 年 10 月发布的指南）明确说明，开发者通过 Telegram 群指导用户以“向虚拟机导入 Superuser/Magisk/Xposed Installer 安装包”的方式激活这些能力，以此规避 Google Play 服务条款对提供 Root 功能应用的限制。这一隐藏机制正是本次逆向要还原的核心。`,
    `技术定位方面，Virtual Master 属于应用级 Android-on-Android 虚拟化：guest 与宿主 CPU 架构一致（arm64 宿主跑 arm64 guest，无指令翻译），guest 作为宿主应用的一组进程运行，由应用自带的用户态内核层虚拟化系统调用。这与 AEmulator 对 Android 5.0 以上固件的处理方式（固件自带 arm64 程序原生运行于手机核心，每个 Android 版本一个引擎内核拦截系统调用）在架构上同源，是二者方案可以互相迁移的根本前提。`,
  ],
};

const ch2 = {
  title: `第二章 客户端保护体系与逆向突破`,
  paras: [
    `APK 结构上，客户端使用了深度定制化的壳保护。全部 classes.dex 仅 3332 字节，是一个桩（stub）；真实业务代码存放于 assets/EPIC/ 目录下的四个 .Epic 文件（2rxLq.Epic 579KB、Y1bHf.Epic 12.5MB、Z7z593Ur.Epic 2.4MB、yDB7m.Epic 2.35MB）。运行时由 libEPIC.so 中的加载器解密并动态装载，这就是 jadx 直接反编译 APK 时找不到 com.vmos 或 com.android.vmapp 主包的原因。`,
    `对 .Epic 文件的格式分析显示，其头部呈现与标准 DEX 头（magic 6465780A，即 dex\n035/037）逐字节相关的固定模式。经试验，四个文件均为单字节 XOR 密钥 0x46 加密的标准 DEX——将密文整体异或 0x46 后，四个文件头全部恢复为 dex\n035 或 dex\n037 合法魔数。解出后经 jadx 反编译共恢复 9525 个类、生成 7179 个 Java 源文件，核心业务包 com.android.vmcore 与 com.android.vmapp 全部可见。`,
    `代码内的字符串常量还叠加了一层 StringFog 字符串加密（开源方案 StringFog 的混淆变体）：所有敏感字符串以 byte[] 密文加 byte[] 密钥的形式内联在字节码中，运行时经重复密钥 XOR 解密。本次分析实现了 StringFog 的批量静态解密脚本，将 RomConfig 等关键类中的字段名（id、display_name、rom_version、os_version、support_a32、support_a64、minimum_app_ver、magisk_uri、su_uri、xposed_uri、play_uri 等）全部还原，与 ROM 包 manifest.json 实际内容逐字段吻合。`,
    `libEPIC.so 的符号表进一步暴露了 EPIC 保护体系的完整字段设计，包括 dex_protection_method/rc4_key/xor_key、epic_meta_rc4_key、vm_protection_method/rc4_key/xor_key、asset_protection_method/rc4_key/xor_key/module、axml_protection_method/rc4_key/xor_key、resource_string_protection_method/rc4_key/xor_key 与 certificate_md5 等。该体系集成了爱奇艺 xHook（PLT hook）、Dobby（inline hook）与 XposedBridge/XposedInterface 符号，说明壳本身也承担了宿主侧 Java hook 的职责。`,
  ],
  table: {
    caption: `表 2-1  EPIC 壳保护体系字段（自 libEPIC.so 符号还原）`,
    header: [`保护对象`, `控制字段`, `加密配置`, `说明`],
    rows: [
      [`dex`, `dex_protection_method`, `rc4_key + xor_key`, `主代码 DEX 保护`],
      [`epic_meta`, `（无 method 字段）`, `epic_meta_rc4_key`, `壳元数据`],
      [`vm`, `vm_protection_method`, `rc4_key + xor_key`, `Epic VM 补丁字节码（Epic.vm）`],
      [`asset`, `asset_protection_method`, `rc4_key + xor_key + module`, `assets 资源（含插件 zip）`],
      [`axml`, `axml_protection_method`, `rc4_key + xor_key`, `二进制 XML`],
      [`resource_string`, `resource_string_protection_method`, `rc4_key + xor_key`, `资源字符串`],
      [`signature`, `certificate_md5`, `—`, `签名完整性校验`],
    ],
  },
};

const ch3 = {
  title: `第三章 虚拟化架构解析`,
  paras: [
    `反编译后的核心包 com.android.vmcore 揭示了 guest 的实现方式：虚拟机不是块设备镜像，而是宿主应用私有目录下的一棵目录树 rootfs（内部分区约定为 fs/）。MagiskTask 等启动任务直接以 new File(rootfsPath, "/init.rc") 这样的方式读写 guest 的文件系统。启动期任务链包括 setup 包的 PrepareFsTask、InstallFsTask、ChmodFsTask、FixFsTask、CleanFsTask、CleanCacheTask，以及 startup 包的 MagiskTask、SuperuserTask、XposedTask 与 Bug1FixTask 至 Bug8FixTask（针对特定固件的兼容性修复）。`,
    `native 层组件的分工与 AEmulator 高度相似：libvm.so（9.7MB）是核心虚拟机引擎；libkr64.so 与 libkr32.so 是通用内核 shim，而 libkr64.11.so、libkr64.12.so（及其 32 位对应物）则是按 Android 版本划分的内核 ABI 适配层——即所谓的每个 Android 版本一个内核；libkrloader32/64.so 负责装载内核 shim；libadb.so 在应用内提供 ADB 能力（含无线配对的 AES-128-GCM PairingContext）；libun7z.so（JNI 封装为 im.amomo.andun7z.AndUn7z）负责 ROM 组件的 7z 解包。`,
    `hook 能力方面，应用内置了四套 Java 层 hook 引擎：libEPIC.so（自带 XposedBridge/XposedInterface 符号与 Epic.vm 补丁字节码虚拟机）、libpine_*.so（知名开源 ART hook 框架 Pine，作者 canyie）、liblsplant_*.so（LSPosed 的 ART hook 引擎 LSPlant）与 libaliuhook_*.so；同时附带 pine_xposed_api.dex 与 aliu_xposed_api.dex 两个 XposedBridge API 兼容层。这些引擎主要服务于应用内“克隆空间”（dual space，即包名中的 clone/dual 语义）的免 Root 应用虚拟化 hook，与 guest 内的系统级 Xposed 是两条并行路线。`,
    `与 AEmulator 对比：AEmulator 的 5.0+ 引擎同样采用“固件 arm64 程序原生运行 + 引擎内核拦截系统调用 + 用户态 binder 守护进程 + GL 桥接图形 + guest 端小库适配”的组合。二者在引擎内核、binder、图形桥上的思路一致；差异在于 Virtual Master 为每个 Android 版本预编译了专用内核 shim（kr64.11/kr64.12），而 AEmulator 同样宣称按版本提供引擎内核。这意味着 Virtual Master 的 Root 方案（对 guest 文件系统与 init 的直接操作）完全可以映射到 AEmulator 的 importer 与启动计划机制上。`,
  ],
  table: {
    caption: `表 3-1  Virtual Master native 组件清单（arm64-v8a）`,
    header: [`组件`, `体积`, `职能`],
    rows: [
      [`libvm.so`, `9.7MB`, `核心 VM 引擎：guest 进程调度、系统调用虚拟化`],
      [`libkr64.so / libkr32.so`, `1.3-1.6MB`, `通用内核 shim（64/32 位）`],
      [`libkr64.11.so / libkr64.12.so 等`, `2.3-2.5MB`, `按 Android 版本定制的内核 ABI 适配（11/12）`],
      [`libkrloader32/64.so`, `150-234KB`, `内核 shim 装载器`],
      [`libadb.so`, `115KB`, `内置 ADB（含无线配对 AES-128-GCM）`],
      [`libun7z.so`, `76KB`, `7z 解包 JNI（ROM 组件安装）`],
      [`libEPIC.so`, `1.4MB`, `壳加载 + Epic hook + xHook/Dobby`],
      [`libpine/liblsplant/libaliuhook_*.so`, `57-984KB`, `四套 Java hook 引擎（宿主侧克隆空间用）`],
    ],
  },
};

const ch4 = {
  title: `第四章 ROM 分发格式逆向与加密破解`,
  paras: [
    `用户提供的 ROM 数据包 rom_default_12.1.0_1034.zip（537MB）外层是一个未加密的标准 ZIP 容器，含五个条目：manifest.json（362 字节清单）、rom.img（234MB）、rom1.img（278MB）、magisk.zip（24MB）与 superuser.zip（1.4MB）。manifest.json 经解码为：id 为 user_xxx_rom_default_12.1.0，display_name 为 Android 12.1.0，rom_version 1034，os_version 12，support_a32 false、support_a64 true，minimum_app_ver 3.2.66；rom_uri 为 rom.img?e=x&c=v2 与 rom1.img?e=x&c=v2 两个分片，magisk_uri 为 magisk.zip?v=27000&e=x，su_uri 为 superuser.zip，xposed_uri 与 play_uri 为空串。`,
    `这份清单直接揭示了客户端的组件化分发设计：ROM 主镜像与各功能组件（Magisk、Superuser、Xposed、Google Play）各自独立为 URI 资源，由客户端按需拉取与解密安装；xposed_uri 字段的存在说明该机制同样预留了 Xposed 框架组件的远程分发能力。反编译确认 RomConfig 类逐字段解析该清单，MagiskTask 则使用 ImageInstallerV1 将 magisk_uri 指向的组件包安装进 guest rootfs，并以 URI 查询参数 v=27000 判断 Magisk 版本。`,
    `e=x 与 c=v2 两个参数分别对应加密与压缩方案。对 rom.img 密文头的结构分析发现：镜像解密后应为 7z 容器（签名头 32 字节中，6 字节 magic 与 2 字节版本号是跨文件相同的已知明文，NextHeaderOffset 高位字节恒为零），据此可以逐字节推导密钥流。推导结果并经 StartHeaderCRC 与 NextHeaderCRC 双重 CRC32 验证（两个镜像四个校验值全部吻合），确认 e=x 是一个 16 字节 ASCII 密钥流的循环 XOR——密钥流为 %z89aviCM0KkbEs9（十六进制 25 7A 38 39 61 76 69 43 4D 30 4B 6B 62 45 73 39），对 rom.img、rom1.img 与 magisk.zip 三个组件通用；c=v2 即 7z 压缩（LZMA）。`,
    `按此密钥流全量解密后得到 rom.7z（未压缩 3.4GB，2907 条目）与 rom1.7z（未压缩 5.0GB，1339 条目）。rom.7z 内是一棵完整的 fs/ 目录树——即 guest 的 rootfs：含 init.rc（52KB）、init.zygote64_32.rc 等标准 AOSP 启动脚本与 system/ 分区内容；rom1.7z 则是 fs/product/ 分区（Calendar、Camera2、DeskClock、Gallery2、Music 等 AOSP 应用）。build.prop 确认其为纯净 AOSP Android 12（SDK 32，ro.product 为 generic/mainline），init.rc 中没有任何 Magisk 或 su 痕迹——Root 组件完全由客户端在安装或首次启动时按 manifest 配置动态注入，而非预置于镜像中。`,
    `安全性评价：以 16 字节固定 ASCII 密钥流做循环 XOR 的方案强度有限——任何已知明文（如 7z 签名头）都能直接恢复完整密钥流，本次破解即为一例。若 AEmulator 自建 ROM 分发体系，不建议照搬该加密强度；保留“清单 + 组件 URI”的架构价值，加密层改用 AES-GCM 并做签名校验即可。`,
  ],
  table: {
    caption: `表 4-1  ROM 数据包结构与解密结果`,
    header: [`条目`, `体积`, `清单 URI`, `解密结果`],
    rows: [
      [`manifest.json`, `362B`, `—`, `ROM 清单（版本 1034，Android 12.1）`],
      [`rom.img`, `233,815,955B`, `?e=x&c=v2`, `XOR 后为 7z，未压缩 3.4GB，fs/ 完整 rootfs（AOSP 12）`],
      [`rom1.img`, `278,213,975B`, `?e=x&c=v2`, `XOR 后为 7z，未压缩 5.0GB，fs/product/ 分区`],
      [`magisk.zip`, `23,933,726B`, `?v=27000&e=x`, `同一密钥流 XOR 后为普通 ZIP（Magisk v27.0 组件包）`],
      [`superuser.zip`, `1,366,160B`, `（无 e=x 标记）`, `内容亦非明文，密钥与内置插件版不同`],
    ],
  },
};

module.exports = { abstractText, ch1, ch2, ch3, ch4 };
