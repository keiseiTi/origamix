import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { copyTemplate } from '../dist/template.cjs';

const directory = await mkdtemp(join(tmpdir(), 'origamix-template-smoke-'));
const project = join(directory, 'project');
try {
  await copyTemplate(fileURLToPath(new URL('../../template', import.meta.url)), project);
  const vendor = join(project, 'vendor');
  await mkdir(vendor);
  for (const [packagePath, targetName] of [
    ['../../runtime', 'runtime.tgz'],
    ['../../materials', 'materials.tgz'],
  ]) {
    const source = fileURLToPath(new URL(packagePath, import.meta.url));
    const child = spawnSync(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      ['pack', '--pack-destination', vendor],
      {
        cwd: source,
        stdio: 'inherit',
        timeout: 120000,
      },
    );
    if (child.error || child.status !== 0)
      throw child.error ?? new Error(`pnpm pack failed for ${source}`);
    const prefix = targetName === 'runtime.tgz' ? 'origamix-runtime-' : 'origamix-materials-';
    const { readdir } = await import('node:fs/promises');
    const packed = (await readdir(vendor)).find((name) => name.startsWith(prefix));
    if (!packed) throw new Error(`packed archive missing for ${source}`);
    await rename(join(vendor, packed), join(vendor, targetName));
  }
  const packageJsonPath = join(project, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  packageJson.dependencies['@origamix/runtime'] = 'file:vendor/runtime.tgz';
  packageJson.dependencies['@origamix/materials'] = 'file:vendor/materials.tgz';
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  for (const args of [['install', '--ignore-scripts'], ['typecheck'], ['build']]) {
    const child = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, {
      cwd: project,
      stdio: 'inherit',
      timeout: 120000,
    });
    if (child.error || child.status !== 0) throw child.error ?? new Error(`pnpm ${args[0]} failed`);
  }
  console.info('Template smoke passed: independent installation, strict typecheck and build.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
