import { writeJsonAtomically } from '../infrastructure/atomic-file';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ChangeSet, OrigamixPageSchema } from '@origamix/shared/protocol/schema';

export interface WorkingSchemaPageRef {
  projectPath: string;
  pageId: string;
  slug: string;
  relativePath?: string;
}

export interface LegacyWorkingSchemaFile {
  version: 1;
  pageId: string;
  revisionId: string;
  baselineHash: string;
  schema: OrigamixPageSchema;
}

export interface WorkingSchemaFile {
  version: 2;
  pageId: string;
  workingVersion: number;
  workingHash: string;
  lastSavedRevisionId: string;
  savedSchemaHash: string;
  baselineHash: string;
  updatedAt: string;
  schema: OrigamixPageSchema;
}

export type StoredWorkingSchemaFile = LegacyWorkingSchemaFile | WorkingSchemaFile;

export interface RevisionSnapshot {
  revisionId: string;
  parentRevisionId: string | null;
  changeSetId?: string;
  changeSetHash?: string;
  source: ChangeSet['source'];
  createdAt: string;
  schemaHash: string;
  schema: OrigamixPageSchema;
}

export interface CommitJournal {
  version: 1;
  pageId: string;
  previousRevisionId: string | null;
  targetRevisionId: string;
  changeSetId?: string;
  createdAt: string;
}

export interface ChangeSetReceipt {
  changeSetId: string;
  changeSetHash: string;
  revisionId: string;
  schemaHash: string;
}

const readJson = async <T>(path: string): Promise<T> => {
  return JSON.parse(await readFile(path, 'utf8')) as T;
};

const readJsonIfPresent = async <T>(path: string): Promise<T | undefined> => {
  try {
    return await readJson<T>(path);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
};

export class WorkingSchemaStore {
  private async writeJson(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeJsonAtomically(path, value);
  }

  private workingFile(page: WorkingSchemaPageRef): string {
    return join(page.projectPath, '.origamix', 'pages', page.pageId, 'working.json');
  }

  private revisionFile(page: WorkingSchemaPageRef, revisionId: string): string {
    return join(page.projectPath, '.origamix', 'revisions', page.pageId, `${revisionId}.json`);
  }

  private journalFile(page: WorkingSchemaPageRef): string {
    return join(page.projectPath, '.origamix', 'transactions', `${page.pageId}.json`);
  }

  private receiptFile(page: WorkingSchemaPageRef, changeSetId: string): string {
    return join(page.projectPath, '.origamix', 'changesets', page.pageId, `${changeSetId}.json`);
  }

  readWorking(page: WorkingSchemaPageRef): Promise<StoredWorkingSchemaFile> {
    return readJson(this.workingFile(page));
  }

  readWorkingIfPresent(page: WorkingSchemaPageRef): Promise<StoredWorkingSchemaFile | undefined> {
    return readJsonIfPresent(this.workingFile(page));
  }

  writeWorking(page: WorkingSchemaPageRef, value: WorkingSchemaFile): Promise<void> {
    return this.writeJson(this.workingFile(page), value);
  }

  readRevision(page: WorkingSchemaPageRef, revisionId: string): Promise<RevisionSnapshot> {
    return readJson(this.revisionFile(page, revisionId));
  }

  readRevisionIfPresent(
    page: WorkingSchemaPageRef,
    revisionId: string,
  ): Promise<RevisionSnapshot | undefined> {
    return readJsonIfPresent(this.revisionFile(page, revisionId));
  }

  writeRevision(page: WorkingSchemaPageRef, snapshot: RevisionSnapshot): Promise<void> {
    return this.writeJson(this.revisionFile(page, snapshot.revisionId), snapshot);
  }

  readJournal(page: WorkingSchemaPageRef): Promise<CommitJournal | undefined> {
    return readJsonIfPresent(this.journalFile(page));
  }

  writeJournal(page: WorkingSchemaPageRef, journal: CommitJournal): Promise<void> {
    return this.writeJson(this.journalFile(page), journal);
  }

  removeJournal(page: WorkingSchemaPageRef): Promise<void> {
    return rm(this.journalFile(page), { force: true });
  }

  readReceipt(
    page: WorkingSchemaPageRef,
    changeSetId: string,
  ): Promise<ChangeSetReceipt | undefined> {
    return readJsonIfPresent(this.receiptFile(page, changeSetId));
  }

  writeReceipt(page: WorkingSchemaPageRef, receipt: ChangeSetReceipt): Promise<void> {
    return this.writeJson(this.receiptFile(page, receipt.changeSetId), receipt);
  }

  async removePage(page: WorkingSchemaPageRef): Promise<void> {
    await Promise.all([
      rm(join(page.projectPath, '.origamix', 'pages', page.pageId), {
        recursive: true,
        force: true,
      }),
      rm(join(page.projectPath, '.origamix', 'revisions', page.pageId), {
        recursive: true,
        force: true,
      }),
      rm(join(page.projectPath, '.origamix', 'changesets', page.pageId), {
        recursive: true,
        force: true,
      }),
      rm(this.journalFile(page), { force: true }),
    ]);
  }
}
