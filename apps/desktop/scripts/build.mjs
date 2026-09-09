import { build } from 'tsup';
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { copyTemplate } from '@origamix/server/template';
import { options, desktopRoot, workspaceRoot } from './tsup-options.mjs';

await build({ ...options, clean: true });
const require = createRequire(import.meta.url);
await cp(require.resolve('@origamix/server/utility'), `${desktopRoot}dist/main/server.cjs`);
await cp(
  `${require.resolve('@origamix/server/utility')}.map`,
  `${desktopRoot}dist/main/server.cjs.map`,
);
// tsup only cleans compiled outputs; explicitly replace the generated scaffold.
await rm(`${desktopRoot}dist/template`, { recursive: true, force: true });
await copyTemplate(`${workspaceRoot}packages/template`, `${desktopRoot}dist/template`);
const templateTarget = `${desktopRoot}dist/template`;
const vendorTarget = `${templateTarget}/vendor`;
await mkdir(vendorTarget, { recursive: true });
for (const [packageDirectory, prefix, targetName] of [
  [`${workspaceRoot}packages/runtime`, 'origamix-runtime-', 'runtime.tgz'],
  [`${workspaceRoot}packages/materials`, 'origamix-materials-', 'materials.tgz'],
]) {
  const packed = spawnSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['pack', '--pack-destination', vendorTarget],
    { cwd: packageDirectory, stdio: 'inherit' },
  );
  if (packed.error || packed.status !== 0)
    throw packed.error ?? new Error(`Unable to package ${packageDirectory}`);
  const archive = (await readdir(vendorTarget)).find((name) => name.startsWith(prefix));
  if (!archive) throw new Error(`Packed archive missing for ${packageDirectory}`);
  await rename(`${vendorTarget}/${archive}`, `${vendorTarget}/${targetName}`);
}
const templatePackagePath = `${templateTarget}/package.json`;
const templatePackage = JSON.parse(await readFile(templatePackagePath, 'utf8'));
templatePackage.dependencies['@origamix/runtime'] = 'file:vendor/runtime.tgz';
templatePackage.dependencies['@origamix/materials'] = 'file:vendor/materials.tgz';
await writeFile(templatePackagePath, `${JSON.stringify(templatePackage, null, 2)}\n`);
