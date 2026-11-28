import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';
import { loadWebServerConfig } from '../packages/server/scripts/config.ts';
import { stopChild } from './lib/child-process.ts';
import { workspaceRoot } from './run-pnpm.ts';

const { port, token, serviceInstanceId } = loadWebServerConfig(true);
if (port === 0) throw new Error('Web 联调需要固定的 ORIGAMIX_SERVER_PORT');

const lifetime = new AbortController();
const children: ChildProcess[] = [];
const launch = (directory: string, entry: string, args: string[], env: NodeJS.ProcessEnv) => {
  const cwd = join(workspaceRoot, directory);
  const child = fork(join(cwd, 'scripts', entry), args, {
    cwd,
    env,
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  });
  children.push(child);
  child.once('exit', (code) => {
    if (lifetime.signal.aborted) return;
    process.exitCode = code ?? 1;
    lifetime.abort();
  });
  child.once('error', (error) => {
    if (lifetime.signal.aborted) return;
    console.error(error.message);
    process.exitCode = 1;
    lifetime.abort();
  });
  return child;
};

const interrupt = () => lifetime.abort();
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);

try {
  const server = launch('packages/server', 'dev.ts', ['--web'], process.env);
  const startup = AbortSignal.any([lifetime.signal, AbortSignal.timeout(120_000)]);
  // Wait for this child to bind its port before probing, even if a service is already listening.
  const [ready] = await once(server, 'message', { signal: startup });
  if (ready?.type !== 'web-ready' || ready.port !== port)
    throw new Error('Web Server 返回的监听端口与配置不一致');
  const health = await fetch(`http://127.0.0.1:${port}/api/v1/health`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Origamix-Service': serviceInstanceId },
    signal: AbortSignal.any([startup, AbortSignal.timeout(3000)]),
    redirect: 'error',
  });
  await health.body?.cancel();
  if (!health.ok) throw new Error(`Web Server 健康检查失败（HTTP ${health.status}）`);
  lifetime.signal.throwIfAborted();

  const appEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ORIGAMIX_HOST: 'web',
    ORIGAMIX_SERVER_PORT: String(port),
    ORIGAMIX_SERVER_TOKEN: token,
    ORIGAMIX_SERVICE_ID: serviceInstanceId,
  };
  delete appEnv.ORIGAMIX_WEB_MYSQL_URL;
  delete appEnv.DEEPSEEK_API_KEY;
  launch('packages/app', 'dev.ts', process.argv.slice(2), appEnv);
  if (!lifetime.signal.aborted) await once(lifetime.signal, 'abort');
} catch (error) {
  if (!lifetime.signal.aborted) {
    console.error('Web 启动失败', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
} finally {
  lifetime.abort();
  await Promise.all(children.map((child) => stopChild(child, 8000)));
  process.off('SIGINT', interrupt);
  process.off('SIGTERM', interrupt);
}
