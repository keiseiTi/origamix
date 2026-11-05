import { nanoid } from 'nanoid';
import { Value } from '@sinclair/typebox/value';
import {
  createEmptyLayoutDocument,
  isProjectLayoutEnabled,
  validateLayoutDocument,
  PageOutletPropsSchema,
  PAGE_OUTLET_TYPE,
  LayoutScopeSchema,
  LayoutOperationsRequestSchema,
  LayoutSaveRevisionRequestSchema,
  LayoutRevisionRequestSchema,
  LayoutRestoreRevisionRequestSchema,
  RevisionIdSchema,
  LayoutRevisionSnapshotSchema,
  type LayoutOperationsRequest,
  type LayoutWorkingState,
  type ProjectLayoutDocument,
} from '@origamix/shared';
import type { ProjectRepository } from '../projects/project-repository';
import { ProjectManifestStore } from '../projects/project-manifest-store';
import { withProjectActivity } from '../projects/project-activity';
import { loadProjectMaterials } from '../projects/project-materials';
import { validatePageAgainstMaterials } from '../schema/validation/material-validation';
import { SchemaOperationError } from '../schema/schema-operation-engine';
import { KeyedQueue } from '../infrastructure/keyed-queue';
import { hashJson } from '../infrastructure/json-hash';
import { conflict, invalid, notFound } from '../errors';
import { LayoutStore, type LayoutWorkingFile, type LayoutRevisionSnapshot } from './layout-store';
import { applyLayoutOperations } from './layout-operation';

const queue = new KeyedQueue();
export interface LayoutSaveOptions {
  /** Deterministic failure injection at durable save boundaries. */
  afterStage?: (stage: 'prepared' | 'revision' | 'working') => void | Promise<void>;
}
const stateOf = (working: LayoutWorkingFile): LayoutWorkingState => ({
  document: structuredClone(working.document),
  workingVersion: working.workingVersion,
  workingHash: working.workingHash,
  revisionId: working.revisionId,
  savedSchemaHash: working.savedSchemaHash,
});

export class LayoutService {
  private readonly store = new LayoutStore();
  constructor(private readonly projects: Pick<ProjectRepository, 'getProject'>) {}

  private scoped = async <T>(
    projectId: string,
    action: (path: string) => Promise<T>,
  ): Promise<T> => {
    if (!Value.Check(LayoutScopeSchema, { projectId })) throw invalid('布局项目 ID 无效');
    const project = this.projects.getProject(projectId);
    if (!project || project.status !== 0) throw notFound('项目不存在或不可用');
    return withProjectActivity(project.path, () =>
      queue.run(project.path, async () => {
        const current = this.projects.getProject(projectId);
        if (!current || current.status !== 0 || current.path !== project.path)
          throw notFound('项目不存在或不可用');
        const manifest = await new ProjectManifestStore().requireEditable(project.path);
        if (manifest.projectId !== projectId) throw invalid('项目清单归属无效');
        if (!isProjectLayoutEnabled(manifest))
          throw conflict('项目尚未开启布局配置，请在项目设置中开启');
        return action(project.path);
      }),
    );
  };

  private assertDocument = (value: unknown, projectId: string): ProjectLayoutDocument => {
    const issue = validateLayoutDocument(value)[0];
    if (issue) throw invalid(`${issue.code} at ${issue.path}: ${issue.message}`);
    if ((value as ProjectLayoutDocument).projectId !== projectId) throw invalid('布局文档归属无效');
    return value as ProjectLayoutDocument;
  };
  private assertWorking = (value: unknown, projectId: string): LayoutWorkingFile => {
    if (!this.store.validateWorking(value) || Number.isNaN(Date.parse(value.updatedAt)))
      throw invalid('布局 Working 无效，原数据已保留');
    this.assertDocument(value.document, projectId);
    if (
      hashJson(value.document) !== value.workingHash ||
      (value.revisionId === null) !== (value.savedSchemaHash === null)
    )
      throw invalid('布局 Working 内容校验失败');
    return value;
  };
  private assertRevision = (
    value: LayoutRevisionSnapshot | undefined,
    projectId: string,
    revisionId: string,
  ): LayoutRevisionSnapshot => {
    if (!value) throw notFound('布局 Revision 不存在');
    if (
      !Value.Check(LayoutRevisionSnapshotSchema, value) ||
      value.projectId !== projectId ||
      value.revisionId !== revisionId ||
      !Value.Check(RevisionIdSchema, revisionId) ||
      (value.parentRevisionId !== null && !Value.Check(RevisionIdSchema, value.parentRevisionId)) ||
      Number.isNaN(Date.parse(value.createdAt))
    )
      throw invalid('布局 Revision 归属或元数据无效');
    this.assertDocument(value.document, projectId);
    if (hashJson(value.document) !== value.schemaHash) throw invalid('布局 Revision 内容校验失败');
    return value;
  };

