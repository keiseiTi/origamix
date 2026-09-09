import { startServer } from './runtime';
import { nanoid } from 'nanoid';

const controlPort = (
  process as typeof process & {
    parentPort?: {
      on: (event: 'message', listener: (event: { data: unknown }) => void) => void;
      postMessage: (message: unknown) => void;
    };
  }
).parentPort;
if (!controlPort) throw new Error('请使用 Server dev 命令或由 Electron Utility Process 启动');

let backend: Awaited<ReturnType<typeof startServer>> | undefined;
let starting = false;
let shuttingDown = false;
const credentialRequests = new Map<
  string,
  { resolve: (credential: string | undefined) => void; timeout: NodeJS.Timeout }
>();

function requestCredential(provider: 'deepseek'): Promise<string | undefined> {
  const requestId = `credential_${nanoid()}`;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      credentialRequests.delete(requestId);
      resolve(undefined);
    }, 10_000);
    credentialRequests.set(requestId, { resolve, timeout });
    controlPort!.postMessage({ kind: 'credential-request', requestId, provider });
  });
}

controlPort.on('message', async ({ data }) => {
  if (!data || typeof data !== 'object') return;
  const input = data as Record<string, unknown>;
  if (input.kind === 'credential-response' && typeof input.requestId === 'string') {
    const pending = credentialRequests.get(input.requestId);
    if (!pending) return;
    credentialRequests.delete(input.requestId);
    clearTimeout(pending.timeout);
    pending.resolve(typeof input.credential === 'string' ? input.credential : undefined);
    return;
  }
  if (input.kind === 'shutdown') {
    shuttingDown = true;
    await backend?.close();
    process.exit(0);
  }
  if (
    input.kind === 'grant' &&
    typeof input.grantId === 'string' &&
    typeof input.path === 'string'
  ) {
    backend?.registerGrant(input.grantId, input.path);
    return;
  }
  if (input.kind !== 'initialize' || starting || backend || shuttingDown) return;
  if (
    typeof input.databasePath !== 'string' ||
    typeof input.templatePath !== 'string' ||
    typeof input.desktopToken !== 'string' ||
    typeof input.serviceInstanceId !== 'string'
  ) {
    controlPort.postMessage({ kind: 'error', message: '后台启动参数不完整' });
    return;
  }
  starting = true;
  try {
    backend = await startServer({
      databasePath: input.databasePath,
      templatePath: input.templatePath,
      desktopToken: input.desktopToken,
      serviceInstanceId: input.serviceInstanceId,
      getModelCredential: requestCredential,
    });
    controlPort.postMessage({
      kind: 'ready',
      port: backend.port,
      serviceInstanceId: input.serviceInstanceId,
    });
  } catch (error) {
    controlPort.postMessage({
      kind: 'error',
      message: error instanceof Error ? error.message : '后台启动失败',
    });
  } finally {
    starting = false;
  }
});
