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

export const loadDesktopEnvironment = (
  packageRoot: string,
): Record<string, string | undefined> => ({
  ...readEnvironment(resolve(packageRoot, '.env')),
  ...(process.env.ORIGAMIX_ENV_LOCAL === '0'
    ? {}
    : readEnvironment(resolve(packageRoot, '.env.local'), true)),
  ...process.env,
});

const required = (env: Record<string, string | undefined>, name: string): string => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`缺少 Desktop 配置：${name}`);
  return value;
};

export const desktopPort = (env: Record<string, string | undefined>, name: string): number => {
  const value = required(env, name);
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535)
    throw new Error(`Desktop 端口配置无效：${name}`);
  return Number(value);
};

export const desktopDebug = (env: Record<string, string | undefined>): boolean => {
  const value = required(env, 'ORIGAMIX_DEBUG');
  if (value !== '0' && value !== '1') throw new Error('ORIGAMIX_DEBUG 只接受 0 或 1');
  return value === '1';
};

export const desktopRendererUrl = (env: Record<string, string | undefined>): string => {
  const host = required(env, 'ORIGAMIX_RENDERER_HOST');
  if (host !== '127.0.0.1' && host !== 'localhost')
    throw new Error('Desktop 开发页面必须使用本机地址');
  return `http://${host}:${desktopPort(env, 'ORIGAMIX_RENDERER_PORT')}`;
};

export const resolveDesktopConfig = (input: {
  packaged: boolean;
  mainDirectory: string;
  resourcesPath: string;
  userDataPath: string;
}) => {
  // Bundled defaults ship beside main/. Personal files are read only by the dev launcher.
  const defaults = readEnvironment(resolve(input.mainDirectory, '../.env'));
  const env = input.packaged ? defaults : { ...defaults, ...process.env };
  const packageRoot = resolve(input.mainDirectory, '../..');
  const rendererPath = input.packaged
    ? resolve(input.resourcesPath, required(defaults, 'ORIGAMIX_PACKAGED_RENDERER_FILE'))
    : resolve(packageRoot, required(env, 'ORIGAMIX_RENDERER_FILE'));
  const rendererUrl = input.packaged ? undefined : env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    const url = new URL(rendererUrl);
    if (url.origin !== desktopRendererUrl(env) || url.pathname !== '/' || url.search || url.hash)
      throw new Error('开发页面地址与 Desktop 配置不一致');
  }
  const serverPort = env.ORIGAMIX_SERVER_PORT ?? '1029';
  if (!/^\d+$/.test(serverPort) || Number(serverPort) > 65535)
    throw new Error('ORIGAMIX_SERVER_PORT 必须为 0 到 65535 的整数');
  return {
    serverPort: Number(serverPort),
    rendererPath,
    rendererUrl,
    preloadPath: resolve(input.mainDirectory, '../preload/index.cjs'),
    backendPath: resolve(input.mainDirectory, 'server.cjs'),
    templatePath: input.packaged
      ? resolve(input.resourcesPath, required(defaults, 'ORIGAMIX_PACKAGED_TEMPLATE_DIR'))
      : resolve(packageRoot, required(env, 'ORIGAMIX_TEMPLATE_DIR')),
    databasePath: resolve(input.userDataPath, 'origamix.db'),
  };
};
