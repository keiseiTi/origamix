import { isApplicationSnapshot, type ApplicationSnapshot } from '@origamix/shared';
import { projectsService } from '@/services/projects';
import { schemaService } from '@/services/schema';
import { layoutService } from '@/services/layout';

/** Host-only read orchestration; no credentials or file paths cross into the iframe. */
export const loadApplicationSnapshot = async (
  projectId: string,
  initialPageId: string | null,
  theme: 'light' | 'dark',
): Promise<ApplicationSnapshot> => {
  const [records, stack, config] = await Promise.all([
    projectsService
      .pages(projectId)
      .then((pages) => (initialPageId ? pages.filter((page) => page.id === initialPageId) : [])),
    projectsService.stack(projectId),
    initialPageId ? Promise.resolve({ enabled: false }) : layoutService.config(projectId),
  ]);
  if (records.some((page) => page.projectId !== projectId))
    throw new Error('预览页面不属于当前项目');
  const [states, layout] = await Promise.all([
    Promise.all(records.map((page) => schemaService.workingState(projectId, page.id))),
    initialPageId === null && config.enabled ? layoutService.workingState(projectId) : null,
  ]);
  if (layout && layout.document.projectId !== projectId) throw new Error('预览布局不属于当前项目');
  const pages = records.map((page) => ({
    pageId: page.id,
    name: page.name,
    path: page.slug === 'home' ? '/' : `/${page.slug}`,
  }));
  const snapshot: ApplicationSnapshot = {
    version: '1',
    snapshotId: crypto.randomUUID(),
    source: 'working',
    stack,
    theme,
    initialPageId:
      initialPageId ?? pages.find((page) => page.path === '/')?.pageId ?? pages[0]?.pageId ?? null,
    pages,
    layout: layout
      ? {
          enabled: true,
          document: layout.document,
          hash: layout.workingHash,
          workingVersion: layout.workingVersion,
          revisionId: layout.revisionId,
        }
      : { enabled: false },
    pageSchemas: Object.fromEntries(
      records.map((page, index) => {
        const state = states[index]!;
        return [
          page.id,
          {
            schema: state.schema,
            hash: state.workingHash,
            workingVersion: state.workingVersion,
            revisionId: state.revisionId,
          },
        ];
      }),
    ),
  };
  if (!isApplicationSnapshot(snapshot)) throw new Error('应用预览数据无效，请刷新项目后重试');
  return snapshot;
};
