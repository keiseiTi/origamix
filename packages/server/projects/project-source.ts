import { writeFileAtomically } from '../infrastructure/atomic-file';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { validateResolvedProjectStack, type ProjectStack } from '@origamix/shared';
import { copyTemplate } from '../template';

const pageComponentName = (slug: string): string => {
  return `Page${slug.replace(/(^|-)([a-z0-9])/g, (_, __, character: string) => character.toUpperCase())}`;
};

const pageComponentSource = (slug: string, stack: ProjectStack): string => {
  validateResolvedProjectStack(stack);
  // Explicit built-in module paths; project files never choose executable imports.
  const runtimeEntry = '@origamix/runtime/react';
  const materialEntry = '@origamix/materials/antd/runtime';
  const componentName = pageComponentName(slug);
  return `import { OrigamixPage } from '${runtimeEntry}';\nimport materials from '${materialEntry}';\nimport schema from './schema.json';\n\nconst ${componentName} = (): React.JSX.Element => {\n  return <OrigamixPage schema={schema} materials={materials} />;\n};\n\nexport default ${componentName};\n`;
};

export class ProjectSourceService {
  constructor(private readonly templatePath: string) {}

  async prepareNewProject(path: string, input: { name: string; code: string }): Promise<void> {
    await copyTemplate(this.templatePath, path);
    await mkdir(join(path, '.origamix', 'revisions'), { recursive: true });
    const readme = await readFile(join(path, 'README.md'), 'utf8');
    await writeFileAtomically(
      join(path, 'README.md'),
      readme.replace(/^# .*$/m, () => `# ${input.name}\n\n项目标识：\`${input.code}\``),
    );
    const packageJson = JSON.parse(await readFile(join(path, 'package.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    await writeFileAtomically(
      join(path, 'package.json'),
      `${JSON.stringify({ ...packageJson, name: input.code }, null, 2)}\n`,
    );
    await writeFileAtomically(
      join(path, 'index.html'),
      (await readFile(join(path, 'index.html'), 'utf8'))
        .replace('<html lang="en">', '<html lang="zh-CN">')
        .replace('<title>template</title>', `<title>${input.name}</title>`),
    );
  }

  async createPageEntry(
    projectPath: string,
    pageDirectory: string,
    slug: string,
    stack: ProjectStack,
  ): Promise<void> {
    await writeFileAtomically(
      join(projectPath, 'src', pageDirectory, slug, 'index.tsx'),
      pageComponentSource(slug, stack),
    );
  }

  removePageDirectory(projectPath: string, pageDirectory: string, slug: string): Promise<void> {
    return rm(join(projectPath, 'src', pageDirectory, slug), { recursive: true, force: true });
  }
}
