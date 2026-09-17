import { nanoid } from 'nanoid';
import type { ChangeSet, OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { validatePage } from '@origamix/shared/protocol/validation';
import { invalid } from '../errors';
import { hashSchema, hashValue } from './schema-hash';
import type {
  WorkingSchemaStore,
  WorkingSchemaPageRef,
  RevisionSnapshot,
  CommitJournal,
  ChangeSetReceipt,
  StoredWorkingSchemaFile,
  WorkingSchemaFile,
} from './working-schema-store';

export type SchemaWriteStage = 'prepared' | 'revision' | 'schema' | 'receipt';
export interface SchemaCommitOptions {
  /** Test/host hook used to simulate interruption after a durable write stage. */
  afterStage?: (stage: SchemaWriteStage) => void | Promise<void>;
}

export const validateSnapshot = (snapshot: RevisionSnapshot): void => {
  if (!snapshot.revisionId || hashSchema(snapshot.schema) !== snapshot.schemaHash)
    throw invalid('Revision 内容校验失败');
  const validation = validatePage(snapshot.schema);
  if (!validation.valid)
    throw invalid(
      validation.semanticErrors[0]?.message ?? validation.errors[0]?.message ?? 'Schema 校验失败',
    );
};
export const createRevisionSnapshot = (
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

const toWorkingV2 = (
  page: WorkingSchemaPageRef,
  working: StoredWorkingSchemaFile,
): WorkingSchemaFile => {
  if (working.version !== 1 && working.version !== 2) throw invalid('页面工作副本版本无效');
  if (working.pageId !== page.pageId) throw invalid('页面工作副本归属无效');
  if (working.version === 2) return working;
  const schemaHash = hashSchema(working.schema);
  return {
    version: 2,
    pageId: page.pageId,
    workingVersion: 1,
    workingHash: schemaHash,
    lastSavedRevisionId: working.revisionId,
    savedSchemaHash: schemaHash,
    baselineHash: working.baselineHash,
    updatedAt: new Date().toISOString(),
    schema: working.schema,
  };
};

const workingAtSnapshot = (
  page: WorkingSchemaPageRef,
  previous: WorkingSchemaFile | undefined,
  snapshot: RevisionSnapshot,
): WorkingSchemaFile => {
  if (
    previous?.lastSavedRevisionId === snapshot.revisionId &&
    previous.workingHash === snapshot.schemaHash &&
    previous.savedSchemaHash === snapshot.schemaHash
  )
    return previous;
  return {
    version: 2,
    pageId: page.pageId,
    workingVersion: (previous?.workingVersion ?? 0) + 1,
    workingHash: snapshot.schemaHash,
    lastSavedRevisionId: snapshot.revisionId,
    savedSchemaHash: snapshot.schemaHash,
    baselineHash: previous?.baselineHash ?? snapshot.schemaHash,
    updatedAt: new Date().toISOString(),
    schema: snapshot.schema,
  };
};

/** Internal commit/recovery protocol; callers must hold the page queue. */
export class SchemaCommit {
  constructor(private readonly store: WorkingSchemaStore) {}
  private async writeReceipt(
    page: WorkingSchemaPageRef,
    snapshot: RevisionSnapshot,
  ): Promise<void> {
    if (!snapshot.changeSetId) return;
    await this.store.writeReceipt(page, {
      changeSetId: snapshot.changeSetId,
      changeSetHash: snapshot.changeSetHash!,
      revisionId: snapshot.revisionId,
      schemaHash: snapshot.schemaHash,
    } satisfies ChangeSetReceipt);
  }

  async commit(
    page: WorkingSchemaPageRef,
    snapshot: RevisionSnapshot,
    options: SchemaCommitOptions,
  ): Promise<{ schema: OrigamixPageSchema; revisionId: string }> {
    await this.store.writeJournal(page, {
      version: 1,
      pageId: page.pageId,
      previousRevisionId: snapshot.parentRevisionId,
      targetRevisionId: snapshot.revisionId,
      ...(snapshot.changeSetId ? { changeSetId: snapshot.changeSetId } : {}),
      createdAt: snapshot.createdAt,
    } satisfies CommitJournal);
    await options.afterStage?.('prepared');
    await this.store.writeRevision(page, snapshot);
    await options.afterStage?.('revision');
    const storedPrevious = await this.store.readWorkingIfPresent(page);
    const previous = storedPrevious ? toWorkingV2(page, storedPrevious) : undefined;
    await this.store.writeWorking(page, workingAtSnapshot(page, previous, snapshot));
    await options.afterStage?.('schema');
    await this.writeReceipt(page, snapshot);
    await options.afterStage?.('receipt');
    await this.store.removeJournal(page);
    return { schema: snapshot.schema, revisionId: snapshot.revisionId };
  }

  async recover(page: WorkingSchemaPageRef): Promise<void> {
    const journal = await this.store.readJournal(page);
    if (journal) {
      if (journal.version !== 1 || journal.pageId !== page.pageId)
        throw invalid('页面恢复记录无效');
      const target = await this.store.readRevisionIfPresent(page, journal.targetRevisionId);
      if (target) {
        validateSnapshot(target);
        if (
          target.parentRevisionId !== journal.previousRevisionId ||
          target.changeSetId !== journal.changeSetId
        )
          throw invalid('页面恢复记录与 Revision 不匹配');
        const storedPrevious = await this.store.readWorkingIfPresent(page);
        const previous = storedPrevious ? toWorkingV2(page, storedPrevious) : undefined;
        await this.store.writeWorking(page, workingAtSnapshot(page, previous, target));
        await this.writeReceipt(page, target);
      }
      await this.store.removeJournal(page);
    }

    const storedWorking = await this.store.readWorkingIfPresent(page);
    if (!storedWorking) return;
    const working = toWorkingV2(page, storedWorking);
    const snapshot = await this.store.readRevision(page, working.lastSavedRevisionId);
    validateSnapshot(snapshot);
    if (
      working.pageId !== page.pageId ||
      !Number.isSafeInteger(working.workingVersion) ||
      working.workingVersion < 1 ||
      !working.lastSavedRevisionId ||
      !working.baselineHash ||
      Number.isNaN(Date.parse(working.updatedAt)) ||
      hashSchema(working.schema) !== working.workingHash ||
      working.savedSchemaHash !== snapshot.schemaHash
    )
      throw invalid('页面工作副本无效');
    if (storedWorking.version === 1) await this.store.writeWorking(page, working);
  }
}
