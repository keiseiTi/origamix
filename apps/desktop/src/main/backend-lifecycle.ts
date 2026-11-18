import { utilityProcess, type UtilityProcess } from 'electron';
import { nanoid } from 'nanoid';
import type { BackendConnection, BackendStatus } from '@origamix/shared';
import type { resolveDesktopConfig } from './config';

export const createBackendLifecycle = (options: {
  config: Pick<
    ReturnType<typeof resolveDesktopConfig>,
    'backendPath' | 'serverPort' | 'databasePath' | 'templatePath'
  >;
  workbenchOrigin: string;
  notifyStatus: (status: BackendStatus) => void;
  readModelApiKey: (provider: string | undefined) => Promise<string | undefined>;
  readModelReference: () => Promise<string>;
}) => {
  let backendProcess: UtilityProcess | undefined;
  let backendConnection: BackendConnection | undefined;
  let backendStartPromise: Promise<BackendConnection> | undefined;
  let quitting = false;
  let backendPaused = false;
  let resumeWaiter:
    { promise: Promise<void>; resolve: () => void; reject: (error: unknown) => void } | undefined;
  const spawnBackend = async (): Promise<BackendConnection> => {
    const serviceInstanceId = nanoid();
    const token = nanoid(48);
    const backend = utilityProcess.fork(options.config.backendPath, [], { stdio: 'pipe' });

    backendProcess = backend;
    return new Promise<BackendConnection>((resolve, reject) => {
      let settled = false;
      let ready = false;
      const fail = (error: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
        if (backendProcess === backend) backend.kill();
      };
      const timeout = setTimeout(() => fail(new Error('本地服务启动超时')), 10_000);
      backend.on(
        'message',
        (message: {
          kind?: string;
          port?: number;
          message?: string;
          requestId?: string;
          provider?: string;
          modelRef?: string;
        }) => {
          if (message.kind === 'credential-request' && message.requestId) {
            void options.readModelApiKey(message.provider).then((credential) => {
              if (backendProcess !== backend) return;
              backend.postMessage({
                kind: 'credential-response',
                requestId: message.requestId,
                ...(credential ? { credential } : {}),
              });
            });
            return;
          }
          if (message.kind === 'model-reference-request' && message.requestId) {
            void options.readModelReference().then((modelRef) => {
              if (backendProcess !== backend) return;
              backend.postMessage({
                kind: 'model-reference-response',
                requestId: message.requestId,
                modelRef,
              });
            });
            return;
          }
          if (message.kind === 'error') {
            fail(new Error(message.message ?? '本地服务启动失败'));
            return;
          }
          if (message.kind !== 'ready' || !message.port || backendProcess !== backend || quitting)
            return;
          if (settled) return;
          settled = true;
          ready = true;
          clearTimeout(timeout);
          backendConnection = {
            baseUrl: `http://127.0.0.1:${message.port}/api/v1`,
            token,
            serviceInstanceId,
          };
          options.notifyStatus('ready');
          console.info('[Origamix Server] 已就绪');
          resolve(backendConnection);
        },
      );
      backend.once('exit', (code) => {
        if (backendProcess === backend) backendProcess = undefined;
        if (backendConnection?.serviceInstanceId === serviceInstanceId)
          backendConnection = undefined;
        fail(new Error(`本地服务异常退出（退出码 ${code}）`));
        if (ready && !quitting && !backendPaused) {
          options.notifyStatus('restarting');
          void ensureBackend().catch((error: unknown) => {
            options.notifyStatus('unavailable');
            console.error(
              '[Origamix Server] 自动恢复失败：',
              error instanceof Error ? error.message : error,
            );
          });
        }
      });
      backend.stdout?.on('data', (data) => {
        process.stdout.write(`[Server Log]: ${data.toString()}`);
      });
      backend.stderr?.on('data', (chunk: Buffer) => {
        console.error(`[Origamix Server] ${chunk.toString().trim()}`);
      });
      backend.once('spawn', () => {
        backend.postMessage({
          kind: 'initialize',
          port: options.config.serverPort,
          workbenchOrigin: options.workbenchOrigin,
          databasePath: options.config.databasePath,
          templatePath: options.config.templatePath,
          desktopToken: token,
          serviceInstanceId,
        });
      });
    });
  };

  /**
   * Serializes Utility Process startup. After an unexpected exit callers wait for
   * a fresh connection (and therefore a fresh service instance/token) instead of
   * receiving credentials for the dead process.
   */
  const ensureBackend = (): Promise<BackendConnection> => {
    if (quitting) return Promise.reject(new Error('应用正在退出'));
    if (backendPaused)
      return resumeWaiter
        ? resumeWaiter.promise.then(() => ensureBackend())
        : Promise.reject(new Error('后端更新未完成，请修复后重试'));
    if (backendConnection) return Promise.resolve(backendConnection);
    backendStartPromise ??= spawnBackend().finally(() => {
      backendStartPromise = undefined;
    });
    return backendStartPromise;
  };

  const pauseBackend = async (): Promise<void> => {
    await backendStartPromise?.catch(() => undefined);
    if (quitting) throw new Error('应用正在退出');
    backendPaused = true;
    resumeWaiter ??= (() => {
      let resolve!: () => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<void>((done, fail) => {
        resolve = done;
        reject = fail;
      });
      void promise.catch(() => undefined);
      return { promise, resolve, reject };
    })();
    backendConnection = undefined;
    options.notifyStatus('restarting');
    const backend = backendProcess;
    if (!backend) return;
    await new Promise<void>((resolve, reject) => {
      const exited = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        backend.off('exit', exited);
        reject(new Error('后端退出超时，未替换运行资源，请稍后重试'));
      }, 15000);
      backend.once('exit', exited);
      backend.postMessage({ kind: 'shutdown' });
    }).catch((error: unknown) => {
      resumeWaiter?.reject(error);
      resumeWaiter = undefined;
      options.notifyStatus('unavailable');
      throw error;
    });
  };
  const resumeBackend = async (): Promise<void> => {
    if (quitting) throw new Error('应用正在退出');
    backendPaused = false;
    try {
      await ensureBackend();
      resumeWaiter?.resolve();
      resumeWaiter = undefined;
    } catch (error) {
      backendPaused = true;
      resumeWaiter?.reject(error);
      resumeWaiter = undefined;
      options.notifyStatus('unavailable');
      throw error;
    }
  };

  const grantDirectory = (path: string): { directoryGrantId: string; displayPath: string } => {
    if (quitting || !backendConnection || !backendProcess) throw new Error('本地服务尚未就绪');
    const directoryGrantId = `grant_${nanoid()}`;
    backendProcess.postMessage({ kind: 'grant', grantId: directoryGrantId, path });
    return { directoryGrantId, displayPath: path };
  };

  let shutdownPromise: Promise<void> | undefined;
  const shutdown = (): Promise<void> => {
    if (shutdownPromise) return shutdownPromise;
    quitting = true;
    resumeWaiter?.reject(new Error('应用正在退出'));
    resumeWaiter = undefined;
    backendConnection = undefined;
    const backend = backendProcess;
    shutdownPromise = backend
      ? new Promise<void>((resolve) => {
          const timeout = setTimeout(() => backend.kill(), 3000);
          backend.once('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
          backend.postMessage({ kind: 'shutdown' });
        })
      : Promise.resolve();
    return shutdownPromise;
  };

  return { ensureBackend, pauseBackend, resumeBackend, grantDirectory, shutdown };
};
