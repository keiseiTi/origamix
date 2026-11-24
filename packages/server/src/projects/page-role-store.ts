import { createHash } from 'node:crypto';
import { Check } from '@sinclair/typebox/value';
import {
  type PageRoleState,
  type UpdatePageRoles,
  emptyPageRoles,
  arePageRolesValid,
  UpdatePageRolesSchema,
} from '@origamix/shared';
import { conflict, invalid } from '../errors';
import { ProjectManifestStore } from './project-manifest-store';

export const manifestHash = (source: string): string =>
  createHash('sha256').update(source).digest('hex');
/** Called only under ProjectService's project queue/activity ownership. */
export class PageRoleStore {
  private readonly manifests = new ProjectManifestStore();
  async read(path: string, projectId: string): Promise<PageRoleState> {
    const source = await this.manifests.readSource(path);
    const manifest = this.manifests.parseManifest(source);
    if (manifest.projectId !== projectId) throw invalid('项目清单归属无效');
    return {
      roles: manifest.pageRoles ?? emptyPageRoles(),
      pages: manifest.pages.map(({ pageId, name }) => ({ pageId, name })),
    };
  }
  async update(path: string, input: UpdatePageRoles): Promise<PageRoleState> {
    if (!Check(UpdatePageRolesSchema, input)) throw invalid('页面角色配置无效');
    await this.manifests.requireEditable(path);
    const source = await this.manifests.readSource(path);
    const manifest = this.manifests.parseManifest(source);
    if (manifest.projectId !== input.projectId) throw invalid('项目归属无效');
    const currentHash = manifestHash(source);
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
    if (manifestHash(await this.manifests.readSource(path)) !== currentHash)
      throw conflict('项目配置已被外部修改');
    await this.manifests.writeManifest(path, candidate, source);
    return this.read(path, input.projectId);
  }
}
