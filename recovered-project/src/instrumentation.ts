/**
 * instrumentation.ts — Next.js 服务器启动钩子
 * 平台每次自动拉起 dev server 时，都会先执行这里的 register()，
 * 从而把「指令自动捕捉器」常驻到服务器进程里。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startProcessWatcher } = await import('./lib/process-watcher');
    startProcessWatcher();
  }
}
