import { KeyedQueue } from '../infrastructure/keyed-queue';
import {
  SchemaCommit,
  createRevisionSnapshot,
  validateSnapshot,
  type SchemaCommitOptions,
} from './schema-commit';
import { hashSchema } from './schema-hash';
import type { OrigamixPageSchema, SchemaOperation } from '@origamix/shared/protocol/schema';
import type { RevisionHistory } from '@origamix/shared/protocol/api';
import { validatePage } from '@origamix/shared/protocol/validation';
import { conflict, invalid } from '../errors';
import { validateProjectPageAgainstMaterials } from './material-validation';
import {
  WorkingSchemaStore,
  type WorkingSchemaFile,
  type WorkingSchemaPageRef,
} from './working-schema-store';
import { applySchemaOperationBatch } from './schema-operation-engine';

export interface SchemaWriteOptions extends SchemaCommitOptions {
  /** Re-check cancellation or authority after queueing, before the first durable write. */
  beforeWrite?: () => void | Promise<void>;
}
export type SchemaPageRef = WorkingSchemaPageRef;
export interface SchemaReadResult {
  schema: OrigamixPageSchema;
  revisionId: string;
}
export interface WorkingSchemaReadResult extends SchemaReadResult {
  workingVersion: number;
  workingHash: string;
  savedSchemaHash: string;
  baselineHash: string;
}

// One process-wide page queue is shared by reads, Working writes, revisions and Apply.
const pageQueue = new KeyedQueue();
const store = new WorkingSchemaStore();
const commits = new SchemaCommit(store);

const withSchemaPageQueue = <T>(page: SchemaPageRef, action: () => Promise<T>): Promise<T> =>
  pageQueue.run(`${page.projectPath}\0${page.pageId}`, action);

export const listRevisionHistory = async (page: SchemaPageRef): Promise<RevisionHistory> => {
  return withSchemaPageQueue(page, async () => {
    await commits.recover(page);
    const working = await getSchemaUnlocked(page);
    const snapshots = await store.listRevisions(page);
    for (const snapshot of snapshots) validateSnapshot(snapshot);
    return {
      revisions: snapshots
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map((snapshot) => ({
          revisionId: snapshot.revisionId,
          parentRevisionId: snapshot.parentRevisionId,
          source: snapshot.source,
          createdAt: snapshot.createdAt,
          schemaHash: snapshot.schemaHash,
          isCurrent: snapshot.revisionId === working.lastSavedRevisionId,
          isApplied: snapshot.schemaHash === working.baselineHash,
        })),
    };
  });
};

export const discardInitializedPageSchema = (page: SchemaPageRef): Promise<void> =>
  withSchemaPageQueue(page, () => store.removePage(page));

const validationMessage = (result: ReturnType<typeof validatePage>): string => {
  return result.semanticErrors[0]?.message ?? result.errors[0]?.message ?? 'Schema 校验失败';
};
const validateWritableSchema = async (
  page: SchemaPageRef,
  schema: OrigamixPageSchema,
): Promise<void> => {
  const structural = validatePage(schema);
  if (!structural.valid) throw invalid(validationMessage(structural));
  const material = await validateProjectPageAgainstMaterials(page.projectPath, schema);
  if (!material.valid) {
    const first = material.errors[0]!;
    throw invalid(`${first.code} at ${first.path}: ${first.message}`);
  }
};
const readWorking = async (page: SchemaPageRef): Promise<WorkingSchemaFile> => {
  const working = await store.readWorking(page);
  if (
    working.version !== 2 ||
    working.pageId !== page.pageId ||
    !working.lastSavedRevisionId ||
    !Number.isSafeInteger(working.workingVersion) ||
    working.workingVersion < 1 ||
    !working.workingHash ||
    !working.savedSchemaHash ||
    !working.baselineHash
  )
    throw invalid('页面工作副本无效');
  return working;
};
export const initializePageSchema = async (
  page: SchemaPageRef,
  schema: OrigamixPageSchema,
  options: SchemaWriteOptions = {},
): Promise<string> => {
  return withSchemaPageQueue(page, async () => {
    await commits.recover(page);
    await validateWritableSchema(page, schema);
    return (
      await commits.commit(
        page,
        createRevisionSnapshot(schema, { kind: 'user', actorId: 'system' }, null),
        options,
      )
    ).revisionId;
  });
};

