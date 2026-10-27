import type {
  SchemaWriteOptions,
  WorkingDraftWriteOptions,
  SchemaPageRef,
  SchemaReadResult,
  WorkingSchemaReadResult,
} from './schema-contracts';
import {
  SchemaValidationError,
  validationMessage,
  validateWritableSchema,
} from './validation/schema-validation';
import { workingResult } from './working-schema-result';
import { assertProjectNotUpgrading } from '../projects/project-upgrade-store';
import { ORIGAMIX_VERSION } from '@origamix/shared';
import { transformSchema, schemaVersionOf } from './schema-migrations';
import { readTargetSchema } from './target-schema-reader';
import { KeyedQueue } from '../infrastructure/keyed-queue';
import { RevisionCommit, createRevisionSnapshot, validateSnapshot } from './revision-commit';
import { hashSchema } from './schema-hash';
import {
  type OrigamixPageSchema,
  type SchemaOperation,
  type RevisionHistory,
  validatePage,
} from '@origamix/shared';

import { conflict, invalid } from '../errors';
import {
  WorkingSchemaStore,
  type AgentWorkingCommitReceipt,
  type WorkingSchemaFile,
} from './working-schema-store';
import { applySchemaOperationBatch, SchemaOperationError } from './schema-operation-engine';

// One process-wide page queue is shared by reads, Working writes, revisions and Apply.
const pageQueue = new KeyedQueue();
const store = new WorkingSchemaStore();
const commits = new RevisionCommit(store);

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
    await assertProjectNotUpgrading(page.projectPath);
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
  if (!(await store.readWorkingIfPresent(page))) {
    // Import the original checkpoint lazily. Preserve its hash as the target baseline.
    const original = await readTargetSchema(page);
    const candidate = transformSchema(original);
    await validateWritableSchema(page, candidate);
    await assertProjectNotUpgrading(page.projectPath);
    await commits.commit(
      page,
      createRevisionSnapshot(original, { kind: 'user', actorId: 'system' }, null),
      {},
    );
  }
  const working = await readWorking(page);
  if (schemaVersionOf(working.schema) !== ORIGAMIX_VERSION) {
    const candidate = transformSchema(working.schema);
    await validateWritableSchema(page, candidate);
    await writeWorkingDraft(page, working, candidate, {
      migration: { from: schemaVersionOf(working.schema), to: ORIGAMIX_VERSION },
    });
    return readWorking(page);
  }
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
      ...(current.migration ? { migration: current.migration } : {}),
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
      ...(current.migration ? { migration: current.migration } : {}),
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
    const candidate = transformSchema(schema);
    await validateWritableSchema(page, candidate);
    const current = await getSchemaUnlocked(page);
    await assertProjectNotUpgrading(page.projectPath);
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
    if (schemaVersionOf(schema) !== ORIGAMIX_VERSION) {
      const migrated = await writeWorkingDraft(page, await readWorking(page), candidate);
      return { schema: migrated.schema, revisionId: migrated.revisionId };
    }
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

const writeWorkingDraft = async (
  page: SchemaPageRef,
  current: WorkingSchemaFile,
  schema: OrigamixPageSchema,
  options: WorkingDraftWriteOptions = {},
): Promise<WorkingSchemaReadResult> => {
  await assertProjectNotUpgrading(page.projectPath);
  const durableSchema = structuredClone(schema);
  const workingHash = hashSchema(durableSchema);
  const updated: WorkingSchemaFile =
    workingHash === current.workingHash
      ? current
      : {
          ...current,
          ...(options.migration ? { migration: options.migration } : {}),
          workingVersion: current.workingVersion + 1,
          workingHash,
          updatedAt: new Date().toISOString(),
          schema: durableSchema,
        };
  let receipt: AgentWorkingCommitReceipt | undefined;
  if (options.agentCommit) {
    receipt = {
      version: 1,
      state: 'prepared',
      runId: options.agentCommit.runId,
      projectId: options.agentCommit.projectId,
      pageId: page.pageId,
      baseWorkingVersion: current.workingVersion,
      resultWorkingVersion: updated.workingVersion,
      resultWorkingHash: updated.workingHash,
      operationDigest: options.agentCommit.operationDigest,
      preparedAt: new Date().toISOString(),
    };
    await store.writeAgentCommit(page, receipt);
    await options.afterWorkingStage?.('receipt_prepared');
  }
  if (updated !== current) await store.writeWorking(page, updated);
  await options.afterWorkingStage?.('working');
  if (receipt) {
    await store.writeAgentCommit(page, {
      ...receipt,
      state: 'committed',
      committedAt: new Date().toISOString(),
    });
    await options.afterWorkingStage?.('receipt_committed');
  }
  return workingResult(updated);
};

