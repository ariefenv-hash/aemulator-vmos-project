#!/bin/bash
# Full APK build of the patched AEmulator (standard flavor, release), signed with a generated key.
export ANDROID_HOME=/home/z/my-project/tools/android-sdk
export JAVA_HOME=/home/z/my-project/tools/jdk-21.0.5+11
export PATH="$JAVA_HOME/bin:$PATH"
cd /home/z/my-project/aemulator-src || exit 1

# keystore: the upstream ships none; generate a local one so the APK installs (replace with your own later)
KS=/home/z/my-project/scripts/aemu-release.jks
if [ ! -f "$KS" ]; then
  "$JAVA_HOME/bin/keytool" -genkeypair -v -keystore "$KS" -alias aemu -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass aemu-root-modules -keypass aemu-root-modules \
    -dname "CN=AEmulator Upgrade, OU=Upgrade, O=AEmulator, L=CN, S=CN, C=CN" || exit 1
  cat > /home/z/my-project/aemulator-src/keystore.properties <<EOF
storeFile=$KS
storePassword=aemu-root-modules
keyAlias=aemu
keyPassword=aemu-root-modules
EOF
fi

/home/z/my-project/tools/gradle-8.14.2/bin/gradle \
  :app:assembleStandardRelease :app:assembleV0003Release \
  --no-daemon \
  -Dorg.gradle.jvmargs="-Xmx900m -XX:MaxMetaspaceSize=256m -XX:MaxDirectMemorySize=320m -XX:TieredStopAtLevel=1 -XX:MaxHeapFreeRatio=40 -XX:MinHeapFreeRatio=10 -Dfile.encoding=UTF-8" \
  -Dorg.gradle.java.home="$JAVA_HOME" \
  -Pkotlin.compiler.execution.strategy=in-process \
  -Dorg.gradle.workers.max=1 \
  --console=plain
echo "BUILD_EXIT=$?"
