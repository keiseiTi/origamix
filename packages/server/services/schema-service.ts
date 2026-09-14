import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';
import type { ChangeSet, OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { validateChangeSet, validatePage } from '@origamix/shared/protocol/validation';
import { conflict, invalid, notFound } from '../errors';
import { validateProjectPageAgainstMaterials } from './schema-material-validation';
import {
  WorkingSchemaStore,
  type ChangeSetReceipt,
  type CommitJournal,
  type RevisionSnapshot,
  type WorkingSchemaFile,
  type WorkingSchemaPageRef,
} from '../storage/working-schema-store';

export type SchemaWriteStage = 'prepared' | 'revision' | 'schema' | 'meta' | 'receipt';
export interface SchemaWriteOptions {
  /** Test/host hook used to simulate interruption after a durable write stage. */
  afterStage?: (stage: SchemaWriteStage) => void | Promise<void>;
  /** Re-check cancellation or authority after queueing, before the first durable write. */
  beforeWrite?: () => void | Promise<void>;
}
export type SchemaPageRef = WorkingSchemaPageRef;
export interface SchemaReadResult {
  schema: OrigamixPageSchema;
  revisionId: string;
}

const pageQueues = new Map<string, Promise<void>>();
const store = new WorkingSchemaStore();

export const discardInitializedPageSchema = (page: SchemaPageRef): Promise<void> =>
  store.removePage(page);

export const withSchemaPageQueue = async <T>(
  page: SchemaPageRef,
  action: () => Promise<T>,
): Promise<T> => {
  const key = `${page.projectPath}\0${page.pageId}`;
  const previous = pageQueues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  pageQueues.set(key, current);
  await previous;
  try {
    return await action();
  } finally {
    release();
    if (pageQueues.get(key) === current) pageQueues.delete(key);
  }
};

export const hashSchema = (schema: OrigamixPageSchema): string => {
  const normalize = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(normalize)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([key, item]) => [key, normalize(item)]),
          )
        : value;
  return createHash('sha256')
    .update(JSON.stringify(normalize(schema)))
    .digest('hex');
};
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
const validateSnapshot = (snapshot: RevisionSnapshot): void => {
  if (!snapshot.revisionId || hashSchema(snapshot.schema) !== snapshot.schemaHash)
    throw invalid('Revision 内容校验失败');
  const validation = validatePage(snapshot.schema);
  if (!validation.valid) throw invalid(validationMessage(validation));
};
const readWorking = async (page: SchemaPageRef): Promise<WorkingSchemaFile> => {
  const working = await store.readWorking(page);
  if (
    working.version !== 1 ||
    working.pageId !== page.pageId ||
    !working.revisionId ||
    !working.baselineHash
  )
    throw invalid('页面工作副本无效');
  return working;
};
const createRevisionSnapshot = (
  schema: OrigamixPageSchema,
  source: ChangeSet['source'],
  parentRevisionId: string | null,
  changeSet?: ChangeSet,
): RevisionSnapshot => {
  return {
    revisionId: `revision_${nanoid()}`,
    parentRevisionId,
    ...(changeSet
      ? { changeSetId: changeSet.changeSetId, changeSetHash: hashValue(changeSet) }
      : {}),
    source,
    createdAt: new Date().toISOString(),
    schemaHash: hashSchema(schema),
    schema,
  };
};
const hashValue = (value: unknown): string => {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
};
const writeReceipt = async (page: SchemaPageRef, snapshot: RevisionSnapshot): Promise<void> => {
  if (!snapshot.changeSetId) return;
  await store.writeReceipt(page, {
    changeSetId: snapshot.changeSetId,
    changeSetHash: snapshot.changeSetHash!,
    revisionId: snapshot.revisionId,
    schemaHash: snapshot.schemaHash,
  } satisfies ChangeSetReceipt);
};