export const getAgentWorkingCommitReceipt = async (
  page: SchemaPageRef,
  runId: string,
): Promise<AgentWorkingCommitReceipt | undefined> =>
  withSchemaPageQueue(page, () => store.readAgentCommit(page, runId));

export const updateWorkingSchema = async (
  page: SchemaPageRef,
  input: {
    baseWorkingVersion: number;
    schema: OrigamixPageSchema;
  },
  options: WorkingDraftWriteOptions = {},
): Promise<WorkingSchemaReadResult> => {
  return withSchemaPageQueue(page, async () => {
    const current = await getSchemaUnlocked(page);
    if (current.workingVersion !== input.baseWorkingVersion)
      throw conflict('页面草稿已更新，请重新加载后再提交');
    await validateWritableSchema(page, input.schema);
    await options.beforeWrite?.();
    return writeWorkingDraft(page, current, input.schema, options);
  });
};

export const applyWorkingSchemaOperations = async (
  page: SchemaPageRef,
  input: {
    baseWorkingVersion: number;
    operations: readonly SchemaOperation[];
  },
  options: WorkingDraftWriteOptions = {},
): Promise<WorkingSchemaReadResult> => {
  return withSchemaPageQueue(page, async () => {
    const current = await getSchemaUnlocked(page);
    if (current.workingVersion !== input.baseWorkingVersion)
      throw conflict('页面草稿已更新，请重新加载后再提交');
    let candidate: OrigamixPageSchema;
    try {
      candidate = applySchemaOperationBatch(current.schema, input.operations).schema;
    } catch (error) {
      if (error instanceof SchemaOperationError)
        throw new SchemaValidationError({
          code: error.code,
          path: error.path ?? `/operations/${error.operationIndex}`,
          message: error.message,
          ...(error.path ? {} : { operationIndex: error.operationIndex }),
        });
      throw error;
    }
    // Agent completion must produce executable changes, while unrelated editor drafts survive.
    const executableFlowIds = options.agentCommit
      ? new Set(
          input.operations.flatMap((operation) =>
            operation.operation === 'addFlow' ||
            operation.operation === 'updateFlow' ||
            operation.operation === 'setElementEventBinding'
              ? [operation.flowId]
              : [],
          ),
        )
      : undefined;
    if (executableFlowIds) {
      const bindingKey = (binding: OrigamixPageSchema['bindElements'][number]): string =>
        JSON.stringify([binding.id, binding.event, binding.flowId]);
      const previousBindings = new Set(current.schema.bindElements.map(bindingKey));
      for (const binding of candidate.bindElements)
        if (!previousBindings.has(bindingKey(binding))) executableFlowIds.add(binding.flowId);
    }
    await validateWritableSchema(page, candidate, executableFlowIds);
    await options.beforeWrite?.();
    return writeWorkingDraft(page, current, candidate, options);
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
    await assertProjectNotUpgrading(page.projectPath);
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
    if (snapshot.revisionId !== revisionId) throw invalid('页面 Revision 快照不匹配');
    const candidate = transformSchema(snapshot.schema);
    await validateWritableSchema(page, candidate);
    return writeWorkingDraft(page, current, candidate);
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

/** Startup recovery reads durable commit evidence without opening or upgrading a page. */
export const getRetainedWorkingSchemaState = (
  page: SchemaPageRef,
): Promise<WorkingSchemaReadResult> =>
  withSchemaPageQueue(page, async () => {
    await commits.recover(page);
    return workingResult(await readWorking(page));
  });
