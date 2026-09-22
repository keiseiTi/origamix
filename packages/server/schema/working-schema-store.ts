import { writeJsonAtomically } from '../infrastructure/atomic-file';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ChangeSource, OrigamixPageSchema } from '@origamix/shared/protocol/schema';

export interface WorkingSchemaPageRef {
  projectPath: string;
  pageId: string;
  slug: string;
  relativePath?: string;
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

export interface RevisionSnapshot {
  revisionId: string;
  parentRevisionId: string | null;
  source: ChangeSource;
  createdAt: string;
  schemaHash: string;
  schema: OrigamixPageSchema;
}

export interface CommitJournal {
  version: 1;
  pageId: string;
  previousRevisionId: string | null;
  targetRevisionId: string;
  createdAt: string;
}

export interface AgentWorkingCommitReceipt {
  version: 1;
  state: 'prepared' | 'committed';
  runId: string;
  projectId: string;
  pageId: string;
  baseWorkingVersion: number;
  resultWorkingVersion: number;
  resultWorkingHash: string;
  operationDigest: string;
  preparedAt: string;
  committedAt?: string;
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

  private agentCommitFile(page: WorkingSchemaPageRef, runId: string): string {
    if (!/^run_[A-Za-z0-9_-]+$/.test(runId)) throw new Error('Agent Run ID 无效');
    return join(
      page.projectPath,
      '.origamix',
      'pages',
      page.pageId,
      'agent-commits',
      `${runId}.json`,
    );
  }

  readWorking(page: WorkingSchemaPageRef): Promise<WorkingSchemaFile> {
    return readJson(this.workingFile(page));
  }

  readWorkingIfPresent(page: WorkingSchemaPageRef): Promise<WorkingSchemaFile | undefined> {
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

  async listRevisions(page: WorkingSchemaPageRef): Promise<RevisionSnapshot[]> {
    const directory = join(page.projectPath, '.origamix', 'revisions', page.pageId);
    let entries: string[];
    try {
      entries = await readdir(directory);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
      throw error;
    }
    const revisionFiles = entries.filter((entry) => /^revision_[A-Za-z0-9_-]+\.json$/.test(entry));
    return Promise.all(
      revisionFiles.map((entry) => readJson<RevisionSnapshot>(join(directory, entry))),
    );
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

  readAgentCommit(
    page: WorkingSchemaPageRef,
    runId: string,
  ): Promise<AgentWorkingCommitReceipt | undefined> {
    return readJsonIfPresent(this.agentCommitFile(page, runId));
  }

  writeAgentCommit(page: WorkingSchemaPageRef, receipt: AgentWorkingCommitReceipt): Promise<void> {
    return this.writeJson(this.agentCommitFile(page, receipt.runId), receipt);
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
      rm(this.journalFile(page), { force: true }),
    ]);
  }
}
