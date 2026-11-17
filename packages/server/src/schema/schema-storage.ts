import type { ChangeSource, OrigamixPageSchema } from '@origamix/shared';

export interface WorkingSchemaPageRef {
  projectPath: string;
  pageId: string;
  slug: string;
  relativePath?: string;
}

export const WORKING_SCHEMA_FILE_VERSION = 1;

export interface WorkingSchemaFile {
  version: typeof WORKING_SCHEMA_FILE_VERSION;
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

export interface SchemaStorage {
  readWorking(page: WorkingSchemaPageRef): Promise<WorkingSchemaFile>;
  readWorkingIfPresent(page: WorkingSchemaPageRef): Promise<WorkingSchemaFile | undefined>;
  writeWorking(page: WorkingSchemaPageRef, value: WorkingSchemaFile): Promise<void>;
  readRevision(page: WorkingSchemaPageRef, id: string): Promise<RevisionSnapshot>;
  readRevisionIfPresent(
    page: WorkingSchemaPageRef,
    id: string,
  ): Promise<RevisionSnapshot | undefined>;
  listRevisions(page: WorkingSchemaPageRef): Promise<RevisionSnapshot[]>;
  writeRevision(page: WorkingSchemaPageRef, snapshot: RevisionSnapshot): Promise<void>;
  readJournal(page: WorkingSchemaPageRef): Promise<CommitJournal | undefined>;
  writeJournal(page: WorkingSchemaPageRef, journal: CommitJournal): Promise<void>;
  removeJournal(page: WorkingSchemaPageRef): Promise<void>;
  readAgentCommit(
    page: WorkingSchemaPageRef,
    runId: string,
  ): Promise<AgentWorkingCommitReceipt | undefined>;
  writeAgentCommit(page: WorkingSchemaPageRef, receipt: AgentWorkingCommitReceipt): Promise<void>;
  removePage(page: WorkingSchemaPageRef): Promise<void>;
}