const getSchemaUnlocked = async (page: SchemaPageRef): Promise<WorkingSchemaFile> => {
  await commits.recover(page);
  const working = await readWorking(page);
  const validation = validatePage(working.schema);
  if (!validation.valid) throw invalid(validationMessage(validation));
  return working;
};
export const getSchema = async (page: SchemaPageRef): Promise<SchemaReadResult> => {
  return withSchemaPageQueue(page, async () => {
    const { schema, lastSavedRevisionId } = await getSchemaUnlocked(page);
    return { schema, revisionId: lastSavedRevisionId };
  });
};

export const getWorkingSchemaState = async (
  page: SchemaPageRef,
): Promise<WorkingSchemaReadResult & { schemaHash: string }> => {
  return withSchemaPageQueue(page, async () => {
    const current = await getSchemaUnlocked(page);
    return {
      schema: current.schema,
      revisionId: current.lastSavedRevisionId,
      workingVersion: current.workingVersion,
      workingHash: current.workingHash,
      savedSchemaHash: current.savedSchemaHash,
      baselineHash: current.baselineHash,
      schemaHash: current.workingHash,
    };
  });
};

export const updateWorkingBaseline = async (
  page: SchemaPageRef,
  expectedWorkingVersion: number,
  baselineHash: string,
): Promise<void> => {
  return withSchemaPageQueue(page, async () => {
    const current = await getSchemaUnlocked(page);
    if (current.workingVersion !== expectedWorkingVersion)
      throw conflict('页面草稿已更新，请重新应用');
    await store.writeWorking(page, { ...current, baselineHash });
  });
};

export const applyWorkingSchemaOperation = async <T>(
  page: SchemaPageRef,
  expectedRevisionId: string,
  expectedWorkingVersion: number,
  operation: (
    current: WorkingSchemaReadResult & { schemaHash: string },
  ) => Promise<{ result: T; baselineHash: string }>,
): Promise<T> => {
  return withSchemaPageQueue(page, async () => {
    const current = await getSchemaUnlocked(page);
    if (
      current.lastSavedRevisionId !== expectedRevisionId ||
      current.workingVersion !== expectedWorkingVersion
    )
      throw conflict('页面已更新，请重新应用');
    if (current.workingHash !== current.savedSchemaHash)
      throw conflict('当前草稿尚未保存版本，请先保存版本再应用到项目');
    const completed = await operation({
      schema: current.schema,
      revisionId: current.lastSavedRevisionId,
      workingVersion: current.workingVersion,
      workingHash: current.workingHash,
      savedSchemaHash: current.savedSchemaHash,
      baselineHash: current.baselineHash,
      schemaHash: current.workingHash,
    });
    await store.writeWorking(page, {
      ...current,
      baselineHash: completed.baselineHash,
    });
    return completed.result;
  });
};

export const reloadWorkingSchemaFromTarget = async (
  page: SchemaPageRef,
  schema: OrigamixPageSchema,
): Promise<SchemaReadResult> => {
  return withSchemaPageQueue(page, async () => {
    await commits.recover(page);
    await validateWritableSchema(page, schema);
    const current = await getSchemaUnlocked(page);
    const updated = await commits.commit(
      page,
      createRevisionSnapshot(
        schema,
        { kind: 'user', actorId: 'system' },
        current.lastSavedRevisionId,
      ),
      {},
    );
    const working = await readWorking(page);
    await store.writeWorking(page, {
      ...working,
      baselineHash: hashSchema(schema),
    });
    return updated;
  });
};

export const hasValidRevision = async (
  page: SchemaPageRef,
  revisionId: string,
): Promise<boolean> => {
  return withSchemaPageQueue(page, async () => {
    try {
      const snapshot = await store.readRevision(page, revisionId);
      validateSnapshot(snapshot);
      return snapshot.revisionId === revisionId;
    } catch {
      return false;
    }
  });
};