const finishSnapshot = async (
  page: SchemaPageRef,
  snapshot: RevisionSnapshot,
  options: SchemaWriteOptions,
): Promise<SchemaReadResult> => {
  await store.writeJournal(page, {
    version: 1,
    pageId: page.pageId,
    previousRevisionId: snapshot.parentRevisionId,
    targetRevisionId: snapshot.revisionId,
    ...(snapshot.changeSetId ? { changeSetId: snapshot.changeSetId } : {}),
    createdAt: snapshot.createdAt,
  } satisfies CommitJournal);
  await options.afterStage?.('prepared');
  await store.writeRevision(page, snapshot);
  await options.afterStage?.('revision');
  const previous = await store.readWorkingIfPresent(page);
  const baselineHash = previous?.baselineHash ?? hashSchema(snapshot.schema);
  await store.writeWorking(page, {
    version: 1,
    pageId: page.pageId,
    revisionId: snapshot.revisionId,
    baselineHash,
    schema: snapshot.schema,
  } satisfies WorkingSchemaFile);
  await options.afterStage?.('schema');
  await options.afterStage?.('meta');
  await writeReceipt(page, snapshot);
  await options.afterStage?.('receipt');
  await store.removeJournal(page);
  return { schema: snapshot.schema, revisionId: snapshot.revisionId };
};

const reconcileUnlocked = async (page: SchemaPageRef): Promise<void> => {
  const journal = await store.readJournal(page);
  if (journal) {
    if (journal.version !== 1 || journal.pageId !== page.pageId) throw invalid('页面恢复记录无效');
    const target = await store.readRevisionIfPresent(page, journal.targetRevisionId);
    if (target) {
      validateSnapshot(target);
      if (
        target.parentRevisionId !== journal.previousRevisionId ||
        target.changeSetId !== journal.changeSetId
      )
        throw invalid('页面恢复记录与 Revision 不匹配');
      const previous = await store.readWorkingIfPresent(page);
      await store.writeWorking(page, {
        version: 1,
        pageId: page.pageId,
        revisionId: target.revisionId,
        baselineHash: previous?.baselineHash ?? target.schemaHash,
        schema: target.schema,
      } satisfies WorkingSchemaFile);
      await writeReceipt(page, target);
    } else if (journal.previousRevisionId) {
      const previous = await store.readRevision(page, journal.previousRevisionId);
      validateSnapshot(previous);
      const working = await store.readWorkingIfPresent(page);
      await store.writeWorking(page, {
        version: 1,
        pageId: page.pageId,
        revisionId: previous.revisionId,
        baselineHash: working?.baselineHash ?? previous.schemaHash,
        schema: previous.schema,
      } satisfies WorkingSchemaFile);
    }
    await store.removeJournal(page);
  }

  const working = await store.readWorkingIfPresent(page);
  if (!working) return;
  const snapshot = await store.readRevision(page, working.revisionId);
  validateSnapshot(snapshot);
  if (hashSchema(working.schema) !== snapshot.schemaHash)
    throw invalid('页面工作副本与 Revision 不一致');
};

export const reconcilePageSchema = async (page: SchemaPageRef): Promise<void> => {
  return withSchemaPageQueue(page, () => reconcileUnlocked(page));
};

export const initializePageSchema = async (
  page: SchemaPageRef,
  schema: OrigamixPageSchema,
  options: SchemaWriteOptions = {},
): Promise<string> => {
  return withSchemaPageQueue(page, async () => {
    await reconcileUnlocked(page);
    await validateWritableSchema(page, schema);
    return (
      await finishSnapshot(
        page,
        createRevisionSnapshot(schema, { kind: 'user', actorId: 'system' }, null),
        options,
      )
    ).revisionId;
  });
};

const getSchemaUnlocked = async (page: SchemaPageRef): Promise<SchemaReadResult> => {
  await reconcileUnlocked(page);
  const working = await readWorking(page);
  const validation = validatePage(working.schema);
  if (!validation.valid) throw invalid(validationMessage(validation));
  return { schema: working.schema, revisionId: working.revisionId };
};
export const getSchema = async (page: SchemaPageRef): Promise<SchemaReadResult> => {
  return withSchemaPageQueue(page, () => getSchemaUnlocked(page));
};

export const getWorkingSchemaState = async (
  page: SchemaPageRef,
): Promise<SchemaReadResult & { baselineHash: string; schemaHash: string }> => {
  return withSchemaPageQueue(page, async () => {
    const current = await getSchemaUnlocked(page);
    const working = await readWorking(page);
    return {
      ...current,
      baselineHash: working.baselineHash,
      schemaHash: hashSchema(current.schema),
    };
  });
};

export const updateWorkingBaseline = async (
  page: SchemaPageRef,
  revisionId: string,
  baselineHash: string,
): Promise<void> => {
  return withSchemaPageQueue(page, async () => {
    const current = await getSchemaUnlocked(page);
    if (current.revisionId !== revisionId) throw conflict('页面已更新，请重新应用');
    const working = await readWorking(page);
    await store.writeWorking(page, { ...working, baselineHash });
  });
};

