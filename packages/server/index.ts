import { startServer } from './runtime';

const controlPort = (process as typeof process & {
  parentPort?: { on: (event: 'message', listener: (event: { data: unknown }) => void) => void; postMessage: (message: unknown) => void };
}).parentPort;
if (!controlPort) throw new Error('请使用 Server dev 命令或由 Electron Utility Process 启动');

let backend: Awaited<ReturnType<typeof startServer>> | undefined;
let starting = false;
let shuttingDown = false;
controlPort.on('message', async ({ data }) => {
  if (!data || typeof data !== 'object') return;
  const input = data as Record<string, unknown>;
  if (input.kind === 'shutdown') {
    shuttingDown = true;
    await backend?.close();
    process.exit(0);
  }
  if (input.kind === 'grant' && typeof input.grantId === 'string' && typeof input.path === 'string') {
    backend?.registerGrant(input.grantId, input.path);
    return;
  }
  if (input.kind !== 'initialize' || starting || backend || shuttingDown) return;
  if (typeof input.databasePath !== 'string' || typeof input.templatePath !== 'string' ||
      typeof input.desktopToken !== 'string' || typeof input.serviceInstanceId !== 'string') {
    controlPort.postMessage({ kind: 'error', message: '后台启动参数不完整' });
    return;
  }
  starting = true;
  try {
    backend = await startServer({ databasePath: input.databasePath, templatePath: input.templatePath,
      desktopToken: input.desktopToken, serviceInstanceId: input.serviceInstanceId });
    controlPort.postMessage({ kind: 'ready', port: backend.port, serviceInstanceId: input.serviceInstanceId });
  } catch (error) {
    controlPort.postMessage({ kind: 'error', message: error instanceof Error ? error.message : '后台启动失败' });
  } finally { starting = false; }
});
