import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import type { ChangeSet, OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { validateChangeSet, validatePage } from '@origamix/shared/protocol/validation';
import { conflict, invalid, notFound } from '../errors';
import { validateProjectPageAgainstMaterials } from './schema-material-validation';

interface WorkingSchemaFile {
  version: 1;
  pageId: string;
  revisionId: string;
  baselineHash: string;
  schema: OrigamixPageSchema;
}
interface RevisionSnapshot {
  revisionId: string;
  parentRevisionId: string | null;
  changeSetId?: string;
  changeSetHash?: string;
  source: ChangeSet['source'];
  createdAt: string;
  schemaHash: string;
  schema: OrigamixPageSchema;
}
interface CommitJournal {
  version: 1;
  pageId: string;
  previousRevisionId: string | null;
  targetRevisionId: string;
  changeSetId?: string;
  createdAt: string;
}
interface ChangeSetReceipt {
  changeSetId: string;
  changeSetHash: string;
  revisionId: string;
  schemaHash: string;
}

export type SchemaWriteStage = 'prepared' | 'revision' | 'schema' | 'meta' | 'receipt';
export interface SchemaWriteOptions {
  /** Test/host hook used to simulate interruption after a durable write stage. */
  afterStage?: (stage: SchemaWriteStage) => void | Promise<void>;
  /** Re-check cancellation or authority after queueing, before the first durable write. */
  beforeWrite?: () => void | Promise<void>;
}
export interface SchemaPageRef {
  projectPath: string;
  pageId: string;
  slug: string;
}
export interface SchemaReadResult {
  schema: OrigamixPageSchema;
  revisionId: string;
}

const pageQueues = new Map<string, Promise<void>>();

export async function withSchemaPageQueue<T>(
  page: SchemaPageRef,
  action: () => Promise<T>,
): Promise<T> {
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
}

async function writeJsonAtomically(path: string, value: unknown): Promise<void> {
  const temporaryPath = `${path}.${nanoid()}.tmp`;
  const handle = await open(temporaryPath, 'w', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

function pageDirectory(page: SchemaPageRef): string {
  return join(page.projectPath, 'src', 'pages', page.slug);
}
function schemaFile(page: SchemaPageRef): string {
  return join(pageDirectory(page), 'schema.json');
}
function workingDirectory(page: SchemaPageRef): string {
  return join(page.projectPath, '.origamix', 'pages', page.pageId);
}
function workingFile(page: SchemaPageRef): string {
  return join(workingDirectory(page), 'working.json');
}
function revisionsDirectory(page: SchemaPageRef): string {
  return join(page.projectPath, '.origamix', 'revisions', page.pageId);
}
function revisionFile(page: SchemaPageRef, revisionId: string): string {
  return join(revisionsDirectory(page), `${revisionId}.json`);
}
function transactionDirectory(page: SchemaPageRef): string {
  return join(page.projectPath, '.origamix', 'transactions');
}
function journalFile(page: SchemaPageRef): string {
  return join(transactionDirectory(page), `${page.pageId}.json`);
}
function receiptDirectory(page: SchemaPageRef): string {
  return join(page.projectPath, '.origamix', 'changesets', page.pageId);
}
function receiptFile(page: SchemaPageRef, changeSetId: string): string {
  return join(receiptDirectory(page), `${changeSetId}.json`);
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}
async function readJsonIfPresent<T>(path: string): Promise<T | undefined> {
  try {
    return await readJson<T>(path);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}
export function hashSchema(schema: OrigamixPageSchema): string {
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
}
function validationMessage(result: ReturnType<typeof validatePage>): string {
  return result.semanticErrors[0]?.message ?? result.errors[0]?.message ?? 'Schema 校验失败';
}
async function validateWritableSchema(
  page: SchemaPageRef,
  schema: OrigamixPageSchema,
): Promise<void> {
  const structural = validatePage(schema);
  if (!structural.valid) throw invalid(validationMessage(structural));
  const material = await validateProjectPageAgainstMaterials(page.projectPath, schema);
  if (!material.valid) {
    const first = material.errors[0]!;
    throw invalid(`${first.code} at ${first.path}: ${first.message}`);
  }
}
function validateSnapshot(snapshot: RevisionSnapshot): void {
  if (!snapshot.revisionId || hashSchema(snapshot.schema) !== snapshot.schemaHash)
    throw invalid('Revision 内容校验失败');
  const validation = validatePage(snapshot.schema);
  if (!validation.valid) throw invalid(validationMessage(validation));
}
async function readWorking(page: SchemaPageRef): Promise<WorkingSchemaFile> {
  const working = await readJson<WorkingSchemaFile>(workingFile(page));
  if (
    working.version !== 1 ||
    working.pageId !== page.pageId ||
    !working.revisionId ||
    !working.baselineHash
  )
    throw invalid('页面工作副本无效');
  return working;
}
function createRevisionSnapshot(
  schema: OrigamixPageSchema,
  source: ChangeSet['source'],
  parentRevisionId: string | null,
  changeSet?: ChangeSet,
): RevisionSnapshot {
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
}
function hashValue(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
async function writeReceipt(page: SchemaPageRef, snapshot: RevisionSnapshot): Promise<void> {
  if (!snapshot.changeSetId) return;
  await mkdir(receiptDirectory(page), { recursive: true });
  await writeJsonAtomically(receiptFile(page, snapshot.changeSetId), {
    changeSetId: snapshot.changeSetId,
    changeSetHash: snapshot.changeSetHash!,
    revisionId: snapshot.revisionId,
    schemaHash: snapshot.schemaHash,
  } satisfies ChangeSetReceipt);
}

async function finishSnapshot(
  page: SchemaPageRef,
  snapshot: RevisionSnapshot,
  options: SchemaWriteOptions,
): Promise<SchemaReadResult> {
  await mkdir(transactionDirectory(page), { recursive: true });
  await writeJsonAtomically(journalFile(page), {
    version: 1,
    pageId: page.pageId,
    previousRevisionId: snapshot.parentRevisionId,
    targetRevisionId: snapshot.revisionId,
    ...(snapshot.changeSetId ? { changeSetId: snapshot.changeSetId } : {}),
    createdAt: snapshot.createdAt,
  } satisfies CommitJournal);
  await options.afterStage?.('prepared');
  await mkdir(revisionsDirectory(page), { recursive: true });
  await writeJsonAtomically(revisionFile(page, snapshot.revisionId), snapshot);
  await options.afterStage?.('revision');
  const previous = await readJsonIfPresent<WorkingSchemaFile>(workingFile(page));
  const baselineHash = previous?.baselineHash ?? hashSchema(snapshot.schema);
  await mkdir(workingDirectory(page), { recursive: true });
  await writeJsonAtomically(workingFile(page), {
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
  await rm(journalFile(page), { force: true });
  return { schema: snapshot.schema, revisionId: snapshot.revisionId };
}

async function reconcileUnlocked(page: SchemaPageRef): Promise<void> {
  const journal = await readJsonIfPresent<CommitJournal>(journalFile(page));
  if (journal) {
    if (journal.version !== 1 || journal.pageId !== page.pageId) throw invalid('页面恢复记录无效');
    const target = await readJsonIfPresent<RevisionSnapshot>(
      revisionFile(page, journal.targetRevisionId),
    );
    if (target) {
      validateSnapshot(target);
      if (
        target.parentRevisionId !== journal.previousRevisionId ||
        target.changeSetId !== journal.changeSetId
      )
        throw invalid('页面恢复记录与 Revision 不匹配');
      const previous = await readJsonIfPresent<WorkingSchemaFile>(workingFile(page));
      await mkdir(workingDirectory(page), { recursive: true });
      await writeJsonAtomically(workingFile(page), {
        version: 1,
        pageId: page.pageId,
        revisionId: target.revisionId,
        baselineHash: previous?.baselineHash ?? target.schemaHash,
        schema: target.schema,
      } satisfies WorkingSchemaFile);
      await writeReceipt(page, target);
    } else if (journal.previousRevisionId) {
      const previous = await readJson<RevisionSnapshot>(
        revisionFile(page, journal.previousRevisionId),
      );
      validateSnapshot(previous);
      const working = await readJsonIfPresent<WorkingSchemaFile>(workingFile(page));
      await mkdir(workingDirectory(page), { recursive: true });
      await writeJsonAtomically(workingFile(page), {
        version: 1,
        pageId: page.pageId,
        revisionId: previous.revisionId,
        baselineHash: working?.baselineHash ?? previous.schemaHash,
        schema: previous.schema,
      } satisfies WorkingSchemaFile);
    }
    await rm(journalFile(page), { force: true });
  }

  const working = await readJsonIfPresent<WorkingSchemaFile>(workingFile(page));
  if (!working) return;
  const snapshot = await readJson<RevisionSnapshot>(revisionFile(page, working.revisionId));
  validateSnapshot(snapshot);
  if (hashSchema(working.schema) !== snapshot.schemaHash)
    throw invalid('页面工作副本与 Revision 不一致');
}

export async function reconcilePageSchema(page: SchemaPageRef): Promise<void> {
  return withSchemaPageQueue(page, () => reconcileUnlocked(page));
}

export async function initializePageSchema(
  page: SchemaPageRef,
  schema: OrigamixPageSchema,
  options: SchemaWriteOptions = {},
): Promise<string> {
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
}

async function getSchemaUnlocked(page: SchemaPageRef): Promise<SchemaReadResult> {
  await reconcileUnlocked(page);
  const working = await readWorking(page);
  const validation = validatePage(working.schema);
  if (!validation.valid) throw invalid(validationMessage(validation));
  return { schema: working.schema, revisionId: working.revisionId };
}
export async function getSchema(page: SchemaPageRef): Promise<SchemaReadResult> {
  return withSchemaPageQueue(page, () => getSchemaUnlocked(page));
}

export async function getWorkingSchemaState(
  page: SchemaPageRef,
): Promise<SchemaReadResult & { baselineHash: string; schemaHash: string }> {
  return withSchemaPageQueue(page, async () => {
    const current = await getSchemaUnlocked(page);
    const working = await readWorking(page);
    return {
      ...current,
      baselineHash: working.baselineHash,
      schemaHash: hashSchema(current.schema),
    };
  });
}

export async function updateWorkingBaseline(
  page: SchemaPageRef,
  revisionId: string,
  baselineHash: string,
): Promise<void> {
  return withSchemaPageQueue(page, async () => {
    const current = await getSchemaUnlocked(page);
    if (current.revisionId !== revisionId) throw conflict('页面已更新，请重新应用');
    const working = await readWorking(page);
    await writeJsonAtomically(workingFile(page), { ...working, baselineHash });
  });
}

export async function applyWorkingSchemaOperation<T>(
  page: SchemaPageRef,
  expectedRevisionId: string,
  operation: (
    current: SchemaReadResult & { baselineHash: string; schemaHash: string },
  ) => Promise<{ result: T; baselineHash: string }>,
): Promise<T> {
  return withSchemaPageQueue(page, async () => {
    const current = await getSchemaUnlocked(page);
    if (current.revisionId !== expectedRevisionId) throw conflict('页面已更新，请重新应用');
    const working = await readWorking(page);
    const completed = await operation({
      ...current,
      baselineHash: working.baselineHash,
      schemaHash: hashSchema(current.schema),
    });
    await writeJsonAtomically(workingFile(page), {
      ...working,
      baselineHash: completed.baselineHash,
    });
    return completed.result;
  });
}

export async function synchronizeWorkingSchemaFromTarget(page: SchemaPageRef): Promise<void> {
  return withSchemaPageQueue(page, async () => {
    const current = await getSchemaUnlocked(page);
    const working = await readWorking(page);
    const target = await readJson<OrigamixPageSchema>(schemaFile(page));
    const targetHash = hashSchema(target);
    const workingHash = hashSchema(current.schema);
    if (targetHash === workingHash) {
      if (working.baselineHash !== targetHash)
        await writeJsonAtomically(workingFile(page), { ...working, baselineHash: targetHash });
      return;
    }
    if (workingHash !== working.baselineHash) return;
    await validateWritableSchema(page, target);
    const updated = await finishSnapshot(
      page,
      createRevisionSnapshot(target, { kind: 'user', actorId: 'system' }, current.revisionId),
      {},
    );
    const next = await readWorking(page);
    await writeJsonAtomically(workingFile(page), {
      ...next,
      revisionId: updated.revisionId,
      baselineHash: targetHash,
    });
  });
}

export async function hasValidRevision(page: SchemaPageRef, revisionId: string): Promise<boolean> {
  return withSchemaPageQueue(page, async () => {
    try {
      const snapshot = await readJson<RevisionSnapshot>(revisionFile(page, revisionId));
      validateSnapshot(snapshot);
      return snapshot.revisionId === revisionId;
    } catch {
      return false;
    }
  });
}
function applyChangeSet(schema: OrigamixPageSchema, changeSet: ChangeSet): OrigamixPageSchema {
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
}

export async function commitSchema(
  page: SchemaPageRef,
  changeSet: ChangeSet,
  options: SchemaWriteOptions = {},
): Promise<SchemaReadResult> {
  return withSchemaPageQueue(page, async () => {
    await reconcileUnlocked(page);
    if (!validateChangeSet(changeSet).valid) throw invalid('ChangeSet 格式无效');
    if (changeSet.pageId !== page.pageId) throw invalid('ChangeSet 页面不匹配');
    const receipt = await readJsonIfPresent<ChangeSetReceipt>(
      receiptFile(page, changeSet.changeSetId),
    );
    if (receipt) {
      const snapshot = await readJson<RevisionSnapshot>(revisionFile(page, receipt.revisionId));
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
}

export async function undoSchema(
  page: SchemaPageRef,
  options: SchemaWriteOptions = {},
): Promise<SchemaReadResult> {
  return withSchemaPageQueue(page, async () => {
    const current = await getSchemaUnlocked(page);
    const currentRevision = await readJson<RevisionSnapshot>(
      revisionFile(page, current.revisionId),
    );
    if (!currentRevision.parentRevisionId) throw conflict('当前页面没有可撤销的 Revision');
    const parent = await readJson<RevisionSnapshot>(
      revisionFile(page, currentRevision.parentRevisionId),
    );
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
}

export async function getSchemaRevision(
  page: SchemaPageRef,
  revisionId: string,
): Promise<SchemaReadResult> {
  return withSchemaPageQueue(page, async () => {
    await reconcileUnlocked(page);
    const snapshot = await readJson<RevisionSnapshot>(revisionFile(page, revisionId));
    validateSnapshot(snapshot);
    if (snapshot.revisionId !== revisionId) throw invalid('页面 Revision 快照不匹配');
    return { schema: snapshot.schema, revisionId: snapshot.revisionId };
  });
}
