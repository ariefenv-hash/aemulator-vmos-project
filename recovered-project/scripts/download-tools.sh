#!/bin/bash
# 后台断点续传下载 jadx 与 apktool
cd /home/z/my-project/tools || exit 1
URL_JADX="https://github.com/skylot/jadx/releases/download/v1.5.6/jadx-1.5.6.zip"
URL_APKTOOL="https://github.com/iBotPeaches/Apktool/releases/download/v3.0.3/apktool_3.0.3.jar"

for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sL -C - --connect-timeout 20 -o jadx.zip "$URL_JADX"; then
    echo "jadx.zip done (attempt $i)"
    break
  fi
  echo "jadx retry $i"
  sleep 2
done

for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sL -C - --connect-timeout 20 -o apktool.jar "$URL_APKTOOL"; then
    echo "apktool.jar done (attempt $i)"
    break
  fi
  echo "apktool retry $i"
  sleep 2
done

echo "ALL_DOWNLOADS_FINISHED"
