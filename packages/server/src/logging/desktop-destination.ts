import { constants } from 'node:fs';
import { mkdir, open, rename, rm, lstat } from 'node:fs/promises';
import { join } from 'node:path';

const maxFileBytes = 10 * 1024 * 1024;
const maxPendingBytes = 256 * 1024;
const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
const archiveCount = 4;

const inspect = async (path: string) => {
  try {
    return await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return undefined;
  }
};

export const createDesktopLogDestination = (directory: string, serviceInstanceId: string) => {
  const file = join(directory, 'server.jsonl');
  let pending: string[] = [];
  let pendingBytes = 0;
  let writing: Promise<void> | undefined;
  let dropped = 0;
  let accepting = true;
  let nextCleanup = 0;

  const removeExpired = async () => {
    const now = Date.now();
    for (const path of [
      file,
      ...Array.from({ length: archiveCount }, (_, i) => `${file}.${i + 1}`),
    ]) {
      const entry = await inspect(path);
      if (entry && now - entry.mtimeMs >= maxAgeMs) await rm(path, { force: true });
    }
  };

  const append = async (batch: string, bytes: number) => {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if (Date.now() >= nextCleanup) {
      await removeExpired();
      nextCleanup = Date.now() + 60 * 60 * 1000;
    }
    const current = await inspect(file);
    if (current && current.size + bytes > maxFileBytes) {
      await rm(`${file}.${archiveCount}`, { force: true });
      for (let index = archiveCount - 1; index >= 0; index -= 1) {
        const from = index === 0 ? file : `${file}.${index}`;
        if (await inspect(from)) await rename(from, `${file}.${index + 1}`);
      }
    }
    const handle = await open(
      file,
      constants.O_WRONLY |
        constants.O_APPEND |
        constants.O_CREAT |
        constants.O_NOFOLLOW |
        constants.O_NONBLOCK,
      0o600,
    );
    try {
      if (!(await handle.stat()).isFile()) throw new Error('Invalid log destination');
      await handle.writeFile(batch);
    } finally {
      await handle.close();
    }
  };

  const drain = async () => {
    while (pending.length) {
      const batch = pending;
      const bytes = pendingBytes;
      pending = [];
      pendingBytes = 0;
      const lost = dropped;
      const notice = lost
        ? JSON.stringify({
            event: 'logging.records.dropped',
            time: new Date().toISOString(),
            level: 40,
            host: 'desktop',
            serviceInstanceId,
            count: lost,
          }) + '\n'
        : '';
      try {
        await append(notice + batch.join(''), bytes + Buffer.byteLength(notice));
        dropped -= lost;
      } catch {
        dropped += batch.length;
        // Keep stderr useful when the file cannot be written, without logging the path or raw error.
        if (lost === 0 && !process.stderr.writableNeedDrain)
          process.stderr.write('Origamix: 无法写入 Server 诊断日志\n', () => undefined);
      }
    }
    writing = undefined;
  };

  return {
    write(line: string) {
      if (!accepting) return;
      const bytes = Buffer.byteLength(line);
      if (pendingBytes + bytes > maxPendingBytes) {
        dropped += 1;
        return;
      }
      pending.push(line);
      pendingBytes += bytes;
      writing ??= drain();
    },
    async close() {
      accepting = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          writing,
          new Promise<void>((resolve) => {
            timer = setTimeout(resolve, 500);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
};