const workingResult = (working: WorkingSchemaFile): WorkingSchemaReadResult => ({
  schema: working.schema,
  revisionId: working.lastSavedRevisionId,
  workingVersion: working.workingVersion,
  workingHash: working.workingHash,
  savedSchemaHash: working.savedSchemaHash,
  baselineHash: working.baselineHash,
});

const writeWorkingDraft = async (
  page: SchemaPageRef,
  current: WorkingSchemaFile,
  schema: OrigamixPageSchema,
): Promise<WorkingSchemaReadResult> => {
  const durableSchema = structuredClone(schema);
  const workingHash = hashSchema(durableSchema);
  if (workingHash === current.workingHash) return workingResult(current);
  const updated: WorkingSchemaFile = {
    ...current,
    workingVersion: current.workingVersion + 1,
    workingHash,
    updatedAt: new Date().toISOString(),
    schema: durableSchema,
  };
  await store.writeWorking(page, updated);
  return workingResult(updated);
};

export const updateWorkingSchema = async (
  page: SchemaPageRef,
  input: {
    baseWorkingVersion: number;
    schema: OrigamixPageSchema;
  },
  options: Pick<SchemaWriteOptions, 'beforeWrite'> = {},
): Promise<WorkingSchemaReadResult> => {
  return withSchemaPageQueue(page, async () => {
    const current = await getSchemaUnlocked(page);
    if (current.workingVersion !== input.baseWorkingVersion)
      throw conflict('页面草稿已更新，请重新加载后再提交');
    await validateWritableSchema(page, input.schema);
    await options.beforeWrite?.();
    return writeWorkingDraft(page, current, input.schema);
  });
};

export const applyWorkingSchemaOperations = async (
  page: SchemaPageRef,
  input: {
    baseWorkingVersion: number;
    operations: readonly SchemaOperation[];
  },
  options: Pick<SchemaWriteOptions, 'beforeWrite'> = {},
): Promise<WorkingSchemaReadResult> => {
  return withSchemaPageQueue(page, async () => {
    const current = await getSchemaUnlocked(page);
    if (current.workingVersion !== input.baseWorkingVersion)
      throw conflict('页面草稿已更新，请重新加载后再提交');
    const candidate = applySchemaOperationBatch(current.schema, input.operations).schema;
    await validateWritableSchema(page, candidate);
    await options.beforeWrite?.();
    return writeWorkingDraft(page, current, candidate);
  });
};

export const saveWorkingRevision = async (
  page: SchemaPageRef,
  expectedWorkingVersion: number,
  options: SchemaWriteOptions = {},
): Promise<WorkingSchemaReadResult> => {
  return withSchemaPageQueue(page, async () => {
    const current = await getSchemaUnlocked(page);
    if (current.workingVersion !== expectedWorkingVersion)
      throw conflict('页面草稿已更新，请重新保存');
    if (current.workingHash === current.savedSchemaHash) return workingResult(current);
    await options.beforeWrite?.();
    await commits.commit(
      page,
      createRevisionSnapshot(current.schema, { kind: 'user' }, current.lastSavedRevisionId),
      options,
    );
    return workingResult(await readWorking(page));
  });
};

export const restoreRevisionToWorking = async (
  page: SchemaPageRef,
  revisionId: string,
  expectedWorkingVersion: number,
): Promise<WorkingSchemaReadResult> => {
  return withSchemaPageQueue(page, async () => {
    const current = await getSchemaUnlocked(page);
    if (current.workingVersion !== expectedWorkingVersion)
      throw conflict('页面草稿已更新，请重新恢复');
    const snapshot = await store.readRevision(page, revisionId);
    validateSnapshot(snapshot);
    await validateWritableSchema(page, snapshot.schema);
    return writeWorkingDraft(page, current, snapshot.schema);
  });
};
export const getSchemaRevision = async (
  page: SchemaPageRef,
  revisionId: string,
): Promise<SchemaReadResult> => {
  return withSchemaPageQueue(page, async () => {
    await commits.recover(page);
    const snapshot = await store.readRevision(page, revisionId);
    validateSnapshot(snapshot);
    if (snapshot.revisionId !== revisionId) throw invalid('页面 Revision 快照不匹配');
    return { schema: snapshot.schema, revisionId: snapshot.revisionId };
  });
};
