AEmulator VMRoot ROM - Android 15 GSI arm64 (system-mode Magisk)
=================================================================

Base image   : aosp_arm64-exp-BP11.241210.004-12926906 (Android 15 QPR2, API 35)
Integrations : Magisk v31.1 (system-mode daemon) + LSPosed v1.9.3_mod (zygisk, seeded)
Build tag    : 15.1.0-vmroot.1

Contract for the AEmulator engine / app:
  1. Boot args  : must include androidboot.selinux=permissive (SELinux
                  permissive) so magiskd and `su` clients are fully functional.
  2. Root daemon: /system/etc/init/vmroot.rc starts `magiskd`
                  (/system/bin/magisk --daemon) at class late_start.
                  Runtime tmp: tmpfs mounted on /debug_ramdisk (marker dir
                  /debug_ramdisk/.magisk, created by this init file).
                  Binary store: /data/adb/magisk (populated by
                  /system/bin/vmroot-setup.sh stage1 at post-fs-data).
  3. su         : /system/bin/su -> `magisk su` client. Policy decisions are
                  handled by the Magisk manager app (preinstalled at
                  /system/priv-app/Magisk). To auto-grant all apps (VMOS-like
                  global root), set Magisk manager auto-response = Allow.
  4. ROM props  : ro.aemu.rom=1, ro.aemu.rom.name=aosp15-gsi-vmroot,
                  ro.aemu.rom.version=15.1.0-vmroot.1,
                  ro.aemu.root.mode=magisk-system, ro.aemu.xposed.api=100.
                  The engine may detect this ROM via `getprop ro.aemu.rom`.
  5. Xposed     : /system/etc/aemu/LSPosed-zygisk.zip is seeded. It is
                  auto-installed into Magisk on first boot unless
                  `setprop ro.aemu.xposed.autosetup 0`. Zygisk must be enabled
                  in Magisk manager (magisk.db settings) for LSPosed to load.
                  The AEmulator app-side hook path targets Xposed API 100
                  (XposedBridge VERSION=100).
  6. Emulator   : Magisk daemon auto-detects emulator environments via
                  ro.kernel.qemu / ro.boot.qemu; the engine should keep these
                  set to 1.

Patch manifest (all files injected into system.img in place via debugfs):
  /system/bin/magisk           <- Magisk v31.1 libmagisk.so      (0755)
  /system/bin/magiskpolicy     <- libmagiskpolicy.so             (0755)
  /system/bin/busybox          <- libbusybox.so                  (0755)
  /system/bin/magiskinit       <- libmagiskinit.so               (0755)
  /system/bin/magiskboot       <- libmagiskboot.so               (0755)
  /system/bin/su               -> magisk su client wrapper       (0755)
  /system/bin/vmroot-setup.sh  -> bootstrap                      (0755)
  /system/etc/init/vmroot.rc   -> init service definition        (0644)
  /system/priv-app/Magisk/Magisk.apk  <- manager app             (0644)
  /system/etc/aemu/LSPosed-zygisk.zip <- seeded module           (0644)
  /system/etc/aemu/README.txt  <- this file                      (0644)
  /system/build.prop           <- + AEmulator contract props     (0644)
