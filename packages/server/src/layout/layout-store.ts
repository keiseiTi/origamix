import type { LayoutApplyReceipt } from './layout-apply-contracts';
import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import {
  LayoutWorkingStateSchema,
  RevisionIdSchema,
  type LayoutRevisionSnapshot,
} from '@origamix/shared';
import { metadataPath } from '../schema/metadata-path';
import { writeJsonAtomically } from '../infrastructure/atomic-file';
import { invalid } from '../errors';

const hash = Type.String({ pattern: '^[a-f0-9]{64}$' });
export const LayoutWorkingFileSchema = Type.Object(
  {
    version: Type.Literal(1),
    ...LayoutWorkingStateSchema.properties,
    updatedAt: Type.String(),
    baselineHash: Type.Optional(Type.Union([hash, Type.Null()])),
    lastMutation: Type.Optional(
      Type.Object(
        {
          requestId: Type.String({ pattern: '^[A-Za-z0-9_-]{1,100}$' }),
          digest: hash,
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);
export type LayoutWorkingFile = Static<typeof LayoutWorkingFileSchema>;
export type { LayoutRevisionSnapshot } from '@origamix/shared';
export interface LayoutCommitJournal {
  version: 1;
  projectId: string;
  previousHash: string;
  snapshot: LayoutRevisionSnapshot;
  next: LayoutWorkingFile;
}

const readOptional = async <T>(path: string): Promise<T | undefined> => {
  try {
    const value: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw invalid('布局内部数据必须是对象，请恢复原数据');
    return value as T;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    if (error instanceof SyntaxError) throw invalid('布局内部数据不是有效 JSON，请恢复原数据');
    throw error;
  }
};

/** All paths are fixed below the authorized project's metadata; no target writes. */
export class LayoutStore {
  private path = (projectPath: string, ...segments: string[]) =>
    metadataPath(projectPath, 'layout', ...segments);
  private write = async (path: string, value: unknown): Promise<void> => {
    await mkdir(dirname(path), { recursive: true });
    await writeJsonAtomically(path, value);
  };
  private revisionPath = (projectPath: string, revisionId: string): Promise<string> => {
    if (!Value.Check(RevisionIdSchema, revisionId)) throw invalid('布局 Revision ID 无效');
    return this.path(projectPath, 'revisions', `${revisionId}.json`);
  };
  hasMetadata = async (projectPath: string): Promise<boolean> => {
    try {
      await readdir(await this.path(projectPath));
      return true;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
      throw error;
    }
  };
  readWorking = async (projectPath: string): Promise<LayoutWorkingFile | undefined> =>
    readOptional(await this.path(projectPath, 'working.json'));
  writeWorking = async (projectPath: string, working: LayoutWorkingFile): Promise<void> =>
    this.write(await this.path(projectPath, 'working.json'), working);
  readRevision = async (
    projectPath: string,
    revisionId: string,
  ): Promise<LayoutRevisionSnapshot | undefined> =>
    readOptional(await this.revisionPath(projectPath, revisionId));
  writeRevision = async (projectPath: string, revision: LayoutRevisionSnapshot): Promise<void> => {
    const path = await this.revisionPath(projectPath, revision.revisionId);
    // Revisions are immutable, including during interrupted-save recovery.
    if (await readOptional(path)) throw invalid('布局 Revision 已存在，不能覆盖');
    await this.write(path, revision);
  };
  listRevisionIds = async (projectPath: string): Promise<string[]> => {
    try {
      return (await readdir(await this.path(projectPath, 'revisions')))
        .filter((name) => /^revision_[A-Za-z0-9_-]+\.json$/.test(name))
        .map((name) => name.slice(0, -5));
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
      throw error;
    }
  };
  readJournal = async (projectPath: string): Promise<LayoutCommitJournal | undefined> =>
    readOptional(await this.path(projectPath, 'commit.json'));
  writeJournal = async (projectPath: string, journal: LayoutCommitJournal): Promise<void> =>
    this.write(await this.path(projectPath, 'commit.json'), journal);
  removeJournal = async (projectPath: string): Promise<void> =>
    rm(await this.path(projectPath, 'commit.json'), { force: true });

  private receiptPath = (projectPath: string, requestId: string): Promise<string> => {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(requestId)) throw invalid('布局 Apply 请求 ID 无效');
    return this.path(projectPath, 'apply-receipts', `${requestId}.json`);
  };
  readPendingApply = async (projectPath: string): Promise<LayoutApplyReceipt | undefined> =>
    readOptional(await this.path(projectPath, 'apply-pending.json'));
  writePendingApply = async (projectPath: string, receipt: LayoutApplyReceipt): Promise<void> =>
    this.write(await this.path(projectPath, 'apply-pending.json'), receipt);
  removePendingApply = async (projectPath: string): Promise<void> =>
    rm(await this.path(projectPath, 'apply-pending.json'), { force: true });
  readApplyReceipt = async (
    projectPath: string,
    requestId: string,
  ): Promise<LayoutApplyReceipt | undefined> =>
    readOptional(await this.receiptPath(projectPath, requestId));
  writeApplyReceipt = async (projectPath: string, receipt: LayoutApplyReceipt): Promise<void> =>
    this.write(await this.receiptPath(projectPath, receipt.clientRequestId), receipt);
  validateWorking = (value: unknown): value is LayoutWorkingFile =>
    Value.Check(LayoutWorkingFileSchema, value);
}
