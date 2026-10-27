import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const readEnvironment = (name, optional = false) => {
  try {
    return parseEnv(readFileSync(resolve(packageRoot, name), 'utf8'));
  } catch (error) {
    if (optional && error.code === 'ENOENT') return {};
    throw error;
  }
};
export const loadServerConfig = () => {
  const env = {
    ...readEnvironment('.env'),
    ...(process.env.ORIGAMIX_ENV_LOCAL === '0' ? {} : readEnvironment('.env.local', true)),
    ...process.env,
  };
  const directory = (key) => {
    const value = env[key]?.trim();
    if (!value) throw new Error(`缺少 Server 配置：${key}`);
    return resolve(packageRoot, value);
  };
  const token = process.env.ORIGAMIX_SERVER_TOKEN?.trim();
  if (!token) throw new Error('请通过 ORIGAMIX_SERVER_TOKEN 注入本地服务访问令牌');
  const stateDir = directory('ORIGAMIX_WEB_STATE_DIR');
  return {
    stateDir,
    templatePath: env.ORIGAMIX_TEMPLATE_DIR?.trim()
      ? resolve(packageRoot, env.ORIGAMIX_TEMPLATE_DIR.trim())
      : resolve(stateDir, 'template'),
    projectPath: env.ORIGAMIX_WEB_PROJECT_DIR?.trim()
      ? resolve(packageRoot, env.ORIGAMIX_WEB_PROJECT_DIR.trim())
      : undefined,
    token,
    serviceInstanceId: process.env.ORIGAMIX_SERVICE_ID?.trim(),
  };
};
