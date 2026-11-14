#!/bin/bash
cd /home/z/my-project/tools || exit 1
# ghfast 镜像 + 官方源双重保障
JADX_URLS=("https://ghfast.top/https://github.com/skylot/jadx/releases/download/v1.5.6/jadx-1.5.6.zip" "https://github.com/skylot/jadx/releases/download/v1.5.6/jadx-1.5.6.zip")
APKTOOL_URLS=("https://ghfast.top/https://github.com/iBotPeaches/Apktool/releases/download/v3.0.3/apktool_3.0.3.jar" "https://github.com/iBotPeaches/Apktool/releases/download/v3.0.3/apktool_3.0.3.jar")
for u in "${JADX_URLS[@]}"; do curl -sL -C - --connect-timeout 15 -o jadx.zip "$u" && [ $(stat -c%s jadx.zip 2>/dev/null || echo 0) -gt 30000000 ] && echo "JADX_OK" && break; done
for u in "${APKTOOL_URLS[@]}"; do curl -sL -C - --connect-timeout 15 -o apktool.jar "$u" && [ $(stat -c%s apktool.jar 2>/dev/null || echo 0) -gt 15000000 ] && echo "APKTOOL_OK" && break; done
echo "DONE"
