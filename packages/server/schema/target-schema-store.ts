import { writeJsonAtomically } from '../infrastructure/atomic-file';
import { lstat, mkdir, readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative } from 'node:path';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import type { SchemaPageRef } from './schema-service';
import { invalid } from '../errors';

export class TargetSchemaStore {
  pathFor(page: SchemaPageRef): string {
    return join(
      page.projectPath,
      page.relativePath ?? join('src', 'pages', page.slug),
      'schema.json',
    );
  }

  async read(page: SchemaPageRef): Promise<OrigamixPageSchema> {
    await this.assertOwned(page);
    return JSON.parse(await readFile(this.pathFor(page), 'utf8')) as OrigamixPageSchema;
  }

  async write(page: SchemaPageRef, schema: OrigamixPageSchema): Promise<void> {
    const target = this.pathFor(page);
    await mkdir(dirname(target), { recursive: true });
    await this.assertOwned(page);
    await writeJsonAtomically(target, schema);
  }

  private async assertOwned(page: SchemaPageRef): Promise<void> {
    const project = await realpath(page.projectPath);
    const parent = await realpath(dirname(this.pathFor(page)));
    const fromProject = relative(project, parent);
    if (
      fromProject === '..' ||
      fromProject.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
      isAbsolute(fromProject)
    )
      throw invalid('页面目标路径不属于当前项目');
    try {
      if ((await lstat(this.pathFor(page))).isSymbolicLink())
        throw invalid('页面目标 Schema 不能是符号链接');
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
}
