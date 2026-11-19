import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = async (command: string, args: string[], cwd: string, env = process.env) => {
  const child = spawn(command, args, { cwd, env, stdio: 'inherit', timeout: 120000 });
  const [status, signal] = await once(child, 'close');
  if (status !== 0) throw new Error(`${command} ${args[0]} failed: ${signal ?? status}`);
};

export const verifyStandaloneProject = async (project: string, archives: string) => {
  const packagePath = join(project, 'package.json');
  const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
  manifest.pnpm = { ...manifest.pnpm, overrides: { ...manifest.pnpm?.overrides } };
  for (const kind of ['runtime', 'materials']) {
    await run(
      process.execPath,
      [...process.execArgv, fileURLToPath(new URL('./pack-public.ts', import.meta.url)), kind],
      process.cwd(),
      { ...process.env, ORIGAMIX_PACK_DIR: archives },
    );
    const name = `@origamix/${kind}`;
    manifest.pnpm.overrides[name] =
      `file:${join(archives, `origamix-${kind}-${manifest.dependencies[name]}.tgz`)}`;
  }
  await writeFile(packagePath, JSON.stringify(manifest, null, 2));
  for (const args of [['install', '--ignore-scripts'], ['typecheck'], ['build']])
    await run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, project);
};