export const applyWorkingSchemaOperation = async <T>(
  page: SchemaPageRef,
  expectedRevisionId: string,
  operation: (
    current: SchemaReadResult & { baselineHash: string; schemaHash: string },
  ) => Promise<{ result: T; baselineHash: string }>,
): Promise<T> => {
  return withSchemaPageQueue(page, async () => {
    const current = await getSchemaUnlocked(page);
    if (current.revisionId !== expectedRevisionId) throw conflict('页面已更新，请重新应用');
    const working = await readWorking(page);
    const completed = await operation({
      ...current,
      baselineHash: working.baselineHash,
      schemaHash: hashSchema(current.schema),
    });
    await store.writeWorking(page, {
      ...working,
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
    await reconcileUnlocked(page);
    await validateWritableSchema(page, schema);
    const current = await getSchemaUnlocked(page);
    const updated = await finishSnapshot(
      page,
      createRevisionSnapshot(schema, { kind: 'user', actorId: 'system' }, current.revisionId),
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
const applyChangeSet = (schema: OrigamixPageSchema, changeSet: ChangeSet): OrigamixPageSchema => {
  if (changeSet.operation === 'replaceSchema') return changeSet.schema;
  const element = schema.elements[changeSet.elementId];
  if (!element) throw notFound('目标元素不存在');
  return {
    ...schema,
    elements: {
      ...schema.elements,
      [changeSet.elementId]: { ...element, props: { ...element.props, ...changeSet.props } },
    },
  };
};

export const commitSchema = async (
  page: SchemaPageRef,
  changeSet: ChangeSet,
  options: SchemaWriteOptions = {},
): Promise<SchemaReadResult> => {
  return withSchemaPageQueue(page, async () => {
    await reconcileUnlocked(page);
    if (!validateChangeSet(changeSet).valid) throw invalid('ChangeSet 格式无效');
    if (changeSet.pageId !== page.pageId) throw invalid('ChangeSet 页面不匹配');
    const receipt = await store.readReceipt(page, changeSet.changeSetId);
    if (receipt) {
      const snapshot = await store.readRevision(page, receipt.revisionId);
      validateSnapshot(snapshot);
      if (
        snapshot.changeSetId !== changeSet.changeSetId ||
        snapshot.schemaHash !== receipt.schemaHash ||
        snapshot.changeSetHash !== receipt.changeSetHash
      )
        throw invalid('ChangeSet 幂等记录无效');
      if (receipt.changeSetHash !== hashValue(changeSet))
        throw conflict('ChangeSet ID 已用于其他请求');
      return { schema: snapshot.schema, revisionId: snapshot.revisionId };
    }
    const current = await getSchemaUnlocked(page);
    if (changeSet.baseRevisionId !== current.revisionId)
      throw conflict('页面已更新，请重新加载后再提交');
    const candidate = applyChangeSet(current.schema, changeSet);
    await validateWritableSchema(page, candidate);
    await options.beforeWrite?.();
    return finishSnapshot(
      page,
      createRevisionSnapshot(candidate, changeSet.source, current.revisionId, changeSet),
      options,
    );
  });
};

export const undoSchema = async (
  page: SchemaPageRef,
  options: SchemaWriteOptions = {},
): Promise<SchemaReadResult> => {
  return withSchemaPageQueue(page, async () => {
    const current = await getSchemaUnlocked(page);
    const currentRevision = await store.readRevision(page, current.revisionId);
    if (!currentRevision.parentRevisionId) throw conflict('当前页面没有可撤销的 Revision');
    const parent = await store.readRevision(page, currentRevision.parentRevisionId);
    validateSnapshot(parent);
    return finishSnapshot(
      page,
      createRevisionSnapshot(
        parent.schema,
        { kind: 'undo', revisionId: current.revisionId },
        current.revisionId,
      ),
      options,
    );
  });
};

export const getSchemaRevision = async (
  page: SchemaPageRef,
  revisionId: string,
): Promise<SchemaReadResult> => {
  return withSchemaPageQueue(page, async () => {
    await reconcileUnlocked(page);
    const snapshot = await store.readRevision(page, revisionId);
    validateSnapshot(snapshot);
    if (snapshot.revisionId !== revisionId) throw invalid('页面 Revision 快照不匹配');
    return { schema: snapshot.schema, revisionId: snapshot.revisionId };
  });
};
