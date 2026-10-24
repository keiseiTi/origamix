import { writeJsonAtomically } from '../infrastructure/atomic-file';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { OrigamixPageSchema } from '@origamix/shared';
import type { SchemaPageRef } from './schema-service';
import { assertTargetOwned, readTargetSchema, targetSchemaPath } from './target-schema-reader';

export class TargetSchemaStore {
  pathFor = targetSchemaPath;
  read = readTargetSchema;

  async write(page: SchemaPageRef, schema: OrigamixPageSchema): Promise<void> {
    const target = this.pathFor(page);
    await mkdir(dirname(target), { recursive: true });
    await assertTargetOwned(page);
    await writeJsonAtomically(target, schema);
  }
}
