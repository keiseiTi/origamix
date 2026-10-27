import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';

const readEnvironment = (path: string, optional = false): Record<string, string | undefined> => {
  try {
    return parseEnv(readFileSync(path, 'utf8'));
  } catch (error) {
    if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
};

const packageRoot = fileURLToPath(new URL('./', import.meta.url));

export const loadAppConfig = () => {
  const env = {
    ...readEnvironment(resolve(packageRoot, '.env')),
    ...(process.env.ORIGAMIX_ENV_LOCAL === '0'
      ? {}
      : readEnvironment(resolve(packageRoot, '.env.local'), true)),
    ...process.env,
  };
  const desktop = env.ORIGAMIX_DESKTOP;
  if (desktop !== '0' && desktop !== '1') throw new Error('ORIGAMIX_DESKTOP 只接受 0 或 1');
  const port = env.ORIGAMIX_RENDERER_PORT ?? '';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
    throw new Error('ORIGAMIX_RENDERER_PORT 必须为有效端口');
  const host = env.ORIGAMIX_RENDERER_HOST;
  if (host !== 'localhost' && host !== '127.0.0.1') throw new Error('开发宿主必须监听本机地址');
  const stateDir = env.ORIGAMIX_WEB_STATE_DIR?.trim();
  if (!stateDir) throw new Error('缺少 ORIGAMIX_WEB_STATE_DIR');
  return {
    desktop: desktop === '1',
    host,
    port: Number(port),
    stateDir: resolve(packageRoot, stateDir),
    projectPath: env.ORIGAMIX_WEB_PROJECT_DIR?.trim()
      ? resolve(packageRoot, env.ORIGAMIX_WEB_PROJECT_DIR.trim())
      : undefined,
  };
};
