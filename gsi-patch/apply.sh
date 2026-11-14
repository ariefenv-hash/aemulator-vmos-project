#!/bin/bash
# AEmulator VMRoot GSI patcher - in-place system.img edit via debugfs
# Base: Android 15 GSI arm64 BP11.241210.004-12926906
set -uo pipefail

GSI=/tmp/gsi
P=$GSI/patch
export LD_LIBRARY_PATH=$GSI/e2f/usr/lib/x86_64-linux-gnu
DBG=$GSI/e2f/usr/sbin/debugfs
E2FSCK=$GSI/e2f/usr/sbin/e2fsck
IMG=$GSI/system.img

echo "== 0. stage patch files"
cp -f /home/z/my-project/scripts/gsi-patch/vmroot.rc \
      /home/z/my-project/scripts/gsi-patch/vmroot-setup.sh \
      /home/z/my-project/scripts/gsi-patch/su \
      /home/z/my-project/scripts/gsi-patch/README.txt "$P/"

{
  cat "$GSI/analysis/build.prop"
  cat <<'EOF'

####################################
# AEmulator VMRoot contract
####################################
ro.aemu.rom=1
ro.aemu.rom.name=aosp15-gsi-vmroot
ro.aemu.rom.version=15.1.0-vmroot.1
ro.aemu.rom.build=BP11.241210.004-12926906
ro.aemu.root.mode=magisk-system
ro.aemu.root.version=31.1
ro.aemu.xposed.api=100
ro.aemu.xposed.module=/system/etc/aemu/LSPosed-zygisk.zip
ro.aemu.xposed.autosetup=1
EOF
} > "$P/build.prop.patched"
echo "   build.prop.patched: $(wc -c < "$P/build.prop.patched") bytes"

# SELinux context value file (security.selinux xattr needs trailing NUL)
printf 'u:object_r:system_file:s0\x00' > "$P/ctx.bin"

echo "== 1. filesystem free space"
"$DBG" -R "show_super_stats -h" "$IMG" 2>/dev/null | grep -E "Free blocks|Free inodes"

echo "== 2. build debugfs command batch"
BIN_FILES="magisk magiskpolicy busybox magiskinit magiskboot"
{
  echo "mkdir /system/priv-app/Magisk"
  echo "mkdir /system/etc/aemu"
  for f in $BIN_FILES; do
    echo "write $P/$f /system/bin/$f"
  done
  echo "write $P/su /system/bin/su"
  echo "write $P/vmroot-setup.sh /system/bin/vmroot-setup.sh"
  echo "write $P/vmroot.rc /system/etc/init/vmroot.rc"
  echo "write $P/Magisk.apk /system/priv-app/Magisk/Magisk.apk"
  echo "write $P/LSPosed-zygisk.zip /system/etc/aemu/LSPosed-zygisk.zip"
  echo "write $P/README.txt /system/etc/aemu/README.txt"
  for f in $BIN_FILES; do
    echo "sif /system/bin/$f mode 0100755"
  done
  echo "sif /system/bin/su mode 0100755"
  echo "sif /system/bin/vmroot-setup.sh mode 0100755"
  echo "sif /system/etc/init/vmroot.rc mode 0100644"
  echo "sif /system/priv-app/Magisk/Magisk.apk mode 0100644"
  echo "sif /system/etc/aemu/LSPosed-zygisk.zip mode 0100644"
  echo "sif /system/etc/aemu/README.txt mode 0100644"
  for t in $BIN_FILES su vmroot-setup.sh; do
    echo "sif /system/bin/$t uid 0"
    echo "sif /system/bin/$t gid 0"
  done
  for t in vmroot.rc Magisk.apk LSPosed-zygisk.zip README.txt; do
    case "$t" in
      vmroot.rc) p=/system/etc/init/vmroot.rc ;;
      Magisk.apk) p=/system/priv-app/Magisk/Magisk.apk ;;
      *) p=/system/etc/aemu/$t ;;
    esac
    echo "sif $p uid 0"
    echo "sif $p gid 0"
  done
  echo "rm /system/build.prop"
  echo "write $P/build.prop.patched /system/build.prop"
  echo "sif /system/build.prop mode 0100644"
  echo "sif /system/build.prop uid 0"
  echo "sif /system/build.prop gid 0"
  # SELinux contexts on every touched inode
  for f in $BIN_FILES su vmroot-setup.sh; do
    echo "ea_set -f $P/ctx.bin /system/bin/$f security.selinux"
  done
  echo "ea_set -f $P/ctx.bin /system/etc/init/vmroot.rc security.selinux"
  echo "ea_set -f $P/ctx.bin /system/priv-app/Magisk/Magisk.apk security.selinux"
  echo "ea_set -f $P/ctx.bin /system/etc/aemu/LSPosed-zygisk.zip security.selinux"
  echo "ea_set -f $P/ctx.bin /system/etc/aemu/README.txt security.selinux"
  echo "ea_set -f $P/ctx.bin /system/build.prop security.selinux"
  echo "ea_set -f $P/ctx.bin /system/etc/aemu security.selinux"
  echo "ea_set -f $P/ctx.bin /system/priv-app/Magisk security.selinux"
} > "$P/cmds.txt"
wc -l "$P/cmds.txt"

echo "== 3. apply"
"$DBG" -w -f "$P/cmds.txt" "$IMG" 2>&1 | grep -v "^debugfs: " | head -40

echo "== 4. e2fsck consistency pass"
"$E2FSCK" -fy "$IMG" 2>&1 | tail -8

echo "== 5. verify"
"$DBG" -R "ls -l /system/bin" "$IMG" 2>/dev/null | grep -E "magisk|busybox|su$|vmroot" 
echo ---
"$DBG" -R "ls -l /system/etc/init/vmroot.rc /system/etc/aemu" "$IMG" 2>/dev/null | head -10
echo ---
"$DBG" -R "ls -l /system/priv-app/Magisk" "$IMG" 2>/dev/null | head -6
echo ---
"$DBG" -R "cat /system/build.prop" "$IMG" 2>/dev/null | tail -12
echo ---
"$DBG" -R "cat /system/etc/init/vmroot.rc" "$IMG" 2>/dev/null | head -6
echo ---
"$DBG" -R "ea_list /system/bin/magisk" "$IMG" 2>/dev/null | head -6