  private recover = async (path: string, projectId: string): Promise<void> => {
    const journal = await this.store.readJournal(path);
    if (!journal) return;
    if (
      journal.version !== 1 ||
      journal.projectId !== projectId ||
      !journal.snapshot ||
      typeof journal.previousHash !== 'string'
    )
      throw invalid('布局恢复记录无效');
    const next = this.assertWorking(journal.next, projectId);
    const snapshot = this.assertRevision(journal.snapshot, projectId, next.revisionId ?? '');
    if (next.workingHash !== snapshot.schemaHash || next.savedSchemaHash !== snapshot.schemaHash)
      throw invalid('布局恢复内容不匹配');
    const current = this.assertWorking(await this.store.readWorking(path), projectId);
    if (hashJson(current) !== journal.previousHash && hashJson(current) !== hashJson(next))
      throw conflict('布局恢复记录与当前草稿不匹配');
    if (hashJson(current) === journal.previousHash) {
      const expected = {
        ...current,
        revisionId: snapshot.revisionId,
        savedSchemaHash: snapshot.schemaHash,
      };
      if (snapshot.parentRevisionId !== current.revisionId || hashJson(expected) !== hashJson(next))
        throw invalid('布局恢复记录改变了草稿内容，已停止恢复');
    }
    const retained = await this.store.readRevision(path, snapshot.revisionId);
    if (retained) {
      this.assertRevision(retained, projectId, snapshot.revisionId);
      if (hashJson(retained) !== hashJson(snapshot)) throw invalid('布局恢复 Revision 不匹配');
      if (hashJson(current) !== hashJson(next)) await this.store.writeWorking(path, next);
    } else if (hashJson(current) !== journal.previousHash) throw invalid('布局恢复缺少 Revision');
    await this.store.removeJournal(path);
  };
  private current = async (path: string, projectId: string): Promise<LayoutWorkingFile> => {
    await this.recover(path, projectId);
    const retained = await this.store.readWorking(path);
    if (retained) {
      const working = this.assertWorking(retained, projectId);
      if (working.revisionId) {
        const snapshot = this.assertRevision(
          await this.store.readRevision(path, working.revisionId),
          projectId,
          working.revisionId,
        );
        if (snapshot.schemaHash !== working.savedSchemaHash) throw invalid('布局保存版本不匹配');
      }
      return working;
    }
    // Never recreate Working over retained history or an interrupted/missing draft.
    if (await this.store.hasMetadata(path)) throw invalid('布局 Working 缺失，请恢复原数据');
    const document = createEmptyLayoutDocument(projectId);
    const working: LayoutWorkingFile = {
      version: 1,
      document,
      workingVersion: 1,
      workingHash: hashJson(document),
      revisionId: null,
      savedSchemaHash: null,
      updatedAt: new Date().toISOString(),
    };
    await this.store.writeWorking(path, working);
    return working;
  };
  private validateCandidate = async (
    path: string,
    projectId: string,
    document: ProjectLayoutDocument,
  ): Promise<void> => {
    this.assertDocument(document, projectId);
    if (Buffer.byteLength(JSON.stringify(document), 'utf8') > 2 * 1024 * 1024)
      throw invalid('布局文档超过 2 MiB 限制');
    const materials = await loadProjectMaterials(path);
    const runtime = {
      ...materials.validation,
      registry: {
        ...materials.validation.registry,
        [PAGE_OUTLET_TYPE]: {
          type: PAGE_OUTLET_TYPE,
          version: materials.manifest.materialSet.version,
          propsSchema: PageOutletPropsSchema,
          acceptsChildren: false,
          role: 'layout' as const,
          context: { variables: [], writable: [], actions: [], events: [] },
        },
      },
    };
    const result = validatePageAgainstMaterials(
      document.schema,
      [materials.manifest.materialSet],
      runtime,
    );
    const issue = result.errors[0];
    if (issue) throw invalid(`${issue.code} at ${issue.path}: ${issue.message}`);
  };

  private checkVersion = (current: LayoutWorkingFile, version: number): void => {
    if (current.workingVersion !== version) throw conflict('布局草稿已更新，请重新加载后再提交');
  };
  getWorking = (projectId: string): Promise<LayoutWorkingState> =>
    this.scoped(projectId, async (path) => stateOf(await this.current(path, projectId)));

