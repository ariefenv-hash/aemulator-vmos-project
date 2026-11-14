#!/bin/bash
# Compile-only validation of the patched AEmulator sources (no APK packaging).
export ANDROID_HOME=/home/z/my-project/tools/android-sdk
export JAVA_HOME=/home/z/my-project/tools/jdk-21.0.5+11
export PATH="$JAVA_HOME/bin:$PATH"
cd /home/z/my-project/aemulator-src || exit 1
/home/z/my-project/tools/gradle-8.14.2/bin/gradle \
  :app:compileStandardReleaseKotlin \
  --no-daemon \
  -x packEngines \
  -Dorg.gradle.jvmargs="-Xmx950m -XX:MaxMetaspaceSize=256m -XX:MaxDirectMemorySize=64m -XX:TieredStopAtLevel=1 -XX:MaxHeapFreeRatio=40 -XX:MinHeapFreeRatio=10 -Dfile.encoding=UTF-8" \
  -Dorg.gradle.java.home="$JAVA_HOME" \
  -Pkotlin.compiler.execution.strategy=in-process \
  -Dorg.gradle.workers.max=1 \
  --console=plain
echo "BUILD_EXIT=$?"
