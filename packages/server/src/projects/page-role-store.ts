import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Check } from '@sinclair/typebox/value';
import { Type } from '@sinclair/typebox';
import {
  type PageRoleState,
  type UpdatePageRoles,
  emptyPageRoles,
  arePageRolesValid,
  UpdatePageRolesSchema,
} from '@origamix/shared';
import { metadataPath } from '../schema/metadata-path';
import { writeFileAtomically } from '../infrastructure/atomic-file';
import { conflict, invalid } from '../errors';
import { ProjectManifestStore } from './project-manifest-store';

export const manifestHash = (source: string): string =>
  createHash('sha256').update(source).digest('hex');
const ReceiptSchema = Type.Object(
  {
    request: UpdatePageRolesSchema,
    digest: Type.String(),
    beforeHash: Type.String(),
    afterHash: Type.String(),
    state: Type.Union([Type.Literal('prepared'), Type.Literal('committed')]),
  },
  { additionalProperties: false },
);
type Receipt = import('@sinclair/typebox').Static<typeof ReceiptSchema>;
/** Called only under ProjectService's project queue/activity ownership. */
export class PageRoleStore {
  private readonly manifests = new ProjectManifestStore();
  async read(path: string, projectId: string): Promise<PageRoleState> {
    const source = await this.manifests.readSource(path);
    const manifest = this.manifests.parseManifest(source);
    if (manifest.projectId !== projectId) throw invalid('项目清单归属无效');
    return {
      roles: manifest.pageRoles ?? emptyPageRoles(),
      manifestHash: manifestHash(source),
      pages: manifest.pages.map(({ pageId, name }) => ({ pageId, name })),
    };
  }
  async update(path: string, input: UpdatePageRoles): Promise<PageRoleState> {
    if (!Check(UpdatePageRolesSchema, input)) throw invalid('页面角色配置无效');
    const file = await metadataPath(path, 'project-roles', `${input.clientRequestId}.json`);
    const digest = manifestHash(JSON.stringify(input));
    let receipt: Receipt | undefined;
    try {
      const value: unknown = JSON.parse(await readFile(file, 'utf8'));
      if (!Check(ReceiptSchema, value)) throw conflict('角色提交记录无效，请检查项目内部数据');
      receipt = value;
      if (receipt.request.projectId !== input.projectId || receipt.digest !== digest)
        throw conflict('请求标识已用于其他角色操作');
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    await this.manifests.requireEditable(path);
    const source = await this.manifests.readSource(path);
    const manifest = this.manifests.parseManifest(source);
    if (manifest.projectId !== input.projectId) throw invalid('项目归属无效');
    const currentHash = manifestHash(source);
    if (receipt?.state === 'committed') return this.read(path, input.projectId);
    if (receipt && currentHash === receipt.afterHash) {
      await writeFileAtomically(file, JSON.stringify({ ...receipt, state: 'committed' }));
      return this.read(path, input.projectId);
    }
    if (currentHash !== input.expectedManifestHash)
      throw conflict('项目配置已变化，请刷新并重新确认');
    if (!arePageRolesValid(input.roles, manifest.pages))
      throw invalid('角色或页面关联无效：角色与页面必须一一对应');
    if (
      input.page &&
      (!input.page.name.trim() ||
        !manifest.pages.some((page) => page.pageId === input.page!.pageId))
    )
      throw invalid('页面名称或归属无效');
    const candidate = {
      ...manifest,
      pageRoles: input.roles,
      pages: manifest.pages.map((page) =>
        page.pageId === input.page?.pageId ? { ...page, name: input.page.name.trim() } : page,
      ),
    };
    const afterHash = manifestHash(`${JSON.stringify(candidate, null, 2)}\n`);
    if (receipt && receipt.afterHash !== afterHash) throw conflict('角色提交内容已变化');
    receipt ??= { request: input, digest, beforeHash: currentHash, afterHash, state: 'prepared' };
    await mkdir(dirname(file), { recursive: true });
    await writeFileAtomically(file, JSON.stringify(receipt));
    // Check again immediately before the sole manifest writer; external edits are never silently imported.
    if (manifestHash(await this.manifests.readSource(path)) !== currentHash)
      throw conflict('项目配置已被外部修改');
    await this.manifests.writeManifest(path, candidate);
    await writeFileAtomically(file, JSON.stringify({ ...receipt, state: 'committed' }));
    return this.read(path, input.projectId);
  }
}