  applyOperations = (input: LayoutOperationsRequest): Promise<LayoutWorkingState> => {
    if (!Value.Check(LayoutOperationsRequestSchema, input)) throw invalid('布局操作请求无效');
    return this.scoped(input.projectId, async (path) => {
      const current = await this.current(path, input.projectId);
      const digest = hashJson(input);
      if (current.lastMutation?.requestId === input.clientRequestId) {
        if (current.lastMutation.digest !== digest) throw conflict('请求身份已用于其他布局操作');
        return stateOf(current);
      }
      this.checkVersion(current, input.baseWorkingVersion);
      let document: ProjectLayoutDocument;
      try {
        document = applyLayoutOperations(current.document, input.operations);
      } catch (error) {
        if (error instanceof SchemaOperationError) throw invalid(`${error.code}: ${error.message}`);
        throw error;
      }
      await this.validateCandidate(path, input.projectId, document);
      const next: LayoutWorkingFile = {
        ...current,
        document,
        workingVersion: current.workingVersion + 1,
        workingHash: hashJson(document),
        updatedAt: new Date().toISOString(),
        lastMutation: { requestId: input.clientRequestId, digest },
      };
      // Identity and draft commit together, so a lost response cannot repeat a mutation.
      await this.store.writeWorking(path, next);
      return stateOf(next);
    });
  };
  saveRevision = (
    projectId: string,
    expectedWorkingVersion: number,
    options: LayoutSaveOptions = {},
  ): Promise<LayoutWorkingState> => {
    if (!Value.Check(LayoutSaveRevisionRequestSchema, { projectId, expectedWorkingVersion }))
      throw invalid('布局保存请求无效');
    return this.scoped(projectId, async (path) => {
      const current = await this.current(path, projectId);
      this.checkVersion(current, expectedWorkingVersion);
      await this.validateCandidate(path, projectId, current.document);
      if (current.workingHash === current.savedSchemaHash) return stateOf(current);
      const snapshot: LayoutRevisionSnapshot = {
        projectId,
        revisionId: `revision_${nanoid()}`,
        parentRevisionId: current.revisionId,
        createdAt: new Date().toISOString(),
        schemaHash: current.workingHash,
        document: current.document,
      };
      // Saving does not alter the document or Working version; retries after recovery are safe.
      const next = {
        ...current,
        revisionId: snapshot.revisionId,
        savedSchemaHash: snapshot.schemaHash,
      };
      await this.store.writeJournal(path, {
        version: 1,
        projectId,
        previousHash: hashJson(current),
        snapshot,
        next,
      });
      await options.afterStage?.('prepared');
      await this.store.writeRevision(path, snapshot);
      await options.afterStage?.('revision');
      await this.store.writeWorking(path, next);
      await options.afterStage?.('working');
      await this.store.removeJournal(path);
      return stateOf(next);
    });
  };
  listRevisions = (projectId: string) =>
    this.scoped(projectId, async (path) => {
      const current = await this.current(path, projectId);
      const revisions = await Promise.all(
        (await this.store.listRevisionIds(path)).map(async (id) =>
          this.assertRevision(await this.store.readRevision(path, id), projectId, id),
        ),
      );
      return {
        revisions: revisions
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((revision) => ({
            projectId: revision.projectId,
            revisionId: revision.revisionId,
            parentRevisionId: revision.parentRevisionId,
            createdAt: revision.createdAt,
            schemaHash: revision.schemaHash,
            isCurrent: revision.revisionId === current.revisionId,
          })),
      };
    });
  getRevision = (projectId: string, revisionId: string) => {
    if (!Value.Check(LayoutRevisionRequestSchema, { projectId, revisionId }))
      throw invalid('布局 Revision 请求无效');
    return this.scoped(projectId, async (path) => {
      await this.recover(path, projectId);
      return this.assertRevision(
        await this.store.readRevision(path, revisionId),
        projectId,
        revisionId,
      );
    });
  };
  restoreRevision = (
    projectId: string,
    revisionId: string,
    expectedWorkingVersion: number,
  ): Promise<LayoutWorkingState> => {
    if (
      !Value.Check(LayoutRestoreRevisionRequestSchema, {
        projectId,
        revisionId,
        expectedWorkingVersion,
      })
    )
      throw invalid('布局恢复请求无效');
    return this.scoped(projectId, async (path) => {
      const current = await this.current(path, projectId);
      this.checkVersion(current, expectedWorkingVersion);
      const snapshot = this.assertRevision(
        await this.store.readRevision(path, revisionId),
        projectId,
        revisionId,
      );
      await this.validateCandidate(path, projectId, snapshot.document);
      const next: LayoutWorkingFile = {
        ...current,
        document: snapshot.document,
        workingHash: snapshot.schemaHash,
        workingVersion: current.workingVersion + 1,
        updatedAt: new Date().toISOString(),
      };
      delete next.lastMutation;
      await this.store.writeWorking(path, next);
      return stateOf(next);
    });
  };
}
