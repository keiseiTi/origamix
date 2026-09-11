import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import { copyTemplate } from '../template';

const atomicWrite = async (path: string, contents: string): Promise<void> => {
  const temporary = `${path}.${nanoid()}.tmp`;
  await writeFile(temporary, contents, { mode: 0o600 });
  await rename(temporary, path);
};

const pageComponentName = (slug: string): string => {
  return `Page${slug.replace(/(^|-)([a-z0-9])/g, (_, __, character: string) => character.toUpperCase())}`;
};

const pageComponentSource = (slug: string): string => {
  const componentName = pageComponentName(slug);
  return `import { OrigamixPage } from '@origamix/runtime/react';\nimport materials from '@origamix/materials/antd';\nimport schema from './schema.json';\n\nconst ${componentName} = (): React.JSX.Element => {\n  return <OrigamixPage schema={schema} materials={materials} />;\n};\n\nexport default ${componentName};\n`;
};

export class ProjectSourceService {
  constructor(private readonly templatePath: string) {}

  async prepareNewProject(path: string, input: { name: string; code: string }): Promise<void> {
    await copyTemplate(this.templatePath, path);
    await mkdir(join(path, '.origamix', 'revisions'), { recursive: true });
    await atomicWrite(
      join(path, 'README.md'),
      `# ${input.name}\n\n项目标识：\`${input.code}\`\n\n## 使用\n\n\`\`\`sh\npnpm install\npnpm dev\npnpm build\npnpm preview\n\`\`\`\n\n生产部署请发布 \`dist/\`。项目使用浏览器历史路由，静态服务器需要把未知子路由回退到 \`index.html\`，以支持页面直接访问和刷新。\n`,
    );
    const packageJson = JSON.parse(await readFile(join(path, 'package.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    await atomicWrite(
      join(path, 'package.json'),
      `${JSON.stringify({ ...packageJson, name: input.code }, null, 2)}\n`,
    );
    await atomicWrite(
      join(path, 'index.html'),
      (await readFile(join(path, 'index.html'), 'utf8'))
        .replace('<html lang="en">', '<html lang="zh-CN">')
        .replace('<title>template</title>', `<title>${input.name}</title>`),
    );
  }

  async createPageEntry(projectPath: string, slug: string): Promise<void> {
    await atomicWrite(
      join(projectPath, 'src', 'pages', slug, 'index.tsx'),
      pageComponentSource(slug),
    );
  }
}
