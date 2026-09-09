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
  type SchemaPageRef,
} from './schema-service';
import { validateProjectPageAgainstMaterials } from './schema-material-validation';

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
  constructor(private readonly projects: ProjectRepository) {}

  private resolve(projectId: string, pageId: string): { page: SchemaPageRef; target: string } {
    const project = this.projects.getProject(projectId);
    const record = this.projects.getPage(projectId, pageId);
    if (!project || !record) throw notFound('页面不存在');
    const page = { projectPath: project.path, pageId: record.id, slug: record.slug };
    return { page, target: join(project.path, record.relativePath, 'schema.json') };
  }

  async getState(projectId: string, pageId: string): Promise<PageApplyState> {
    const { page, target } = this.resolve(projectId, pageId);
    const working = await getWorkingSchemaState(page);
    const targetSchema = await readJson<OrigamixPageSchema>(target);
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

  async apply(
    projectId: string,
    pageId: string,
    input: { expectedRevisionId: string; clientRequestId: string },
  ): Promise<ApplyPageResult> {
    const { page, target } = this.resolve(projectId, pageId);
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
      return {
        pageId: receipt.pageId,
        revisionId: receipt.revisionId,
        schemaHash: receipt.schemaHash,
        appliedAt: receipt.appliedAt,
        status: receipt.status,
      };
    }
    return applyWorkingSchemaOperation(page, input.expectedRevisionId, async (working) => {
      const targetSchema = await readJson<OrigamixPageSchema>(target);
      const targetHash = hashSchema(targetSchema);
      if (targetHash !== working.baselineHash && targetHash !== working.schemaHash)
        throw conflict('项目文件已变化，请重新读取后再应用');
      const validation = await validateProjectPageAgainstMaterials(
        page.projectPath,
        working.schema,
      );
      if (!validation.valid) throw invalid(validation.errors[0]?.message ?? 'Schema 物料校验失败');
      if (targetHash !== working.schemaHash) await writeJsonAtomically(target, working.schema);
      const verified = await readJson<OrigamixPageSchema>(target);
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
