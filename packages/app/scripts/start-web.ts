import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startProductionWeb } from '../production-web.ts';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const portValue = process.env.ORIGAMIX_WEB_PORT ?? '9685';
const port = Number(portValue);
if (!/^\d+$/.test(portValue) || port < 1 || port > 65535)
  throw new Error('ORIGAMIX_WEB_PORT 必须为有效端口');
const origin = new URL(process.env.ORIGAMIX_WEB_ORIGIN ?? `http://127.0.0.1:${port}`);
const localHttp =
  origin.protocol === 'http:' &&
  ['localhost', '127.0.0.1'].includes(origin.hostname) &&
  Number(origin.port || '80') === port;
if (
  (!localHttp && origin.protocol !== 'https:') ||
  origin.username ||
  origin.password ||
  origin.pathname !== '/' ||
  origin.search ||
  origin.hash
)
  throw new Error('ORIGAMIX_WEB_ORIGIN 必须是 HTTPS 源地址，或匹配监听端口的本机 HTTP 地址');
const password = process.env.ORIGAMIX_WEB_PASSWORD;
if (!password || password.trim().length < 16 || password.length > 512)
  throw new Error('ORIGAMIX_WEB_PASSWORD 必须设置为 16 至 512 字符的访问密码');

const host = await startProductionWeb({
  origin,
  password,
  host: '127.0.0.1',
  port,
  stateDirectory: resolve(
    process.env.ORIGAMIX_WEB_STATE_DIR || resolve(appRoot, '../../.origamix-web/production'),
  ),
  rendererDirectory: resolve(appRoot, 'dist'),
  templateDirectory: resolve(appRoot, '../../dist/web-template'),
  projectPath: process.env.ORIGAMIX_WEB_PROJECT_DIR
    ? resolve(process.env.ORIGAMIX_WEB_PROJECT_DIR)
    : undefined,
  mysqlUrl: process.env.ORIGAMIX_WEB_MYSQL_URL?.trim() || undefined,
  modelKey: process.env.DEEPSEEK_API_KEY?.trim() || undefined,
});
console.info(`Origamix Web: ${origin.origin} (127.0.0.1:${host.port})`);

const shutdown = () => {
  void host.close().catch(() => {
    console.error('Origamix Web 关闭失败');
    process.exitCode = 1;
  });
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
