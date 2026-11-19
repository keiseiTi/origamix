import {
  ORIGAMIX_VERSION,
  SCHEMA_VERSION,
  MATERIAL_CONTRACT_VERSION,
} from '../packages/shared/src/version.ts';
import {
  isProjectManifest,
  TEMPLATE_PROJECT_ID,
} from '../packages/shared/src/project/project-manifest.ts';
import { readFile, readdir } from 'node:fs/promises';
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
if (process.argv.slice(2).join(' ') !== '--check')
  throw new Error('用法：pnpm release:version --check');
if (
  ![ORIGAMIX_VERSION, SCHEMA_VERSION, MATERIAL_CONTRACT_VERSION].every(
    (version) => version === '1.0.0',
  )
)
  throw new Error('首版包、Schema 和物料契约必须使用 1.0.0');
const template = await readJson('packages/template/origamix.project.json');
if (
  !isProjectManifest(template) ||
  template.projectId !== TEMPLATE_PROJECT_ID ||
  template.materialSet.id !== 'official-antd' ||
  template.materialSet.version !== MATERIAL_CONTRACT_VERSION
)
  throw new Error('模板项目清单与首版物料契约不一致');
for (const path of manifests) {
  if ((await readJson(path)).version !== ORIGAMIX_VERSION)
    throw new Error(`${path} 未使用统一版本 ${ORIGAMIX_VERSION}`);
}
console.log(`统一发布版本检查通过：${ORIGAMIX_VERSION}`);
