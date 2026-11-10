import { readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import {
  isPageSchema,
  isLayoutDocument,
  isProjectLayoutEnabled,
  resolveProjectStack,
  type ProjectPreviewSnapshot,
} from '@origamix/shared';
import type { ProjectRepository } from '../projects/project-repository';
import { ProjectManifestStore } from '../projects/project-manifest-store';
import { withProjectActivity } from '../projects/project-activity';
import { projectFilePath } from '../infrastructure/project-path';
import { validateWritableSchema } from '../schema/validation/schema-validation';
import { assertAppliedLayoutSchema, loadLayoutMaterials } from '../projects/project-materials';
import { validatePageAgainstMaterials } from '../schema/validation/material-validation';
import { conflict, invalid, notFound } from '../errors';

const mime: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
};
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Read only the authorized managed projection. No Working initialization, migration or target writes. */
export class ProjectSnapshotReader {
  constructor(private readonly projects: Pick<ProjectRepository, 'getProject'>) {}

  assertEnabled = async (projectId: string) => {
    const project = this.projects.getProject(projectId);
    if (!project || project.status !== 0) throw notFound('项目不存在或不可用');
    if ((await lstat(project.path)).isSymbolicLink()) throw invalid('项目目录不能是符号链接');
    await projectFilePath(project.path, 'origamix.project.json');
    const manifest = await new ProjectManifestStore().requireEditable(project.path);
    if (manifest.projectId !== projectId) throw invalid('项目清单归属无效');
    if (!isProjectLayoutEnabled(manifest))
      throw conflict('项目预览仅支持已开启布局的 Origamix 应用');
    resolveProjectStack(manifest);
    return { project, manifest };
  };

  read = async (projectId: string): Promise<ProjectPreviewSnapshot> => {
    const initial = await this.assertEnabled(projectId);
    return withProjectActivity(initial.project.path, async () => {
      const { project, manifest } = await this.assertEnabled(projectId);
      const sources = new Map<string, string>();
      const readJson = async (...segments: string[]) => {
        try {
          const path = await projectFilePath(project.path, ...segments);
          const source = await readFile(path, 'utf8');
          sources.set(path, source);
          return JSON.parse(source);
        } catch (error) {
          if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
            throw conflict(`缺少已应用文件：${segments.join('/')}，请先应用到项目`);
          throw error;
        }
      };
      const layout: unknown = await readJson('src', 'origamix-layout', 'schema.json');
      if (!isLayoutDocument(layout) || layout.projectId !== projectId)
        throw invalid('已应用布局无效或归属不匹配');
      assertAppliedLayoutSchema(layout.schema);
      const validation = await loadLayoutMaterials(project.path);
      const checked = validatePageAgainstMaterials(
        layout.schema,
        [manifest.materialSet],
        validation.validation,
      );
      if (!checked.valid) throw invalid('已应用布局包含无效物料或属性');
      const pageSchemas: ProjectPreviewSnapshot['pageSchemas'] = {};
      // Only inspect existing draft bytes, never call services that initialize or recover Working.
      const differs = async (segments: string[], target: unknown, field: string) => {
        try {
          const retained = JSON.parse(
            await readFile(await projectFilePath(project.path, ...segments), 'utf8'),
          );
          return digest(retained[field]) !== digest(target);
        } catch (error) {
          if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
          throw invalid('保留草稿无法读取，请先恢复项目后再预览');
        }
      };
      let hasUnappliedChanges = await differs(
        ['.origamix', 'layout', 'working.json'],
        layout,
        'document',
      );
      let total = 0;
      const assets = new Map<string, string>();
      const image = async (value: unknown, base: string[]): Promise<unknown> => {
        if (
          typeof value !== 'string' ||
          /^(?:https?:|data:|#)/i.test(value) ||
          !mime[extname(value).toLowerCase()]
        )
          return value;
        if (value.includes('\\') || value.includes('?') || value.split('/').includes('..'))
          throw invalid('静态资源路径无效');
        const segments = value.startsWith('/')
          ? ['public', ...value.slice(1).split('/')]
          : [...base, ...value.replace(/^\.\//, '').split('/')];
        const key = segments.join('/');
        if (assets.has(key)) return assets.get(key)!;
        const bytes = await readFile(await projectFilePath(project.path, ...segments)).catch(
          (error: unknown) => {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
              throw conflict(`缺少预览图片：${value}，请检查已应用的资源路径`);
            throw error;
          },
        );
        total += bytes.length;
        if (bytes.length > 2 * 1024 * 1024 || total > 20 * 1024 * 1024)
          throw invalid('预览图片超过大小限制（单张 2MB，合计 20MB）');
        const url = `data:${mime[extname(value).toLowerCase()]};base64,${bytes.toString('base64')}`;
        assets.set(key, url);
        return url;
      };
      const resources = async (
        schema: ProjectPreviewSnapshot['pageSchemas'][string],
        base: string[],
      ) => {
        const copy = structuredClone(schema);
        for (const element of Object.values(copy.elements)) {
          const fields = [element.props, element.props.config, element.props.regionConfig];
          for (const fieldsValue of fields) {
            if (!fieldsValue || typeof fieldsValue !== 'object' || Array.isArray(fieldsValue))
              continue;
            const props = fieldsValue as Record<string, unknown>;
            for (const key of ['src', 'logo'])
              if (Object.hasOwn(props, key)) props[key] = await image(props[key], base);
          }
        }
        return copy;
      };
      for (const page of manifest.pages) {
        const schema: unknown = await readJson(
          'src',
          ...manifest.pageDirectory.split('/'),
          page.slug,
          'schema.json',
        );
        if (!isPageSchema(schema)) throw invalid(`页面 ${page.name} 的已应用 Schema 无效`);
        await validateWritableSchema(
          { projectPath: project.path, pageId: page.pageId, slug: page.slug },
          schema,
        );
        hasUnappliedChanges ||= await differs(
          ['.origamix', 'pages', page.pageId, 'working.json'],
          schema,
          'schema',
        );
        pageSchemas[page.pageId] = (await resources(schema, [
          'src',
          ...manifest.pageDirectory.split('/'),
          page.slug,
        ])) as typeof schema;
      }
      const resolvedLayout = {
        ...layout,
        schema: await resources(layout.schema, ['src', 'origamix-layout']),
      };
      // Detect external manifest edits during the snapshot instead of publishing mixed configuration.
      if (digest(await new ProjectManifestStore().readManifest(project.path)) !== digest(manifest))
        throw conflict('项目配置在读取期间变化，请重试');
      for (const [path, source] of sources)
        if ((await readFile(path, 'utf8')) !== source)
          throw conflict('项目内容在读取期间变化，请重试');
      const {
        runtime,
        projectId: id,
        name,
        framework,
        materialSet,
        pageDirectory,
        pages,
        layout: layoutConfig,
        routing,
        pageRoles,
        applicationState,
        access,
      } = manifest;
      const safeManifest = {
        runtime,
        projectId: id,
        name,
        framework,
        materialSet,
        pageDirectory,
        pages,
        layout: layoutConfig,
        routing,
        ...(pageRoles ? { pageRoles } : {}),
        ...(applicationState ? { applicationState } : {}),
        ...(access ? { access } : {}),
      };
      const content = {
        projectId,
        name: manifest.name,
        manifest: safeManifest,
        layout: resolvedLayout,
        pageSchemas,
      };
      return { ...content, snapshotId: digest(content), hasUnappliedChanges };
    });
  };
}
