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
export const loadServerEnvironment = (development: boolean): NodeJS.ProcessEnv => ({
  ORIGAMIX_SERVER_PORT: '1029',
  ORIGAMIX_LOCAL_STATE_DIR: '../../.origamix-local',
  ...readEnvFile(resolve(packageRoot, '.env')),
  ...(development && process.env.ORIGAMIX_ENV_LOCAL !== '0'
    ? readEnvFile(resolve(packageRoot, '.env.local'))
    : {}),
  ...process.env,
});

export const parseServerPort = (value = '') => {
  if (!/^\d+$/.test(value) || Number(value) > 65535)
    throw new Error('ORIGAMIX_SERVER_PORT 必须为 0 到 65535 的整数');
  return Number(value);
};

export const loadServerConfig = () => {
  const env = loadServerEnvironment(true);
  const directory = (key: string) => {
    const value = env[key]?.trim();
    if (!value) throw new Error(`缺少 Server 配置：${key}`);
    return resolve(packageRoot, value);
  };
  const token = process.env.ORIGAMIX_SERVER_TOKEN?.trim();
  if (!token) throw new Error('请通过 ORIGAMIX_SERVER_TOKEN 注入本地服务访问令牌');
  const stateDir = directory('ORIGAMIX_LOCAL_STATE_DIR');
  return {
    serverPort: parseServerPort(env.ORIGAMIX_SERVER_PORT),
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

const loadProductionWebConfig = (env: NodeJS.ProcessEnv) => {
  const portValue = env.ORIGAMIX_WEB_PORT ?? '9685';
  const port = Number(portValue);
  if (!/^\d+$/.test(portValue) || port < 1 || port > 65535)
    throw new Error('ORIGAMIX_WEB_PORT 必须为有效端口');
  const origin = new URL(env.ORIGAMIX_WEB_ORIGIN ?? `http://127.0.0.1:${port}`);
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
  const password = env.ORIGAMIX_WEB_PASSWORD;
  if (!password || password.trim().length < 16 || password.length > 512)
    throw new Error('ORIGAMIX_WEB_PASSWORD 必须设置为 16 至 512 字符的访问密码');

  return {
    port,
    origin,
    password,
    rendererDirectory: resolve(packageRoot, env.ORIGAMIX_WEB_RENDERER_DIR || '../app/dist/web'),
  };
};

export const loadWebServerConfig = (development: boolean) => {
  const env = loadServerEnvironment(development);
  const mysqlUrl = env.ORIGAMIX_WEB_MYSQL_URL?.trim();
  if (!mysqlUrl) throw new Error('缺少 Server 配置：ORIGAMIX_WEB_MYSQL_URL');
  const token = env.ORIGAMIX_SERVER_TOKEN?.trim();
  if (development && !token) throw new Error('缺少 Server 配置：ORIGAMIX_SERVER_TOKEN');
  const productionWeb = development ? undefined : loadProductionWebConfig(env);
  return {
    mysqlUrl,
    token: token ?? '',
    port: productionWeb?.port ?? parseServerPort(env.ORIGAMIX_SERVER_PORT),
    productionWeb,
    serviceInstanceId: env.ORIGAMIX_SERVICE_ID?.trim() || 'origamix-web',
    modelKey: env.DEEPSEEK_API_KEY?.trim() || undefined,
    templateDirectory: resolve(
      packageRoot,
      env.ORIGAMIX_WEB_TEMPLATE_DIR || '../../dist/web-template',
    ),
  };
};
