import type {
  SchemaWriteOptions,
  WorkingDraftWriteOptions,
  SchemaPageRef,
  SchemaReadResult,
  WorkingSchemaReadResult,
} from './schema-contracts';
import { SchemaValidationError, validateWritableSchema } from './validation/schema-validation';
import { workingResult } from './working-schema-result';
import { assertPageNotDeleting } from '../projects/page-deletion-store';
import { withProjectActivity } from '../projects/project-activity';
import { ProjectManifestStore } from '../projects/project-manifest-store';
import { requireCompatibleSchema } from './schema-compatibility';
import { readTargetSchema } from './target-schema-reader';
import { KeyedQueue } from '../infrastructure/keyed-queue';
import { RevisionCommit, createRevisionSnapshot, validateSnapshot } from './revision-commit';
import { hashSchema } from './schema-hash';
import {
  type OrigamixPageSchema,
  type SchemaOperation,
  type RevisionHistory,
} from '@origamix/shared';

import { conflict, invalid, notFound } from '../errors';
import {
  WORKING_SCHEMA_FILE_VERSION,
  type AgentWorkingCommitReceipt,
  type WorkingSchemaFile,
} from './schema-storage';
import { WorkingSchemaStore } from './working-schema-store';
import { applySchemaOperationBatch, SchemaOperationError } from './schema-operation-engine';

// One process-wide page queue is shared by reads, Working writes, revisions and Apply.
const pageQueue = new KeyedQueue();
const fileStore = new WorkingSchemaStore();
const fileCommits = new RevisionCommit(fileStore);
const storeFor = (page: SchemaPageRef) => page.persistence?.store ?? fileStore;
const commitsFor = (page: SchemaPageRef) =>
  page.persistence ? new RevisionCommit(page.persistence.store) : fileCommits;

const withSchemaPageQueue = <T>(
  page: SchemaPageRef,
  action: (page: SchemaPageRef) => Promise<T>,
): Promise<T> => {
  if (page.withPersistence)
    return page.withPersistence((persistence) => action({ ...page, persistence }));
  if (page.persistence) return action(page);
  return withProjectActivity(page.projectPath, () =>
    pageQueue.run(`${page.projectPath}\0${page.pageId}`, async () => {
      await assertPageNotDeleting(page.projectPath, page.pageId);
      return action(page);
    }),
  );
};

export const listRevisionHistory = async (page: SchemaPageRef): Promise<RevisionHistory> => {
  return withSchemaPageQueue(page, async (page) => {
    await commitsFor(page).recover(page);
    const working = await getSchemaUnlocked(page);
    const snapshots = await storeFor(page).listRevisions(page);
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
          isApplied: !page.persistence && snapshot.schemaHash === working.baselineHash,
        })),
    };
  });
};

export const discardInitializedPageSchema = (page: SchemaPageRef): Promise<void> =>
  page.persistence || page.withPersistence
    ? withSchemaPageQueue(page, (page) => storeFor(page).removePage(page))
    : pageQueue.run(`${page.projectPath}\0${page.pageId}`, () => fileStore.removePage(page));

