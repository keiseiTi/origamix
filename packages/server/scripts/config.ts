import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const readEnvFile = (path: string): Record<string, string | undefined> => {
  try {
    return parseEnv(readFileSync(path, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
};

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
export const loadServerConfig = () => {
  const env: NodeJS.ProcessEnv = {
    ORIGAMIX_SERVER_PORT: '1029',
    ORIGAMIX_LOCAL_STATE_DIR: '../../.origamix-local',
    ...readEnvFile(resolve(packageRoot, '.env')),
    ...(process.env.ORIGAMIX_ENV_LOCAL === '0'
      ? {}
      : readEnvFile(resolve(packageRoot, '.env.local'))),
    ...process.env,
  };
  const directory = (key: string) => {
    const value = env[key]?.trim();
    if (!value) throw new Error(`缺少 Server 配置：${key}`);
    return resolve(packageRoot, value);
  };
  const token = process.env.ORIGAMIX_SERVER_TOKEN?.trim();
  if (!token) throw new Error('请通过 ORIGAMIX_SERVER_TOKEN 注入本地服务访问令牌');
  const stateDir = directory('ORIGAMIX_LOCAL_STATE_DIR');
  const serverPort = env.ORIGAMIX_SERVER_PORT ?? '';
  if (!/^\d+$/.test(serverPort) || Number(serverPort) > 65535)
    throw new Error('ORIGAMIX_SERVER_PORT 必须为 0 到 65535 的整数');
  return {
    serverPort: Number(serverPort),
    stateDir,
    templatePath: env.ORIGAMIX_TEMPLATE_DIR?.trim()
      ? resolve(packageRoot, env.ORIGAMIX_TEMPLATE_DIR.trim())
      : resolve(stateDir, 'template'),
    projectPath: env.ORIGAMIX_LOCAL_PROJECT_DIR?.trim()
      ? resolve(packageRoot, env.ORIGAMIX_LOCAL_PROJECT_DIR.trim())
      : undefined,
    token,
    serviceInstanceId: process.env.ORIGAMIX_SERVICE_ID?.trim(),
  };
};
