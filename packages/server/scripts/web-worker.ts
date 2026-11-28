import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startMysqlWebServer } from '@origamix/server/web-runtime';
import { loadWebServerConfig } from './config.ts';
import { prepareWebTemplate } from './template-download.ts';
import { loadWebTemplate } from './web-template-assets.ts';

const development = process.argv.includes('--development');
const { mysqlUrl, token, port, serviceInstanceId, modelKey, templateDirectory } =
  loadWebServerConfig(development);
const prepareDevelopmentTemplate = async () => {
  const staging = await mkdtemp(join(tmpdir(), 'origamix-web-template-'));
  try {
    return await prepareWebTemplate(join(staging, 'template'));
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
};
const templateDownload = development
  ? await prepareDevelopmentTemplate()
  : await loadWebTemplate(templateDirectory);

const server = await startMysqlWebServer({
  port,
  mysqlUrl,
  desktopToken: token,
  serviceInstanceId,
  templateDownload,
  modelConfigured: Boolean(modelKey),
  getModelCredential: async () => modelKey,
});
console.info(`Web API: http://127.0.0.1:${server.port}/api/v1`);
const shutdown = () => {
  void server.close().catch(() => {
    console.error('Web Server 关闭失败');
    process.exitCode = 1;
  });
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

if (process.connected) process.send?.({ type: 'web-ready', port: server.port });
