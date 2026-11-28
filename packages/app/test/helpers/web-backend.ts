import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { startMysqlWebServer } from '@origamix/server/web-runtime';

export const startWebTestBackend = async (mysqlUrl: string) => {
  const directory = new URL('../../../../dist/web-template/', import.meta.url);
  const { version, sha256, file } = JSON.parse(
    await readFile(new URL('manifest.json', directory), 'utf8'),
  );
  const token = randomUUID();
  const serviceInstanceId = randomUUID();
  const backend = await startMysqlWebServer({
    mysqlUrl,
    desktopToken: token,
    serviceInstanceId,
    templateDownload: { version, sha256, body: await readFile(new URL(file, directory)) },
  });
  return {
    upstream: { port: backend.port, token, serviceInstanceId },
    close: backend.close,
  };
};
