import { publicPackage, publicPackageNames } from './public-packages.ts';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const dependencies: Record<string, string> = {};
const exportsToResolve: string[] = [];
for (const name of publicPackageNames) {
  const { archive } = await publicPackage(name);
  const list = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' });
  if (list.status !== 0) throw new Error(`Missing public archive: ${archive}`);
  const files = new Set(list.stdout.trim().split('\n'));
  const content = spawnSync('tar', ['-xOzf', archive, 'package/package.json'], {
    encoding: 'utf8',
  });
  const manifest = JSON.parse(content.stdout);
  const { manifest: expected } = await publicPackage(name);
  if (manifest.name !== expected.name || manifest.version !== expected.version)
    throw new Error(`Archive identity mismatch: ${name}`);
  if (manifest.private || JSON.stringify(manifest).includes('workspace:'))
    throw new Error(`Invalid public manifest: ${name}`);
  if (manifest.dependencies?.['@origamix/ui'] || manifest.peerDependencies?.['@origamix/ui'])
    throw new Error('Private UI cannot be an installation requirement');
  const visit = (value: unknown) => {
    if (typeof value === 'string' && !files.has(`package/${value.slice(2)}`))
      throw new Error(`Missing export ${name}: ${value}`);
    if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  assert.deepEqual(manifest.exports, expected.publishConfig?.exports ?? expected.exports);
  visit(manifest.exports);
  dependencies[manifest.name] = `file:${archive}`;
  for (const entry of Object.keys(manifest.exports)) {
    exportsToResolve.push(entry === '.' ? manifest.name : `${manifest.name}/${entry.slice(2)}`);
  }
  if (
    name === 'materials' &&
    [...files].some((file) => file.includes('/internal/') || file.includes('/editor.'))
  )
    throw new Error('Private editor artifacts in public Materials');
  for (const file of files) {
    if (!file.endsWith('.js') && !file.endsWith('.d.ts')) continue;
    const text = spawnSync('tar', ['-xOzf', archive, file], { encoding: 'utf8' }).stdout;
    if (/from\s*['"]@origamix\/(?:ui|editor)/.test(text))
      throw new Error(`Private dependency in ${file}`);
  }
  console.info(`${manifest.name}: public exports and dependency isolation verified`);
}

const installation = await mkdtemp(join(tmpdir(), 'origamix-public-archives-'));
try {
  await writeFile(
    join(installation, 'package.json'),
    JSON.stringify({
      name: 'origamix-archive-check',
      private: true,
      type: 'module',
      dependencies,
    }),
  );
  const install = spawnSync('pnpm', ['install', '--ignore-scripts'], {
    cwd: installation,
    stdio: 'inherit',
    timeout: 120000,
  });
  if (install.error || install.status !== 0)
    throw install.error ?? new Error('Public archive installation failed');
  const probe = join(installation, 'verify-exports.mjs');
  await writeFile(
    probe,
    `
    for (const entry of ${JSON.stringify(exportsToResolve)}) {
      await import(entry);
      console.info('Loaded installed export: ' + entry);
    }
  `,
  );
  const verified = spawnSync(process.execPath, [probe], {
    cwd: installation,
    stdio: 'inherit',
    timeout: 30000,
  });
  if (verified.error || verified.status !== 0)
    throw verified.error ?? new Error('Installed public package export failed to load');
} finally {
  await rm(installation, { recursive: true, force: true });
}
