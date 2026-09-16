import { KeyedQueue } from '../infrastructure/keyed-queue';
import {
  SchemaCommit,
  createRevisionSnapshot,
  validateSnapshot,
  type SchemaCommitOptions,
} from './schema-commit';
import { hashSchema, hashValue } from './schema-hash';
import type { ChangeSet, OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { validateChangeSet, validatePage } from '@origamix/shared/protocol/validation';
import { conflict, invalid, notFound } from '../errors';
import { validateProjectPageAgainstMaterials } from './material-validation';
import {
  WorkingSchemaStore,
  type WorkingSchemaFile,
  type WorkingSchemaPageRef,
} from './working-schema-store';

export interface SchemaWriteOptions extends SchemaCommitOptions {
  /** Re-check cancellation or authority after queueing, before the first durable write. */
  beforeWrite?: () => void | Promise<void>;
}
export type SchemaPageRef = WorkingSchemaPageRef;
export interface SchemaReadResult {
  schema: OrigamixPageSchema;
  revisionId: string;
}

// One process-wide page queue is shared by reads, commits, undo and Apply.
const pageQueue = new KeyedQueue();
const store = new WorkingSchemaStore();
const commits = new SchemaCommit(store);

const withSchemaPageQueue = <T>(page: SchemaPageRef, action: () => Promise<T>): Promise<T> =>
  pageQueue.run(`${page.projectPath}\0${page.pageId}`, action);

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
    working.version !== 1 ||
    working.pageId !== page.pageId ||
    !working.revisionId ||
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
    const { schema, revisionId } = await getSchemaUnlocked(page);
    return { schema, revisionId };
  });
};

export const getWorkingSchemaState = async (
  page: SchemaPageRef,
): Promise<SchemaReadResult & { baselineHash: string; schemaHash: string }> => {
  return withSchemaPageQueue(page, async () => {
    const current = await getSchemaUnlocked(page);
    return {
      schema: current.schema,
      revisionId: current.revisionId,
      baselineHash: current.baselineHash,
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
    await store.writeWorking(page, { ...current, baselineHash });
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
    const completed = await operation({
      schema: current.schema,
      revisionId: current.revisionId,
      baselineHash: current.baselineHash,
      schemaHash: hashSchema(current.schema),
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
    await commits.recover(page);
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
    return commits.commit(
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
    return commits.commit(
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
    await commits.recover(page);
    const snapshot = await store.readRevision(page, revisionId);
    validateSnapshot(snapshot);
    if (snapshot.revisionId !== revisionId) throw invalid('页面 Revision 快照不匹配');
    return { schema: snapshot.schema, revisionId: snapshot.revisionId };
  });
};
