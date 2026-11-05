import { LayoutService } from '../layout/layout-service';
import type { LayoutApplyReceipt } from '../layout/layout-apply-contracts';
import { hashJson } from '../infrastructure/json-hash';
import { withProjectActivity } from '../projects/project-activity';
import { assertProjectNotUpgrading } from '../projects/project-upgrade-store';
import { ProjectManifestStore } from '../projects/project-manifest-store';
import { writeJsonAtomically } from '../infrastructure/atomic-file';
import { hashSchema } from './schema-hash';
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { metadataPath } from './metadata-path';
import {
  type ApplyPageResult,
  type LayoutApplyRequest,
  type LayoutApplyResult,
  isLayoutDocument,
  type PageApplyState,
  type OrigamixPageSchema,
} from '@origamix/shared';

import type { ProjectRepository } from '../projects/project-repository';
import { conflict, invalid, notFound } from '../errors';
import {
  applyWorkingSchemaOperation,
  getWorkingSchemaState,
  reloadWorkingSchemaFromTarget,
  updateWorkingBaseline,
} from './schema-service';
import { type SchemaPageRef } from './schema-contracts';
import { validateProjectPageAgainstMaterials } from './validation/material-validation';
import { TargetSchemaStore } from './target-schema-store';

interface ApplyReceipt extends ApplyPageResult {
  requestHash: string;
}

