import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const manifests = ['package.json', 'site/package.json'];
for (const parent of ['packages', 'apps']) {
  for (const entry of await readdir(resolve(root, parent), { withFileTypes: true })) {
    if (entry.isDirectory()) manifests.push(`${parent}/${entry.name}/package.json`);
  }
}
const [mode, requested] = process.argv.slice(2);
const release = (await readJson('package.json')).version;
const versionFile = 'packages/shared/src/version.ts';
const source = await readFile(resolve(root, versionFile), 'utf8');
if (mode === '--set') {
  if (!/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(requested ?? ''))
    throw new Error('用法：pnpm release:version --set 1.0.1');
  const parts = (value) => value.split('.').map(Number);
  const previous = parts(release);
  const next = parts(requested);
  const difference = next.findIndex((value, index) => value !== previous[index]);
  if (difference < 0 || next[difference] < previous[difference])
    throw new Error('发布版本必须递增');
  for (const path of manifests) {
    const manifest = await readJson(path);
    manifest.version = requested;
    await writeFile(resolve(root, path), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const updated = source
    .replace(/ORIGAMIX_VERSION = '[^']+'/, `ORIGAMIX_VERSION = '${requested}'`)
    .replace(
      /ORIGAMIX_RELEASES: readonly string\[\] = \[([^\]]*)\]/,
      (_, values) =>
        `ORIGAMIX_RELEASES: readonly string[] = [${values.replace(/,\s*$/, '')}, '${requested}']`,
    );
  await writeFile(resolve(root, versionFile), updated);
  const template = await readJson('packages/template/origamix.project.json');
  template.version = requested;
  await writeFile(
    resolve(root, 'packages/template/origamix.project.json'),
    `${JSON.stringify(template, null, 2)}\n`,
  );
  console.log(
    `统一版本已更新至 ${requested}。发布前必须补齐 Schema 迁移链；数据库有结构变化时补充数据库迁移。`,
  );
} else if (mode === '--check') {
  for (const path of manifests) {
    if ((await readJson(path)).version !== release)
      throw new Error(`${path} 未使用统一版本 ${release}`);
  }
  if (!source.includes(`ORIGAMIX_VERSION = '${release}'`)) throw new Error('Shared 发布版本未同步');
  if ((await readJson('packages/template/origamix.project.json')).version !== release)
    throw new Error('模板项目版本未同步');
  const releases = source
    .match(/ORIGAMIX_RELEASES: readonly string\[\] = \[([^\]]*)\]/)?.[1]
    .match(/'[^']+'/g)
    ?.map((value) => value.slice(1, -1));
  if (
    !releases?.length ||
    releases.at(-1) !== release ||
    new Set(releases).size !== releases.length
  )
    throw new Error('发布序列与当前版本不一致');
  const migrationSource = await readFile(
    resolve(root, 'packages/server/schema/schema-migrations.ts'),
    'utf8',
  );
  const steps = [...migrationSource.matchAll(/from: '([^']+)',\s*to: '([^']+)'/g)];
  for (let index = 0; index < releases.length - 1; index += 1) {
    if (
      steps.filter((step) => step[1] === releases[index] && step[2] === releases[index + 1])
        .length !== 1
    )
      throw new Error(
        `请声明 Schema 迁移：${releases[index]} → ${releases[index + 1]}（无结构变化时也要显式声明原样转换）`,
      );
  }
  console.log(`统一发布版本检查通过：${release}`);
} else throw new Error('使用 --check 或 --set <version>');
