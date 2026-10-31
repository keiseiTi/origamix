import { createInterface } from 'node:readline';

import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const prefix = '[origamix-development-control]';

export const createDesktopControl = (child: ChildProcess) => {
  if (!child.stdout || !child.stdin) throw new Error('桌面开发控制管道不可用');
  const input = createInterface({ input: child.stdout });
  const pending = new Map<
    string,
    { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();
  let readyResolve: () => void;
  let readyReject: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const timer = setTimeout(() => readyReject(new Error('桌面开发控制通道启动超时')), 30000);
  const exited = () => {
    clearTimeout(timer);
    readyReject(new Error('桌面进程已退出'));
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error('桌面进程已退出'));
    }
    pending.clear();
    input.close();
  };
  const receive = (line: string) => {
    if (!line.startsWith(prefix) || line.length > 4096) return;
    let message: unknown;
    try {
      message = JSON.parse(line.slice(prefix.length));
    } catch {
      return;
    }
    if (!message || typeof message !== 'object') return;
    const value = message as Record<string, unknown>;
    if (value.kind === 'origamix:development:ready') {
      clearTimeout(timer);
      readyResolve();
    }
    if (value.kind !== 'origamix:development:reply' || typeof value.id !== 'string') return;
    const request = pending.get(value.id);
    if (!request) return;
    pending.delete(value.id);
    clearTimeout(request.timer);
    if (value.ok === true) request.resolve();
    else
      request.reject(new Error(typeof value.message === 'string' ? value.message : '后端更新失败'));
  };
  input.on('line', receive);
  child.once('exit', exited);
  child.once('error', exited);
  return {
    ready,
    request: async (action: 'pause-backend' | 'resume-backend' | 'reload-workbench') => {
      await ready;
      if (
        !child.stdin ||
        child.stdin.destroyed ||
        child.exitCode !== null ||
        child.signalCode !== null
      )
        throw new Error('桌面开发控制通道已关闭');
      const id = randomUUID();
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error('后端更新超时，更新已暂停'));
        }, 20000);
        pending.set(id, { resolve, reject, timer });
        child.stdin!.write(
          prefix + JSON.stringify({ kind: 'origamix:development', id, action }) + '\n',
          (error) => {
            if (!error) return;
            clearTimeout(timer);
            pending.delete(id);
            reject(error);
          },
        );
      });
    },
  };
};
