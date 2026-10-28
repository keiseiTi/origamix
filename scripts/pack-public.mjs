import { publicPackage } from './public-packages.mjs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const name = process.argv[2];
const { source, destination } = await publicPackage(name);
const temporary = await mkdtemp(join(tmpdir(), 'origamix-pack-'));
try {
  const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
  manifest.exports = manifest.publishConfig?.exports ?? manifest.exports;
  delete manifest.devDependencies;
  delete manifest.scripts;
  delete manifest.publishConfig;
  if (name === 'materials') {
    delete manifest.peerDependencies['@origamix/ui'];
    delete manifest.peerDependenciesMeta;
    manifest.files = ['dist/public'];
    await mkdir(join(temporary, 'dist'), { recursive: true });
    await cp(join(source, 'dist/public'), join(temporary, 'dist/public'), { recursive: true });
  } else await cp(join(source, 'dist'), join(temporary, 'dist'), { recursive: true });
  await cp(
    join(source, name === 'materials' ? 'README.public.md' : 'README.md'),
    join(temporary, 'README.md'),
  );
  const rootManifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  manifest.license ??= rootManifest.license;
  manifest.author ??= rootManifest.author;
  await writeFile(join(temporary, 'package.json'), JSON.stringify(manifest, null, 2));
  await mkdir(destination, { recursive: true });
  const result = spawnSync('pnpm', ['pack', '--pack-destination', destination], {
    cwd: temporary,
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('Public package pack failed');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
