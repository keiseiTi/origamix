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
import type { Dirent } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { nanoid } from 'nanoid';
import { copyTemplate } from '../template';
import { invalid } from '../errors';
import { validatePage } from '@origamix/shared/protocol/validation';
import type { ProjectInitializationInspection } from '@origamix/shared/protocol/api';

const atomicWrite = async (path: string, contents: string): Promise<void> => {
  const temporary = `${path}.${nanoid()}.tmp`;
  await writeFile(temporary, contents, { mode: 0o600 });
  await rename(temporary, path);
};

export class ProjectScaffoldService {
  constructor(private readonly templatePath: string) {}

  async inspectExistingDirectory(path: string): Promise<ProjectInitializationInspection> {
    const entries = await readdir(path);
    const hasApplicationFiles = entries.some(
      (entry) => entry === 'package.json' || entry === 'src',
    );
    if (!hasApplicationFiles)
      return {
        directoryKind: 'empty',
        discoveredPages: [],
        plannedChanges: ['生成完整项目模板', '创建空页面清单', '建立本机编辑状态目录'],
        blockers: [],
      };

    const blockers: string[] = [];
    let dependencies: Record<string, string> = {};
    try {
      const packageJson = JSON.parse(await readFile(join(path, 'package.json'), 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      if (!dependencies.react || !dependencies.vite)
        blockers.push('工程需要有效的 React 与 Vite 依赖');
    } catch {
      blockers.push('工程需要有效的 package.json');
    }

    const discoveredPages: ProjectInitializationInspection['discoveredPages'] = [];
    const pagesPath = join(path, 'src', 'pages');
    let pageEntries: Dirent[] = [];
    try {
      pageEntries = await readdir(pagesPath, { withFileTypes: true });
    } catch {
      // A project without the standard pages directory starts with an empty page list.
    }
    for (const entry of pageEntries) {
      if (!entry.isDirectory() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name)) continue;
      try {
        const schema = JSON.parse(
          await readFile(join(pagesPath, entry.name, 'schema.json'), 'utf8'),
        ) as unknown;
        await access(join(pagesPath, entry.name, 'index.tsx'));
        if (!validatePage(schema).valid) throw new Error('invalid schema');
        discoveredPages.push({
          name: entry.name,
          slug: entry.name,
          route: entry.name === 'home' && discoveredPages.length === 0 ? '/' : `/${entry.name}`,
        });
      } catch {
        blockers.push(`页面“${entry.name}”需要有效的 index.tsx 和 schema.json`);
      }
    }
    if (
      discoveredPages.length &&
      (!dependencies['@origamix/runtime'] || !dependencies['@origamix/materials'])
    )
      blockers.push('已有页面需要声明 @origamix/runtime 与 @origamix/materials 依赖');
    if (discoveredPages.length) {
      try {
        await access(join(path, 'src', 'router.ts'));
      } catch {
        blockers.push('已有页面需要挂载标准 src/router.ts');
      }
    }
    return {
      directoryKind: 'existing_application',
      discoveredPages,
      plannedChanges: ['写入 origamix.project.json', '按发现页面建立本地索引和工作副本'],
      blockers,
    };
  }

  async initializeExistingDirectory(path: string): Promise<void> {
    const inspection = await this.inspectExistingDirectory(path);
    if (inspection.blockers.length > 0)
      throw invalid(`项目尚不能初始化：${inspection.blockers.join('；')}`);

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
        `# ${directoryName}\n\n## 使用\n\n\`\`\`sh\npnpm install\npnpm dev\npnpm build\npnpm preview\n\`\`\`\n\n生产部署请发布 \`dist/\`，并配置未知子路由回退到 \`index.html\`。\n\n\`.origamix/\` 是不参与运行和部署的本机编辑状态，默认不提交到版本库。真实运行页面只读取 \`src/pages/*/schema.json\`。\n`,
      );
  }
}
