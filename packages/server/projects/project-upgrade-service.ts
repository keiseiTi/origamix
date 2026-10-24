import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ORIGAMIX_VERSION } from '@origamix/shared';
import type { ProjectRepository } from './project-repository';
import { ProjectManifestStore } from './project-manifest-store';
import { ProjectApplyService } from '../schema/project-apply-service';
import { getRetainedWorkingSchemaState } from '../schema/schema-service';
import { readTargetSchema } from '../schema/target-schema-reader';
import { hashSchema } from '../schema/schema-hash';
import { writeFileAtomically } from '../infrastructure/atomic-file';
import { conflict, invalid, notFound } from '../errors';
import {
  readProjectUpgrade,
  writeProjectUpgrade,
  removeProjectUpgrade,
  upgradeFilePath,
  type ProjectUpgradeJournal,
} from './project-upgrade-store';

const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/** Called under ProjectService's project queue. No startup path automatically resumes a mutation. */
export class ProjectUpgradeService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly templatePath: string,
    private readonly afterStage?: (stage: 'pages' | 'package' | 'manifest') => void | Promise<void>,
  ) {}

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

  async upgrade(projectId: string, input: { expectedVersion: string; clientRequestId: string }) {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(input.clientRequestId)) throw invalid('升级请求 ID 无效');
    const project = this.projects.getProject(projectId);
    if (!project || project.status !== 0) throw notFound('项目不存在');
    if (this.projects.hasActiveRuns(projectId)) throw conflict('请先停止项目中的 Agent 再升级');
    const manifests = new ProjectManifestStore();
    const manifestPath = await upgradeFilePath(project.path, 'origamix.project.json');
    const manifestSource = await readFile(manifestPath, 'utf8');
    const manifest = manifests.parseManifest(manifestSource);
    if (manifest.projectId !== projectId) throw invalid('项目清单归属不匹配');
    let journal = await readProjectUpgrade(project.path);
    if (journal && journal.state === 'completed' && journal.requestId !== input.clientRequestId)
      journal = undefined;
    if (
      journal &&
      (journal.projectId !== projectId ||
        journal.requestId !== input.clientRequestId ||
        journal.from !== input.expectedVersion ||
        journal.to !== ORIGAMIX_VERSION)
    )
      throw conflict('请使用原升级请求和对应版本继续，不能替换未完成的升级');
    const packagePath = await upgradeFilePath(project.path, 'package.json');
    const reference = (pageId: string) => {
      const page = this.projects.getPage(projectId, pageId);
      const declared = manifest.pages.find((item) => item.pageId === pageId);
      if (!page || !declared || declared.slug !== page.slug) throw conflict('升级页面清单已变化');
      return {
        projectPath: project.path,
        pageId,
        slug: declared.slug,
        relativePath: join('src', manifest.pageDirectory, declared.slug),
      };
    };
    if (!journal) {
      if (manifest.version !== input.expectedVersion) throw conflict('项目版本已变化，请重新读取');
      const pages: ProjectUpgradeJournal['pages'] = [];
      for (const declared of manifest.pages) {
        let working;
        try {
          working = await getRetainedWorkingSchemaState(reference(declared.pageId));
        } catch {
          throw conflict(`请先打开页面“${declared.name}”并保存升级后的版本`);
        }
        if (
          working.schema.extensions.origamix.schemaVersion !== ORIGAMIX_VERSION ||
          working.workingHash !== working.savedSchemaHash
        )
          throw conflict(`请先打开页面“${declared.name}”并保存升级后的版本`);
        const target = await readTargetSchema(reference(declared.pageId));
        if (![working.baselineHash, working.workingHash].includes(hashSchema(target)))
          throw conflict(`页面“${declared.name}”的项目文件已被外部修改`);
        pages.push({
          pageId: declared.pageId,
          revisionId: working.revisionId,
          workingVersion: working.workingVersion,
          schemaHash: working.workingHash,
          targetHash: hashSchema(target),
        });
      }
      journal = {
        version: 1,
        requestId: input.clientRequestId,
        projectId,
        from: input.expectedVersion,
        to: ORIGAMIX_VERSION,
        state: 'pending',
        pages,
        packageSource: await readFile(await upgradeFilePath(project.path, 'package.json'), 'utf8'),
        manifestSource,
      };
    }
    if (
      journal.pages.length !== manifest.pages.length ||
      new Set(journal.pages.map((page) => page.pageId)).size !== journal.pages.length
    )
      throw conflict('升级页面清单已变化');
    const packageJson = JSON.parse(journal.packageSource) as Record<string, unknown>;
    if (
      !packageJson ||
      Array.isArray(packageJson) ||
      typeof packageJson !== 'object' ||
      !packageJson.dependencies ||
      typeof packageJson.dependencies !== 'object' ||
      Array.isArray(packageJson.dependencies)
    )
      throw invalid('项目 package.json 依赖配置无效');
    const dependencies = { ...packageJson.dependencies } as Record<string, unknown>;
    const artifacts: Array<{ source: Buffer; filename: string }> = [];
    const template = await manifests.readManifest(this.templatePath);
    if (template.version !== ORIGAMIX_VERSION) throw invalid('内置模板版本不匹配');
    for (const kind of ['runtime', 'materials']) {
      const filename = `origamix-${kind}-${ORIGAMIX_VERSION}.tgz`;
      await upgradeFilePath(project.path, 'vendor', filename);
      artifacts.push({
        source: await readFile(join(this.templatePath, 'vendor', `${kind}.tgz`)).catch(() => {
          throw invalid('当前运行环境缺少升级依赖归档，请构建完整桌面应用后重试');
        }),
        filename,
      });
      dependencies[`@origamix/${kind}`] = `file:vendor/${filename}`;
    }
    const nextPackage = json({ ...packageJson, dependencies });
    const originalManifest = JSON.parse(journal.manifestSource) as Record<string, unknown>;
    if (originalManifest.projectId !== projectId) throw invalid('升级记录归属不匹配');
    const nextManifest = json({
      ...originalManifest,
      version: ORIGAMIX_VERSION,
      materialSet: 'official-antd',
    });
    const requireUnchanged = async (
      file: 'package.json' | 'origamix.project.json',
      before: string,
      after: string,
    ) => {
      const actual = await readFile(await upgradeFilePath(project.path, file), 'utf8');
      if (actual !== before && actual !== after)
        throw conflict('项目配置已被外部修改，请恢复升级前配置后使用原请求继续');
    };
    await requireUnchanged('package.json', journal.packageSource, nextPackage);
    await requireUnchanged('origamix.project.json', journal.manifestSource, nextManifest);
    if (journal.state === 'completed') {
      if (
        (await readFile(packagePath, 'utf8')) !== nextPackage ||
        (await readFile(manifestPath, 'utf8')) !== nextManifest
      )
        throw conflict('已完成的升级结果与项目配置不一致');
      return {
        projectId,
        version: ORIGAMIX_VERSION,
        status: 'completed' as const,
        installRequired: true,
      };
    }
    // Freeze normal Working mutations before draining each page queue and applying saved snapshots.
    await writeProjectUpgrade(project.path, journal);
    if (this.projects.hasActiveRuns(projectId))
      throw conflict('Agent 已启动，请停止后使用原请求继续升级');
    for (const page of journal.pages) {
      const working = await getRetainedWorkingSchemaState(reference(page.pageId));
      if (
        working.workingVersion !== page.workingVersion ||
        working.revisionId !== page.revisionId ||
        working.workingHash !== page.schemaHash
      )
        throw conflict('升级计划中的页面已变化，请保留升级记录并检查冲突');
    }
    const apply = new ProjectApplyService(this.projects, undefined, {
      upgradeRequestId: journal.requestId,
    });
    for (const page of journal.pages) {
      await apply.apply(projectId, page.pageId, {
        expectedRevisionId: page.revisionId,
        expectedWorkingVersion: page.workingVersion,
        clientRequestId: `upgrade_${digest(`${journal.requestId}:${page.pageId}`).slice(0, 32)}`,
      });
    }
    await this.afterStage?.('pages');
    for (const page of journal.pages) {
      if (hashSchema(await readTargetSchema(reference(page.pageId))) !== page.schemaHash)
        throw conflict('升级期间目标页面被外部修改，请检查后重试');
    }
    for (const artifact of artifacts) {
      const artifactPath = await upgradeFilePath(project.path, 'vendor', artifact.filename);
      await mkdir(dirname(artifactPath), { recursive: true });
      await upgradeFilePath(project.path, 'vendor', artifact.filename);
      try {
        if (!(await readFile(artifactPath)).equals(artifact.source))
          throw conflict('目标版本依赖归档已存在但内容不一致');
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
        await writeFileAtomically(
          await upgradeFilePath(project.path, 'vendor', artifact.filename),
          artifact.source,
        );
      }
    }
    await requireUnchanged('package.json', journal.packageSource, nextPackage);
    await writeFileAtomically(await upgradeFilePath(project.path, 'package.json'), nextPackage);
    await this.afterStage?.('package');
    await requireUnchanged('origamix.project.json', journal.manifestSource, nextManifest);
    await writeFileAtomically(
      await upgradeFilePath(project.path, 'origamix.project.json'),
      nextManifest,
    );
    await this.afterStage?.('manifest');
    await writeProjectUpgrade(project.path, { ...journal, state: 'completed' });
    return {
      projectId,
      version: ORIGAMIX_VERSION,
      status: 'completed' as const,
      installRequired: true,
    };
  }
}
