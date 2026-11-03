import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BUILTIN_PROJECT_STACK,
  SCHEMA_VERSION,
  projectStackCompatibilityIssue,
  resolveProjectStack,
  type ProjectUpgradeRequest,
  type ProjectUpgradeState,
} from '@origamix/shared';
import type { ProjectRepository } from './project-repository';
import { ProjectManifestStore } from './project-manifest-store';
import { readTargetSchema } from '../schema/target-schema-reader';
import { inspectPageSchemaCompatibility } from '../schema/schema-service';
import { hashSchema } from '../schema/schema-hash';
import { writeFileAtomically } from '../infrastructure/atomic-file';
import { conflict, invalid, notFound } from '../errors';
import {
  readProjectUpgrade,
  removeProjectUpgrade,
  upgradeFilePath,
  assertProjectNotUpgrading,
} from './project-upgrade-store';
const digest = (value: string): string => createHash('sha256').update(value).digest('hex');

/** Configuration conversion only. No page migrations or package dependency switching. */
export class ProjectUpgradeService {
  constructor(private readonly projects: ProjectRepository) {}
  async cancel(projectId: string, requestId: string) {
    const project = this.projects.getProject(projectId);
    if (!project || project.status !== 0) throw notFound('项目不存在');
    const journal = await readProjectUpgrade(project.path);
    if (
      !journal ||
      journal.projectId !== projectId ||
      journal.requestId !== requestId ||
      journal.state !== 'pending'
    )
      throw conflict('没有匹配的待处理升级');
    const manifest = await new ProjectManifestStore().readManifest(project.path);
    if (manifest.projectId !== projectId) throw invalid('项目归属不匹配');
    if (
      (await readFile(await upgradeFilePath(project.path, 'package.json'), 'utf8')) !==
        journal.packageSource ||
      (await readFile(await upgradeFilePath(project.path, 'origamix.project.json'), 'utf8')) !==
        journal.manifestSource
    )
      throw conflict('升级已修改项目配置，请使用原请求继续');
    for (const page of journal.pages) {
      const declared = manifest.pages.find((item) => item.pageId === page.pageId);
      if (
        !declared ||
        hashSchema(
          await readTargetSchema({
            projectPath: project.path,
            pageId: page.pageId,
            slug: declared.slug,
            relativePath: join('src', manifest.pageDirectory, declared.slug),
          }),
        ) !== page.targetHash
      )
        throw conflict('升级已修改目标页面，请使用原请求继续');
    }
    await removeProjectUpgrade(project.path);
    return { cancelled: true as const };
  }

  async inspect(projectId: string): Promise<ProjectUpgradeState> {
    const project = this.projects.getProject(projectId);
    if (!project || project.status !== 0) throw notFound('项目不存在');
    const manifests = new ProjectManifestStore();
    await upgradeFilePath(project.path, 'origamix.project.json');
    const source = await manifests.readSource(project.path);
    const manifest = manifests.parseManifest(source);
    if (manifest.projectId !== projectId) throw invalid('项目清单归属不匹配');
    const issues: string[] = [];
    const stackIssue = projectStackCompatibilityIssue(resolveProjectStack(manifest));
    if (stackIssue) issues.push(stackIssue);
    const upgrade = await readProjectUpgrade(project.path);
    if (upgrade?.state === 'pending')
      issues.push(
        '旧版项目升级尚未完成，请使用原应用恢复；本应用不会继续旧版升级。仅在文件未改变时可撤销。',
      );
    const pages: ProjectUpgradeState['pages'] = [];
    for (const declared of manifest.pages) {
      const ref = {
        projectPath: project.path,
        pageId: declared.pageId,
        slug: declared.slug,
        relativePath: join('src', manifest.pageDirectory, declared.slug),
      };
      const { schemaVersion, issue } = await inspectPageSchemaCompatibility(ref);
      if (issue) issues.push(`${declared.name}：${issue}`);
      pages.push({ pageId: declared.pageId, name: declared.name, schemaVersion, issue });
    }
    const legacyVersion = manifests.legacyVersion(source);
    return {
      status: issues.length
        ? 'blocked'
        : legacyVersion
          ? 'configuration_conversion_required'
          : 'compatible',
      materialSet: manifest.materialSet,
      supportedMaterialSet: { ...BUILTIN_PROJECT_STACK.materialSet },
      schemaVersion: SCHEMA_VERSION,
      legacyVersion,
      manifestHash: digest(source),
      issues,
      pages,
      upgrade: upgrade
        ? { requestId: upgrade.requestId, from: upgrade.from, to: upgrade.to, state: upgrade.state }
        : null,
    };
  }

  async upgrade(projectId: string, input: ProjectUpgradeRequest) {
    const project = this.projects.getProject(projectId);
    if (!project || project.status !== 0) throw notFound('项目不存在');
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(input.clientRequestId)) throw invalid('转换请求 ID 无效');
    if (this.projects.hasActiveRuns(projectId)) throw conflict('请先停止项目中的 Agent');
    await assertProjectNotUpgrading(project.path);
    const state = await this.inspect(projectId);
    if (state.status === 'blocked') throw conflict(state.issues.join('；'));
    if (input.expectedVersion !== '1.0.0' || !/^[a-f0-9]{64}$/.test(input.expectedManifestHash))
      throw invalid('配置转换来源无效');
    const result = { projectId, status: 'completed' as const, installRequired: false as const };
    if (!state.legacyVersion) return result;
    if (state.manifestHash !== input.expectedManifestHash)
      throw conflict('项目配置已变化，请重新检查');
    const path = await upgradeFilePath(project.path, 'origamix.project.json');
    const source = await readFile(path, 'utf8');
    if (digest(source) !== input.expectedManifestHash) throw conflict('项目配置已被外部修改');
    const manifest = new ProjectManifestStore().parseManifest(source);
    await writeFileAtomically(path, `${JSON.stringify(manifest, null, 2)}\n`);
    return result;
  }
}