export interface ProjectApplyOptions {
  /** Test/host hook used to simulate interruption after a durable apply stage. */
  afterStage?: (stage: 'prepared' | 'target' | 'receipt') => void | Promise<void>;
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

export class ProjectApplyService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly targets = new TargetSchemaStore(),
    private readonly options: ProjectApplyOptions = {},
    private readonly layouts = new LayoutService(projects),
  ) {}

  private resolve(projectId: string, pageId: string): SchemaPageRef {
    const project = this.projects.getProject(projectId);
    const record = this.projects.getPage(projectId, pageId);
    if (!project || !record) throw notFound('页面不存在');
    const page = {
      projectPath: project.path,
      pageId: record.id,
      slug: record.slug,
      relativePath: record.relativePath,
    };
    return page;
  }

  private withOwnedPage<T>(
    projectId: string,
    pageId: string,
    action: (page: SchemaPageRef) => Promise<T>,
  ): Promise<T> {
    const page = this.resolve(projectId, pageId);
    return withProjectActivity(page.projectPath, () => action(this.resolve(projectId, pageId)));
  }

  private readLayoutHash = async (path: string, projectId: string): Promise<string | null> => {
    const target = await this.targets.readLayout(path);
    if (target === undefined) return null;
    if (!isLayoutDocument(target) || target.projectId !== projectId)
      throw conflict('项目布局文件无效或归属已变化，请恢复原文件后重试');
    return hashJson(target);
  };
  getLayoutState = (projectId: string) =>
    this.layouts.withApplyState(projectId, async (path, working, baselineHash, pending) => {
      const targetSchemaHash = await this.readLayoutHash(path, projectId);
      return {
        projectId,
        revisionId: working.revisionId,
        workingVersion: working.workingVersion,
        workingHash: working.workingHash,
        savedSchemaHash: working.savedSchemaHash,
        baselineHash,
        targetSchemaHash,
        ...(pending
          ? {
              pendingRequest: {
                clientRequestId: pending.clientRequestId,
                revisionId: pending.revisionId,
                workingVersion: pending.expectedWorkingVersion,
              },
            }
          : {}),
        status: pending
          ? ('apply_pending' as const)
          : working.savedSchemaHash !== working.workingHash
            ? ('draft_unsaved' as const)
            : targetSchemaHash !== baselineHash
              ? ('external_change' as const)
              : targetSchemaHash === working.workingHash
                ? ('in_sync' as const)
                : ('saved_pending_apply' as const),
      };
    });
  applyLayout = (input: LayoutApplyRequest): Promise<LayoutApplyResult> =>
    this.layouts.withApply(input, async (context) => {
      const targetHash = await this.readLayoutHash(context.path, input.projectId);
      const receipt = context.receipt;
      const resultOf = (value: LayoutApplyReceipt): LayoutApplyResult => ({
        projectId: value.projectId,
        revisionId: value.revisionId,
        schemaHash: value.schemaHash,
        appliedAt: value.appliedAt,
        status: 'applied',
      });
      if (receipt?.state === 'committed') {
        if (targetHash !== receipt.schemaHash)
          throw conflict('布局应用回执与项目文件不一致，请检查外部修改');
        return resultOf(receipt);
      }
      if (receipt) {
        if (
          receipt.schemaHash !== context.working.workingHash ||
          (targetHash !== receipt.baselineHash && targetHash !== receipt.schemaHash)
        )
          throw conflict('待恢复布局应用与项目文件不一致，请恢复原文件，不会自动覆盖');
      } else if (targetHash !== context.baselineHash)
        throw conflict('项目布局文件已被外部修改，请恢复原文件后再应用');
      const prepared: LayoutApplyReceipt = receipt ?? {
        version: 1,
        state: 'prepared',
        projectId: input.projectId,
        revisionId: input.expectedRevisionId,
        expectedWorkingVersion: input.expectedWorkingVersion,
        clientRequestId: input.clientRequestId,
        requestHash: hashJson({
          projectId: input.projectId,
          revisionId: input.expectedRevisionId,
          workingVersion: input.expectedWorkingVersion,
        }),
        schemaHash: context.working.workingHash,
        baselineHash: context.baselineHash,
        appliedAt: new Date().toISOString(),
        status: 'applied',
      };
      if (!receipt) await context.prepare(prepared);
      await this.options.afterStage?.('prepared');
      if (targetHash !== prepared.schemaHash)
        await this.targets.writeLayout(context.path, context.working.document);
      await this.options.afterStage?.('target');
      if ((await this.readLayoutHash(context.path, input.projectId)) !== prepared.schemaHash)
        throw invalid('布局应用后校验失败');
      const committed = { ...prepared, state: 'committed' as const };
      await context.complete(committed);
      await this.options.afterStage?.('receipt');
      return resultOf(committed);
    });

  async initializeTarget(page: SchemaPageRef, schema: OrigamixPageSchema): Promise<void> {
    await this.targets.write(page, schema);
    const verified = await this.targets.read(page);
    if (hashSchema(verified) !== hashSchema(schema)) throw invalid('页面初始化后校验失败');
  }

  private async readTarget(page: SchemaPageRef): Promise<OrigamixPageSchema> {
    try {
      return await this.targets.read(page);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        throw conflict('页面目标 Schema 路径已变化或文件不存在，请检查项目页面路径');
      throw error;
    }
  }

  async getState(projectId: string, pageId: string): Promise<PageApplyState> {
    return this.withOwnedPage(projectId, pageId, async (page) => {
      const working = await getWorkingSchemaState(page);
      const targetSchema = await this.readTarget(page);
      const targetSchemaHash = hashSchema(targetSchema);
      return {
        pageId,
        savedRevisionId: working.revisionId,
        workingVersion: working.workingVersion,
        status:
          working.workingHash !== working.savedSchemaHash
            ? 'draft_unsaved'
            : targetSchemaHash !== working.baselineHash &&
                targetSchemaHash !== working.savedSchemaHash
              ? 'external_change'
              : working.savedSchemaHash === targetSchemaHash
                ? 'in_sync'
                : 'saved_pending_apply',
        workingHash: working.workingHash,
        savedSchemaHash: working.savedSchemaHash,
        targetSchemaHash,
        baselineHash: working.baselineHash,
      };
    });
  }

  async reloadFromProject(projectId: string, pageId: string) {
    return this.withOwnedPage(projectId, pageId, async (page) => {
      const target = await this.readTarget(page);
      return reloadWorkingSchemaFromTarget(page, target);
    });
  }

  async apply(
    projectId: string,
    pageId: string,
    input: {
      expectedRevisionId: string;
      expectedWorkingVersion: number;
      clientRequestId: string;
    },
  ): Promise<ApplyPageResult> {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(input.clientRequestId)) throw invalid('应用请求 ID 无效');
    return this.withOwnedPage(projectId, pageId, async (page) => {
      const projectManifest = await new ProjectManifestStore().readManifest(page.projectPath);
      if (projectManifest.projectId !== projectId) throw invalid('项目清单归属不匹配');
      await new ProjectManifestStore().requireEditable(page.projectPath);
      const requestHash = createHash('sha256')
        .update(
          JSON.stringify({
            pageId,
            expectedRevisionId: input.expectedRevisionId,
            expectedWorkingVersion: input.expectedWorkingVersion,
          }),
        )
        .digest('hex');
      const receiptPath = await metadataPath(
        page.projectPath,
        'apply-receipts',
        pageId,
        `${input.clientRequestId}.json`,
      );
      const receipt = await readJsonIfPresent<ApplyReceipt>(receiptPath);
      if (receipt) {
        if (receipt.requestHash !== requestHash) throw conflict('请求 ID 已用于其他应用操作');
        const working = await getWorkingSchemaState(page);
        const target = await this.readTarget(page);
        if (hashSchema(target) !== receipt.schemaHash)
          throw conflict('应用回执与项目文件不一致，请检查页面目标文件');
        if (working.baselineHash !== receipt.schemaHash)
          await updateWorkingBaseline(page, working.workingVersion, receipt.schemaHash);
        return {
          pageId: receipt.pageId,
          revisionId: receipt.revisionId,
          schemaHash: receipt.schemaHash,
          appliedAt: receipt.appliedAt,
          status: receipt.status,
        };
      }
      return applyWorkingSchemaOperation(
        page,
        input.expectedRevisionId,
        input.expectedWorkingVersion,
        async (working) => {
          const queuedReceipt = await readJsonIfPresent<ApplyReceipt>(receiptPath);
          if (queuedReceipt) {
            if (queuedReceipt.requestHash !== requestHash)
              throw conflict('请求 ID 已用于其他应用操作');
            const target = await this.readTarget(page);
            if (hashSchema(target) !== queuedReceipt.schemaHash)
              throw conflict('应用回执与项目文件不一致，请检查页面目标文件');
            return {
              result: {
                pageId: queuedReceipt.pageId,
                revisionId: queuedReceipt.revisionId,
                schemaHash: queuedReceipt.schemaHash,
                appliedAt: queuedReceipt.appliedAt,
                status: queuedReceipt.status,
              },
              baselineHash: queuedReceipt.schemaHash,
            };
          }
          await new ProjectManifestStore().requireEditable(page.projectPath);
          await assertProjectNotUpgrading(page.projectPath);
          const targetSchema = await this.readTarget(page);
          const targetHash = hashSchema(targetSchema);
          if (targetHash !== working.baselineHash && targetHash !== working.schemaHash)
            throw conflict('项目文件已变化，请重新读取后再应用');
          const validation = await validateProjectPageAgainstMaterials(
            page.projectPath,
            working.schema,
          );
          if (!validation.valid)
            throw invalid(validation.errors[0]?.message ?? 'Schema 物料校验失败');
          if (targetHash !== working.schemaHash) await this.targets.write(page, working.schema);
          await this.options.afterStage?.('target');
          const verified = await this.targets.read(page);
          if (hashSchema(verified) !== working.schemaHash) throw invalid('应用后校验失败');
          const result: ApplyPageResult = {
            pageId,
            revisionId: working.revisionId,
            schemaHash: working.schemaHash,
            appliedAt: new Date().toISOString(),
            status: 'applied',
          };
          await metadataPath(
            page.projectPath,
            'apply-receipts',
            pageId,
            `${input.clientRequestId}.json`,
          );
          await mkdir(dirname(receiptPath), { recursive: true });
          await writeJsonAtomically(receiptPath, { ...result, requestHash } satisfies ApplyReceipt);
          await this.options.afterStage?.('receipt');
          return { result, baselineHash: working.schemaHash };
        },
      );
    });
  }
}
