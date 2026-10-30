import { loadServerConfig } from './config.ts';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { startServer } from '@origamix/server/runtime';

const config = loadServerConfig();
await mkdir(config.stateDir, { recursive: true });
const serviceInstanceId = config.serviceInstanceId ?? randomUUID();
const server = await startServer({
  port: config.serverPort,
  databasePath: resolve(config.stateDir, 'origamix.db'),
  templatePath: config.templatePath,
  desktopToken: config.token,
  serviceInstanceId,
  projectPath: config.projectPath,
  getModelCredential: async (provider) =>
    provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY?.trim() : undefined,
});
console.info(
  `Local API: http://127.0.0.1:${server.port}/api/v1; service instance: ${serviceInstanceId}`,
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await server.close();
    process.exit(0);
  });
