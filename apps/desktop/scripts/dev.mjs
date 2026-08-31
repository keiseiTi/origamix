import { context } from 'esbuild';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const desktopRoot = fileURLToPath(new URL('..', import.meta.url));
const root = fileURLToPath(new URL('../../..', import.meta.url));
const output = `${desktopRoot}/dist`;
const options = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: 'inline',
  external: ['electron'],
};
let electron;
let restarting = false;
const restart = () => {
  if (restarting) return;
  restarting = true;
  electron?.kill();
  electron = spawn('pnpm', ['exec', 'electron', `${output}/main/index.cjs`], {
    cwd: desktopRoot,
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_RENDERER_URL: 'http://127.0.0.1:5173' },
  });
  electron.once('exit', () => {
    restarting = false;
  });
};
const buildContexts = await Promise.all([
  context({
    ...options,
    entryPoints: [`${desktopRoot}/src/main/index.ts`],
    outfile: `${output}/main/index.cjs`,
    plugins: [
      {
        name: 'restart-electron',
        setup(build) {
          build.onEnd(restart);
        },
      },
    ],
  }),
  context({
    ...options,
    entryPoints: [`${desktopRoot}/src/preload/index.ts`],
    outfile: `${output}/preload/index.cjs`,
  }),
  context({
    ...options,
    entryPoints: [`${desktopRoot}/src/preload/preview.ts`],
    outfile: `${output}/preload/preview.cjs`,
  }),
  context({
    ...options,
    entryPoints: [`${root}/packages/server/index.ts`],
    outfile: `${output}/main/server.cjs`,
  }),
]);
const vite = spawn('pnpm', ['--filter', '@origamix/app', 'dev'], { cwd: root, stdio: 'inherit' });
await Promise.all(buildContexts.map((item) => item.watch()));
process.on('SIGINT', async () => {
  electron?.kill();
  vite.kill();
  await Promise.all(buildContexts.map((item) => item.dispose()));
  process.exit(0);
});
