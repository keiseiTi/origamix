import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { nanoid } from 'nanoid';
import type { ApplyPageResult, PageApplyState } from '@origamix/shared/protocol/api';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import type { ProjectRepository } from '../repositories/project-repository';
import { conflict, invalid, notFound } from '../errors';
import {
  applyWorkingSchemaOperation,
  getWorkingSchemaState,
  hashSchema,
  reloadWorkingSchemaFromTarget,
  updateWorkingBaseline,
  type SchemaPageRef,
} from './schema-service';
import { validateProjectPageAgainstMaterials } from './schema-material-validation';
import { TargetSchemaStore } from '../storage/target-schema-store';

interface ApplyReceipt extends ApplyPageResult {
  requestHash: string;
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

async function writeJsonAtomically(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${nanoid()}.tmp`;
  const handle = await open(temporary, 'w', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export class ProjectApplyService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly targets = new TargetSchemaStore(),
  ) {}

  private resolve(projectId: string, pageId: string): SchemaPageRef {
    const project = this.projects.getProject(projectId);
    const record = this.projects.getPage(projectId, pageId);
    if (!project || !record) throw notFound('页面不存在');
    const page = { projectPath: project.path, pageId: record.id, slug: record.slug };
    return page;
  }

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
    const page = this.resolve(projectId, pageId);
    const working = await getWorkingSchemaState(page);
    const targetSchema = await this.readTarget(page);
    const targetSchemaHash = hashSchema(targetSchema);
    return {
      pageId,
      workingRevisionId: working.revisionId,
      status:
        working.schemaHash === targetSchemaHash
          ? 'in_sync'
          : targetSchemaHash === working.baselineHash
            ? 'pending'
            : 'external_change',
      workingSchemaHash: working.schemaHash,
      targetSchemaHash,
      baselineHash: working.baselineHash,
    };
  }

  async reloadFromProject(projectId: string, pageId: string) {
    const page = this.resolve(projectId, pageId);
    const target = await this.readTarget(page);
    return reloadWorkingSchemaFromTarget(page, target);
  }

  async apply(
    projectId: string,
    pageId: string,
    input: { expectedRevisionId: string; clientRequestId: string },
  ): Promise<ApplyPageResult> {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(input.clientRequestId)) throw invalid('应用请求 ID 无效');
    const page = this.resolve(projectId, pageId);
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ pageId, expectedRevisionId: input.expectedRevisionId }))
      .digest('hex');
    const receiptPath = join(
      page.projectPath,
      '.origamix',
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
      if (working.revisionId === receipt.revisionId && working.baselineHash !== receipt.schemaHash)
        await updateWorkingBaseline(page, receipt.revisionId, receipt.schemaHash);
      return {
        pageId: receipt.pageId,
        revisionId: receipt.revisionId,
        schemaHash: receipt.schemaHash,
        appliedAt: receipt.appliedAt,
        status: receipt.status,
      };
    }
    return applyWorkingSchemaOperation(page, input.expectedRevisionId, async (working) => {
      const targetSchema = await this.readTarget(page);
      const targetHash = hashSchema(targetSchema);
      if (targetHash !== working.baselineHash && targetHash !== working.schemaHash)
        throw conflict('项目文件已变化，请重新读取后再应用');
      const validation = await validateProjectPageAgainstMaterials(
        page.projectPath,
        working.schema,
      );
      if (!validation.valid) throw invalid(validation.errors[0]?.message ?? 'Schema 物料校验失败');
      if (targetHash !== working.schemaHash) await this.targets.write(page, working.schema);
      const verified = await this.targets.read(page);
      if (hashSchema(verified) !== working.schemaHash) throw invalid('应用后校验失败');
      const result: ApplyPageResult = {
        pageId,
        revisionId: working.revisionId,
        schemaHash: working.schemaHash,
        appliedAt: new Date().toISOString(),
        status: 'applied',
      };
      await writeJsonAtomically(receiptPath, { ...result, requestHash } satisfies ApplyReceipt);
      return { result, baselineHash: working.schemaHash };
    });
  }
}