const readWorking = async (page: SchemaPageRef): Promise<WorkingSchemaFile> => {
  const working = await storeFor(page).readWorking(page);
  if (
    working.version !== WORKING_SCHEMA_FILE_VERSION ||
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
  return withSchemaPageQueue(page, async (page) => {
    await commitsFor(page).recover(page);
    await validateWritableSchema(page, schema);
    return (
      await commitsFor(page).commit(
        page,
        createRevisionSnapshot(schema, { kind: 'user', actorId: 'system' }, null),
        options,
      )
    ).revisionId;
  });
};

const getSchemaUnlocked = async (page: SchemaPageRef): Promise<WorkingSchemaFile> => {
  if (!page.persistence) await new ProjectManifestStore().requireEditable(page.projectPath);
  await commitsFor(page).recover(page);
  if (!(await storeFor(page).readWorkingIfPresent(page))) {
    if (page.persistence) throw notFound('页面工作副本不存在');
    // Import the original checkpoint lazily. Preserve its hash as the target baseline.
    const original = await readTargetSchema(page);
    const candidate = requireCompatibleSchema(original);
    await validateWritableSchema(page, candidate);
    await commitsFor(page).commit(
      page,
      createRevisionSnapshot(original, { kind: 'user', actorId: 'system' }, null),
      {},
    );
  }
  const working = await readWorking(page);
  requireCompatibleSchema(working.schema);
  return working;
};
export const getSchema = async (page: SchemaPageRef): Promise<SchemaReadResult> => {
  return withSchemaPageQueue(page, async (page) => {
    const { schema, lastSavedRevisionId } = await getSchemaUnlocked(page);
    return { schema, revisionId: lastSavedRevisionId };
  });
};

export const getWorkingSchemaState = async (
  page: SchemaPageRef,
): Promise<WorkingSchemaReadResult & { schemaHash: string }> => {
  return withSchemaPageQueue(page, async (page) => {
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
  return withSchemaPageQueue(page, async (page) => {
    const current = await getSchemaUnlocked(page);
    if (current.workingVersion !== expectedWorkingVersion)
      throw conflict('页面草稿已更新，请重新应用');
    await storeFor(page).writeWorking(page, { ...current, baselineHash });
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
  return withSchemaPageQueue(page, async (page) => {
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
    await storeFor(page).writeWorking(page, {
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
  return withSchemaPageQueue(page, async (page) => {
    await commitsFor(page).recover(page);
    const candidate = requireCompatibleSchema(schema);
    await validateWritableSchema(page, candidate);
    const current = await getSchemaUnlocked(page);
    const updated = await commitsFor(page).commit(
      page,
      createRevisionSnapshot(
        schema,
        { kind: 'user', actorId: 'system' },
        current.lastSavedRevisionId,
      ),
      {},
    );
    const working = await readWorking(page);
    await storeFor(page).writeWorking(page, {
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
  return withSchemaPageQueue(page, async (page) => {
    try {
      const snapshot = await storeFor(page).readRevision(page, revisionId);
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
  const durableSchema = structuredClone(schema);
  const workingHash = hashSchema(durableSchema);
  const updated: WorkingSchemaFile =
    workingHash === current.workingHash
      ? current
      : {
          ...current,
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
    await storeFor(page).writeAgentCommit(page, receipt);
    await options.afterWorkingStage?.('receipt_prepared');
  }
  if (updated !== current) await storeFor(page).writeWorking(page, updated);
  await options.afterWorkingStage?.('working');
  if (receipt) {
    await storeFor(page).writeAgentCommit(page, {
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
  withSchemaPageQueue(page, (page) => storeFor(page).readAgentCommit(page, runId));

export const getAgentWorkingCommitEvidence = (page: SchemaPageRef, runId: string) =>
  withSchemaPageQueue(page, async (page) => {
    const receipt = await storeFor(page).readAgentCommit(page, runId);
    if (!receipt) return undefined;
    await commitsFor(page).recover(page);
    return { receipt, working: await readWorking(page) };
  });

export const updateWorkingSchema = async (
  page: SchemaPageRef,
  input: {
    baseWorkingVersion: number;
    schema: OrigamixPageSchema;
  },
  options: WorkingDraftWriteOptions = {},
): Promise<WorkingSchemaReadResult> => {
  return withSchemaPageQueue(page, async (page) => {
    const current = await getSchemaUnlocked(page);
    if (current.workingVersion !== input.baseWorkingVersion)
      throw conflict('页面草稿已更新，请重新加载后再提交');
    await validateWritableSchema(page, input.schema);
    await options.beforeWrite?.();
    return writeWorkingDraft(page, current, input.schema, options);
  });
};

interface WorkingOperationInput {
  baseWorkingVersion: number;
  operations: readonly SchemaOperation[];
}

const prepareWorkingOperations = async (
  page: SchemaPageRef,
  current: WorkingSchemaFile,
  input: WorkingOperationInput,
  requireExecutableFlows: boolean,
): Promise<OrigamixPageSchema> => {
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
  const executableFlowIds = requireExecutableFlows
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
  return candidate;
};

/** Same candidate validation as Agent commit, with no candidate/receipt/Revision write. */
export const validateWorkingSchemaOperations = async (
  page: SchemaPageRef,
  input: WorkingOperationInput,
  validateCandidate?: WorkingDraftWriteOptions['validateCandidate'],
): Promise<void> =>
  withSchemaPageQueue(page, async (page) => {
    const current = await getSchemaUnlocked(page);
    if (current.workingVersion !== input.baseWorkingVersion)
      throw conflict('页面草稿已更新，请重新加载后再提交');
    const candidate = await prepareWorkingOperations(page, current, input, true);
    await validateCandidate?.(candidate);
  });

export const applyWorkingSchemaOperations = async (
  page: SchemaPageRef,
  input: {
    baseWorkingVersion: number;
    operations: readonly SchemaOperation[];
  },
  options: WorkingDraftWriteOptions = {},
): Promise<WorkingSchemaReadResult> => {
  return withSchemaPageQueue(page, async (page) => {
    const current = await getSchemaUnlocked(page);
    if (current.workingVersion !== input.baseWorkingVersion)
      throw conflict('页面草稿已更新，请重新加载后再提交');
    const candidate = await prepareWorkingOperations(
      page,
      current,
      input,
      Boolean(options.agentCommit),
    );
    await options.validateCandidate?.(candidate);
    await options.beforeWrite?.();
    return writeWorkingDraft(page, current, candidate, options);
  });
};

export const saveWorkingRevision = async (
  page: SchemaPageRef,
  expectedWorkingVersion: number,
  options: SchemaWriteOptions = {},
): Promise<WorkingSchemaReadResult> => {
  return withSchemaPageQueue(page, async (page) => {
    const current = await getSchemaUnlocked(page);
    if (current.workingVersion !== expectedWorkingVersion)
      throw conflict('页面草稿已更新，请重新保存');
    if (current.workingHash === current.savedSchemaHash) return workingResult(current);
    await options.beforeWrite?.();
    await commitsFor(page).commit(
      page,
      createRevisionSnapshot(current.schema, { kind: 'user' }, current.lastSavedRevisionId),
      options,
    );
    const retained = await readWorking(page);
    requireCompatibleSchema(retained.schema);
    return workingResult(retained);
  });
};

export const restoreRevisionToWorking = async (
  page: SchemaPageRef,
  revisionId: string,
  expectedWorkingVersion: number,
): Promise<WorkingSchemaReadResult> => {
  return withSchemaPageQueue(page, async (page) => {
    const current = await getSchemaUnlocked(page);
    if (current.workingVersion !== expectedWorkingVersion)
      throw conflict('页面草稿已更新，请重新恢复');
    const snapshot = await storeFor(page).readRevision(page, revisionId);
    validateSnapshot(snapshot);
    if (snapshot.revisionId !== revisionId) throw invalid('页面 Revision 快照不匹配');
    const candidate = requireCompatibleSchema(snapshot.schema);
    await validateWritableSchema(page, candidate);
    return writeWorkingDraft(page, current, candidate);
  });
};
export const getSchemaRevision = async (
  page: SchemaPageRef,
  revisionId: string,
): Promise<SchemaReadResult> => {
  return withSchemaPageQueue(page, async (page) => {
    await commitsFor(page).recover(page);
    const snapshot = await storeFor(page).readRevision(page, revisionId);
    validateSnapshot(snapshot);
    if (snapshot.revisionId !== revisionId) throw invalid('页面 Revision 快照不匹配');
    return { schema: snapshot.schema, revisionId: snapshot.revisionId };
  });
};

/** Startup recovery reads durable commit evidence without initializing Working. */
export const getRetainedWorkingSchemaState = (
  page: SchemaPageRef,
): Promise<WorkingSchemaReadResult> =>
  withSchemaPageQueue(page, async (page) => {
    await commitsFor(page).recover(page);
    return workingResult(await readWorking(page));
  });
