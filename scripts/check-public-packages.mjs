import { publicPackage, publicPackageNames } from './public-packages.mjs';
import { spawnSync } from 'node:child_process';
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
  const visit = (value) => {
    if (typeof value === 'string' && !files.has(`package/${value.slice(2)}`))
      throw new Error(`Missing export ${name}: ${value}`);
    if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(manifest.exports);
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
