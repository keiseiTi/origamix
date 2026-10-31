import { createInterface } from 'node:readline';

const prefix = '[origamix-development-control]';

/** Private parent-process channel; never exposed through the Renderer bridge. */
export const registerDevelopmentControl = (actions: {
  pauseBackend: () => Promise<void>;
  resumeBackend: () => Promise<void>;
  reloadWorkbench: () => Promise<void>;
  disconnect: () => void;
}): (() => void) => {
  let queue = Promise.resolve();
  const input = createInterface({ input: process.stdin });
  const send = (message: object) => process.stdout.write(prefix + JSON.stringify(message) + '\n');
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
    if (
      value.kind !== 'origamix:development' ||
      typeof value.id !== 'string' ||
      value.id.length > 100 ||
      !['pause-backend', 'resume-backend', 'reload-workbench'].includes(String(value.action))
    )
      return;
    queue = queue.then(async () => {
      try {
        if (value.action === 'pause-backend') await actions.pauseBackend();
        else if (value.action === 'resume-backend') await actions.resumeBackend();
        else await actions.reloadWorkbench();
        send({ kind: 'origamix:development:reply', id: value.id, ok: true });
      } catch (error) {
        send({
          kind: 'origamix:development:reply',
          id: value.id,
          ok: false,
          message: error instanceof Error ? error.message : '后端更新失败',
        });
      }
    });
  };
  input.on('line', receive);
  input.once('close', actions.disconnect);
  send({ kind: 'origamix:development:ready' });
  return () => {
    input.off('line', receive);
    input.off('close', actions.disconnect);
    input.close();
  };
};
