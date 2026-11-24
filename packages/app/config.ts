import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
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

const packageRoot = fileURLToPath(new URL('./', import.meta.url));

export const loadAppConfig = (mode: 'development' | 'production') => {
  const env: NodeJS.ProcessEnv = {
    ORIGAMIX_HOST: 'web',
    ORIGAMIX_RENDERER_HOST: '127.0.0.1',
    ORIGAMIX_RENDERER_PORT: '9685',
    ORIGAMIX_WEB_STATE_DIR: '../../.origamix-web',
    ...readEnvFile(resolve(packageRoot, '.env')),
    ...(mode === 'development' && process.env.ORIGAMIX_ENV_LOCAL !== '0'
      ? readEnvFile(resolve(packageRoot, '.env.local'))
      : {}),
    ...process.env,
  };
  const workbenchHost = env.ORIGAMIX_HOST;
  if (workbenchHost !== 'desktop' && workbenchHost !== 'web')
    throw new Error('ORIGAMIX_HOST 只接受 desktop 或 web');
  const port = env.ORIGAMIX_RENDERER_PORT ?? '';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
    throw new Error('ORIGAMIX_RENDERER_PORT 必须为有效端口');
  const host = env.ORIGAMIX_RENDERER_HOST;
  if (host !== 'localhost' && host !== '127.0.0.1') throw new Error('开发宿主必须监听本机地址');
  const stateDir = env.ORIGAMIX_WEB_STATE_DIR?.trim();
  if (!stateDir) throw new Error('缺少 ORIGAMIX_WEB_STATE_DIR');
  return {
    workbenchHost,
    host,
    port: Number(port),
    stateDir: resolve(packageRoot, stateDir),
    mysqlUrl: env.ORIGAMIX_WEB_MYSQL_URL?.trim(),
  };
};
