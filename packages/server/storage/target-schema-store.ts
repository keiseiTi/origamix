import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { nanoid } from 'nanoid';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import type { SchemaPageRef } from '../services/schema-service';

export class TargetSchemaStore {
  pathFor(page: SchemaPageRef): string {
    return join(page.projectPath, 'src', 'pages', page.slug, 'schema.json');
  }

  async read(page: SchemaPageRef): Promise<OrigamixPageSchema> {
    return JSON.parse(await readFile(this.pathFor(page), 'utf8')) as OrigamixPageSchema;
  }

  async write(page: SchemaPageRef, schema: OrigamixPageSchema): Promise<void> {
    const target = this.pathFor(page);
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${nanoid()}.tmp`;
    const handle = await open(temporary, 'wx', 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(schema, null, 2)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temporary, target);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }
}
