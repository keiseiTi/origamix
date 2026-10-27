import { writeJsonAtomically } from '../infrastructure/atomic-file';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { metadataPath } from './metadata-path';
import type { ChangeSource, OrigamixPageSchema } from '@origamix/shared';

export interface WorkingSchemaPageRef {
  projectPath: string;
  pageId: string;
  slug: string;
  relativePath?: string;
}

export interface WorkingSchemaFile {
  migration?: { from: string; to: string };
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

  private workingFile(page: WorkingSchemaPageRef): Promise<string> {
    return metadataPath(page.projectPath, 'pages', page.pageId, 'working.json');
  }

  private revisionFile(page: WorkingSchemaPageRef, revisionId: string): Promise<string> {
    return metadataPath(page.projectPath, 'revisions', page.pageId, `${revisionId}.json`);
  }

  private journalFile(page: WorkingSchemaPageRef): Promise<string> {
    return metadataPath(page.projectPath, 'transactions', `${page.pageId}.json`);
  }

  private agentCommitFile(page: WorkingSchemaPageRef, runId: string): Promise<string> {
    if (!/^run_[A-Za-z0-9_-]+$/.test(runId)) throw new Error('Agent Run ID 无效');
    return metadataPath(page.projectPath, 'pages', page.pageId, 'agent-commits', `${runId}.json`);
  }

  async readWorking(page: WorkingSchemaPageRef): Promise<WorkingSchemaFile> {
    return readJson(await this.workingFile(page));
  }

  async readWorkingIfPresent(page: WorkingSchemaPageRef): Promise<WorkingSchemaFile | undefined> {
    return readJsonIfPresent(await this.workingFile(page));
  }

  async writeWorking(page: WorkingSchemaPageRef, value: WorkingSchemaFile): Promise<void> {
    return this.writeJson(await this.workingFile(page), value);
  }

  async readRevision(page: WorkingSchemaPageRef, revisionId: string): Promise<RevisionSnapshot> {
    return readJson(await this.revisionFile(page, revisionId));
  }

  async readRevisionIfPresent(
    page: WorkingSchemaPageRef,
    revisionId: string,
  ): Promise<RevisionSnapshot | undefined> {
    return readJsonIfPresent(await this.revisionFile(page, revisionId));
  }

  async listRevisions(page: WorkingSchemaPageRef): Promise<RevisionSnapshot[]> {
    const directory = await metadataPath(page.projectPath, 'revisions', page.pageId);
    let entries: string[];
    try {
      entries = await readdir(directory);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
      throw error;
    }
    const revisionFiles = entries.filter((entry) => /^revision_[A-Za-z0-9_-]+\.json$/.test(entry));
    return Promise.all(
      revisionFiles.map(async (entry) =>
        readJson<RevisionSnapshot>(
          await metadataPath(page.projectPath, 'revisions', page.pageId, entry),
        ),
      ),
    );
  }

  async writeRevision(page: WorkingSchemaPageRef, snapshot: RevisionSnapshot): Promise<void> {
    return this.writeJson(await this.revisionFile(page, snapshot.revisionId), snapshot);
  }

  async readJournal(page: WorkingSchemaPageRef): Promise<CommitJournal | undefined> {
    return readJsonIfPresent(await this.journalFile(page));
  }

  async writeJournal(page: WorkingSchemaPageRef, journal: CommitJournal): Promise<void> {
    return this.writeJson(await this.journalFile(page), journal);
  }

  async removeJournal(page: WorkingSchemaPageRef): Promise<void> {
    return rm(await this.journalFile(page), { force: true });
  }

  async readAgentCommit(
    page: WorkingSchemaPageRef,
    runId: string,
  ): Promise<AgentWorkingCommitReceipt | undefined> {
    return readJsonIfPresent(await this.agentCommitFile(page, runId));
  }

  async writeAgentCommit(
    page: WorkingSchemaPageRef,
    receipt: AgentWorkingCommitReceipt,
  ): Promise<void> {
    return this.writeJson(await this.agentCommitFile(page, receipt.runId), receipt);
  }

  async removePage(page: WorkingSchemaPageRef): Promise<void> {
    const [working, revisions, journal] = await Promise.all([
      metadataPath(page.projectPath, 'pages', page.pageId),
      metadataPath(page.projectPath, 'revisions', page.pageId),
      this.journalFile(page),
    ]);
    await Promise.all([
      rm(working, { recursive: true, force: true }),
      rm(revisions, { recursive: true, force: true }),
      rm(journal, { force: true }),
    ]);
  }
}
