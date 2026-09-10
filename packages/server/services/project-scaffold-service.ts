import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { nanoid } from 'nanoid';
import { copyTemplate } from '../template';
import { invalid } from '../errors';
import { validatePage } from '@origamix/shared/protocol/validation';

async function atomicWrite(path: string, contents: string): Promise<void> {
  const temporary = `${path}.${nanoid()}.tmp`;
  await writeFile(temporary, contents, { mode: 0o600 });
  await rename(temporary, path);
}

export class ProjectScaffoldService {
  constructor(private readonly templatePath: string) {}

  async initializeExistingDirectory(path: string): Promise<void> {
    const directoryName = basename(path);
    const entries = await readdir(path);
    const hasApplicationFiles = entries.some(
      (entry) => entry === 'package.json' || entry === 'src',
    );
    if (!hasApplicationFiles) {
      const staging = await mkdtemp(join(dirname(path), '.origamix-scaffold-'));
      const prepared = join(staging, 'template');
      try {
        await copyTemplate(this.templatePath, prepared);
        for (const entry of await readdir(prepared))
          await cp(join(prepared, entry), join(path, entry), {
            recursive: true,
            errorOnExist: true,
            force: false,
          });
      } finally {
        await rm(staging, { recursive: true, force: true });
      }
    }

    let packageJson: {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    try {
      packageJson = JSON.parse(
        await readFile(join(path, 'package.json'), 'utf8'),
      ) as typeof packageJson;
    } catch {
      throw invalid('已有工程缺少有效的 package.json，无法按 React + Vite 标准初始化');
    }
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    if (!dependencies.react || !dependencies.vite)
      throw invalid('已有工程不符合 React + Vite 项目标准，未写入 Origamix 清单');

    const pages: Array<{ pageId: string; name: string; slug: string; route: string }> = [];
    const pagesPath = join(path, 'src', 'pages');
    await mkdir(pagesPath, { recursive: true });
    for (const entry of await readdir(pagesPath, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name)) continue;
      const schemaPath = join(pagesPath, entry.name, 'schema.json');
      try {
        const schema = JSON.parse(await readFile(schemaPath, 'utf8')) as unknown;
        if (!validatePage(schema).valid) throw invalid(`页面“${entry.name}”的 Schema 无效`);
        await access(join(pagesPath, entry.name, 'index.tsx'));
      } catch (error) {
        if (error instanceof Error && 'statusCode' in error) throw error;
        throw invalid(`页面“${entry.name}”不符合约定：需要有效的 index.tsx 和 schema.json`);
      }
      pages.push({
        pageId: `page_${nanoid()}`,
        name: entry.name,
        slug: entry.name,
        route: entry.name === 'home' && pages.length === 0 ? '/' : `/${entry.name}`,
      });
    }
    if (pages.length) {
      if (!dependencies['@origamix/runtime'] || !dependencies['@origamix/materials'])
        throw invalid('已有页面缺少 @origamix/runtime 或 @origamix/materials 依赖，未写入清单');
      try {
        await access(join(path, 'src', 'router.ts'));
      } catch {
        throw invalid('已有页面尚未挂载标准 src/router.ts，未写入 Origamix 清单');
      }
    }
    await atomicWrite(
      join(path, 'origamix.project.json'),
      `${JSON.stringify(
        {
          projectId: `project_${nanoid()}`,
          name: directoryName,
          code: directoryName,
          framework: 'react',
          uiLibrary: 'antd',
          pages,
        },
        null,
        2,
      )}\n`,
    );
    if (!hasApplicationFiles)
      await atomicWrite(
        join(path, 'README.md'),
        `# ${directoryName}\n\n## 使用\n\n\`\`\`sh\npnpm install\npnpm dev\npnpm build\npnpm preview\n\`\`\`\n\n生产部署请发布 \`dist/\`，并配置未知子路由回退到 \`index.html\`。\n`,
      );
  }
}
