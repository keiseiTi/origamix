import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { startServer } from '../dist/runtime.cjs';

const token = process.env.ORIGAMIX_SERVER_TOKEN;
if (!token) throw new Error('请通过 ORIGAMIX_SERVER_TOKEN 提供本地服务访问令牌');
const stateDir = resolve(process.env.ORIGAMIX_WEB_STATE_DIR ?? fileURLToPath(new URL('../../../.origamix-web', import.meta.url)));
await mkdir(stateDir, { recursive: true });
const serviceInstanceId = process.env.ORIGAMIX_SERVICE_ID ?? randomUUID();
const server = await startServer({ databasePath: resolve(stateDir, 'origamix.db'),
  templatePath: fileURLToPath(new URL('../../template', import.meta.url)),
  desktopToken: token, serviceInstanceId, projectPath: process.env.ORIGAMIX_WEB_PROJECT_DIR });
console.info(`Local API: http://127.0.0.1:${server.port}/api/v1; service instance: ${serviceInstanceId}`);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(0); });
