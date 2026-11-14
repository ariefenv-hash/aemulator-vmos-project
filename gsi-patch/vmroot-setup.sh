#!/system/bin/sh
# AEmulator VMRoot bootstrap (system-mode Magisk v31.1)
# stage1: populate /data/adb/magisk (MAGISKBIN) from the system image
# stage2: one-shot auto-install of the seeded LSPosed zygisk module

MAGISKBIN=/data/adb/magisk

stage1() {
    [ -d "$MAGISKBIN" ] || mkdir -p "$MAGISKBIN"
    for f in magisk magiskpolicy busybox magiskinit magiskboot; do
        cp -f "/system/bin/$f" "$MAGISKBIN/$f" 2>/dev/null
        chmod 755 "$MAGISKBIN/$f" 2>/dev/null
    done
    chmod 755 "$MAGISKBIN" 2>/dev/null
    mkdir -p /data/adb/modules /data/adb/post-fs-data.d /data/adb/service.d 2>/dev/null
}

stage2() {
    if [ "$(getprop ro.aemu.xposed.autosetup)" != "0" ]; then
        if [ ! -d /data/adb/modules/zygisk_lsposed ] && [ -f /system/etc/aemu/LSPosed-zygisk.zip ]; then
            /system/bin/magisk --install-module /system/etc/aemu/LSPosed-zygisk.zip >/dev/null 2>&1
        fi
    fi
}

case "$1" in
    stage1) stage1 ;;
    stage2) stage2 ;;
    *) stage1 ;;
esac
