import {
  SCHEMA_VERSION,
  MATERIAL_CONTRACT_VERSION,
  isSemanticVersion,
} from '../packages/shared/src/version.ts';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
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
  const parts = (value: string) => value.split('.').map(Number);
  const previous = parts(release);
  const next = parts(requested!);
  const difference = next.findIndex((value, index) => value !== previous[index]);
  if (difference < 0 || next[difference] < previous[difference])
    throw new Error('发布版本必须递增');
  for (const path of manifests) {
    const manifest = await readJson(path);
    manifest.version = requested;
    await writeFile(resolve(root, path), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  await writeFile(
    resolve(root, versionFile),
    source.replace(/ORIGAMIX_VERSION = '[^']+'/, `ORIGAMIX_VERSION = '${requested}'`),
  );
  console.log(`统一包版本已更新至 ${requested}；物料契约和 Schema 版本保持不变。`);
} else if (mode === '--check') {
  if (![SCHEMA_VERSION, MATERIAL_CONTRACT_VERSION].every(isSemanticVersion))
    throw new Error('Schema 和物料契约必须使用有效 SemVer');
  const template = await readJson('packages/template/origamix.project.json');
  if (
    template.version ||
    template.uiLibrary ||
    template.materialSet?.id !== 'official-antd' ||
    template.materialSet?.version !== MATERIAL_CONTRACT_VERSION
  )
    throw new Error('模板项目清单与物料契约不一致');
  for (const path of manifests) {
    if ((await readJson(path)).version !== release)
      throw new Error(`${path} 未使用统一版本 ${release}`);
  }
  if (!source.includes(`ORIGAMIX_VERSION = '${release}'`)) throw new Error('Shared 发布版本未同步');
  console.log(`统一发布版本检查通过：${release}`);
} else throw new Error('使用 --check 或 --set <version>');
