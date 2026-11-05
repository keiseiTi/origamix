import { writeJsonAtomically } from '../infrastructure/atomic-file';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { OrigamixPageSchema, ProjectLayoutDocument } from '@origamix/shared';
import type { SchemaPageRef } from './schema-contracts';
import { assertTargetOwned, readTargetSchema, targetSchemaPath } from './target-schema-reader';

import { conflict } from '../errors';
import { projectFilePath } from '../infrastructure/project-path';

export class TargetSchemaStore {
  pathFor = targetSchemaPath;
  read = readTargetSchema;

  async write(page: SchemaPageRef, schema: OrigamixPageSchema): Promise<void> {
    const target = this.pathFor(page);
    await mkdir(dirname(target), { recursive: true });
    await assertTargetOwned(page);
    await writeJsonAtomically(target, schema);
  }
  layoutPath = (projectPath: string): Promise<string> =>
    projectFilePath(projectPath, 'src', 'origamix-layout', 'schema.json');
  readLayout = async (projectPath: string): Promise<unknown | undefined> => {
    try {
      return JSON.parse(await readFile(await this.layoutPath(projectPath), 'utf8')) as unknown;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
      if (error instanceof SyntaxError)
        throw conflict('项目布局文件已被外部修改，JSON 无效，请恢复原文件后重试');
      throw error;
    }
  };
  writeLayout = async (projectPath: string, document: ProjectLayoutDocument): Promise<void> => {
    const path = await this.layoutPath(projectPath);
    await mkdir(dirname(path), { recursive: true });
    await this.layoutPath(projectPath);
    await writeJsonAtomically(path, document);
  };
}
