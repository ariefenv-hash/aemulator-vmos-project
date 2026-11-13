# 03 - 导入 bug 修复方案（改走 ADB + pm install）

## 1. 症状（第 6 轮确认）

- AEmulator 自带的应用导入功能**基本必报"导入失败"**。
- 同一 APK 通过 **ADB shell 手动导入可成功**，且 ADB 内可用 `pm install` 自动安装并通过。

## 2. 结论

- 导入失败不在目标系统侧（pm install 通路完好），而在 AEmulator 宿主的导入实现（推力路径/权限/临时目录/回调判定之一）。
- **修复方向（用户已认可）：宿主导入逻辑改走 ADB 通道**——把"内置导入"退化为"把 APK 放入约定位置 + 触发 ADB shell `pm install -r <path>`"，用 pm 的返回码做成功判定。

## 3. 实施要点（接手即做）

1. 定位宿主导入代码路径（AEmulator 源码内 import/install 相关 Service/Activity；参考 commit `3b97ed5`）。
2. 新增 ADB 安装执行器：
   - 源 APK 先落到宿主与容器共享可见的路径（或经 libadb.so 通道 push）；
   - 容器内执行 `pm install -r /data/local/tmp/import.apk`；
   - 解析返回码：`Success` = 成功；`INSTALL_FAILED_*` 原样透出给 UI。
3. UI 层保留原"导入失败"文案位，但展示 pm 的具体失败原因（不再笼统报失败）。
4. 回归验证清单：普通 APK / split APK（先 adb push 再 session install）/ 覆盖安装 / 卸载后重装 / 大文件（>1GB 游戏包）。
5. 注意 `pm install` 需要 shell 或 root 身份——ROM 内 root 方案（docs/02）就绪后此通路更稳。

## 4. 关联

- 该修复属于 docs/02 升级路线的一部分；与 docs/04（ROM 网络）无直接耦合，但冒烟清单应合并执行。
