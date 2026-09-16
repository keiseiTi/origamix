import { fileURLToPath } from 'node:url';
import { runDevelopment } from './dev-supervisor.mjs';

if (!process.env.ORIGAMIX_SERVER_TOKEN)
  throw new Error('请通过 ORIGAMIX_SERVER_TOKEN 提供本地服务访问令牌');
runDevelopment({ entry: fileURLToPath(new URL('./dev-worker.mjs', import.meta.url)) });
