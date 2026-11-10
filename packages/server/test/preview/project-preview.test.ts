import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it, expect } from 'vitest';
import { createEmptyLayoutDocument, isProjectPreviewSnapshot } from '@origamix/shared';
import { createAntdLayoutSchema } from '@origamix/materials/antd/layout/manifest';
import { ProjectSnapshotReader } from '../../src/preview/project-snapshot';
import { ProjectPreviewService } from '../../src/preview/project-preview-service';
import { createInitialPageSchema } from '../../src/projects/initial-page-schema';

// This new read boundary must prove draft isolation, resource confinement and session revocation.
it('previews only applied files through a project-scoped revocable cookie session', async () => {
  const path = await mkdtemp(join(tmpdir(), 'origamix-project-preview-'));
  const projectPath = join(path, 'project');
  const assets = join(path, 'built-in');
  await mkdir(join(projectPath, 'src/pages/home'), { recursive: true });
  await mkdir(join(projectPath, 'src/origamix-layout'), { recursive: true });
  await mkdir(join(projectPath, '.origamix/pages/page_home'), { recursive: true });
  await mkdir(assets);
  await writeFile(
    join(assets, 'index.html'),
    '<html><head></head><body>Built-in only</body></html>',
  );
  const manifest = {
    projectId: 'project_test',
    name: '测试项目',
    runtime: 'origamix',
    framework: 'react',
    materialSet: { id: 'official-antd', version: '1.0.0' },
    pageDirectory: 'pages',
    pages: [{ pageId: 'page_home', name: '首页', slug: 'home' }],
    layout: { enabled: true, initialVariant: 'side' },
    routing: { mode: 'browser', basePath: '/admin/' },
  };
  const manifestPath = join(projectPath, 'origamix.project.json');
  const writeManifest = (value: unknown) => writeFile(manifestPath, JSON.stringify(value));
  await writeManifest(manifest);
  const layout = {
    ...createEmptyLayoutDocument('project_test'),
    schema: createAntdLayoutSchema({ title: '已应用' }),
  };
  const target = join(projectPath, 'src/origamix-layout/schema.json');
  await writeFile(target, JSON.stringify(layout));
  const schema = createInitialPageSchema();
  await writeFile(join(projectPath, 'src/pages/home/schema.json'), JSON.stringify(schema));
  await writeFile(
    join(projectPath, '.origamix/pages/page_home/working.json'),
    JSON.stringify({
      schema: {
        ...schema,
        elements: { ...schema.elements, draftOnly: { type: 'text', props: { text: '不得泄漏' } } },
      },
    }),
  );
  const projects = {
    getProject: (id: string) =>
      id === 'project_test'
        ? { id, path: projectPath, status: 0, name: '测试项目', createdAt: '', lastOpenedAt: '' }
        : undefined,
  };
  const reader = new ProjectSnapshotReader(projects);
  const service = new ProjectPreviewService(projects, assets);
  try {
    const snapshot = await reader.read('project_test');
    expect(isProjectPreviewSnapshot(snapshot)).toBe(true);
    expect(snapshot.hasUnappliedChanges).toBe(true);
    expect(snapshot.pageSchemas.page_home).toEqual(schema);
    expect(JSON.stringify(snapshot)).not.toContain('不得泄漏');
    expect(await readFile(target, 'utf8')).toBe(JSON.stringify(layout));
    await expect(reader.read('project_other')).rejects.toThrow('不存在');
    const launch = await service.open('project_test');
    const origin = new URL(launch.url).origin;
    const headers = { Cookie: `origamix_preview=${launch.cookie}` };
    expect((await fetch(`${origin}/__origamix/snapshot`)).status).toBe(401);
    expect(
      (
        await fetch(`${origin}/__origamix/snapshot`, {
          headers: { ...headers, Origin: 'https://untrusted.example' },
        })
      ).status,
    ).toBe(403);
    expect(await (await fetch(`${origin}/__origamix/snapshot`, { headers })).json()).toEqual(
      snapshot,
    );
    expect((await fetch(`${origin}/admin/role-manage`, { headers })).status).toBe(200);
    expect(
      (await fetch(`${origin}/.origamix/pages/page_home/working.json`, { headers })).headers.get(
        'content-type',
      ),
    ).toContain('text/html');
    await expect(
      service.status({ sessionId: launch.sessionId, projectId: 'project_other' }),
    ).rejects.toThrow('不存在');
    await writeFile(
      target,
      JSON.stringify({ ...layout, schema: createAntdLayoutSchema({ title: '新应用' }) }),
    );
    expect(
      (await (await fetch(`${origin}/__origamix/snapshot`, { headers })).json()).snapshotId,
    ).toBe(snapshot.snapshotId);
    expect((await (await fetch(`${origin}/__origamix/status`, { headers })).json()).updated).toBe(
      true,
    );
    expect(
      (await (await fetch(`${origin}/__origamix/refresh`, { headers })).json()).snapshotId,
    ).not.toBe(snapshot.snapshotId);
    await writeManifest({ ...manifest, layout: { ...manifest.layout, enabled: false } });
    expect(await service.status(launch)).toEqual({ active: false });
    await expect(fetch(`${origin}/__origamix/snapshot`, { headers })).rejects.toThrow();
    await writeManifest({ ...manifest, runtime: 'external' });
    await expect(reader.read('project_test')).rejects.toThrow('仅支持');
    await writeManifest({ ...manifest, authentication: { enabled: true } });
    await expect(reader.read('project_test')).rejects.toThrow('字段无效');
    await writeManifest(manifest);
    await writeFile(
      target,
      JSON.stringify({ ...layout, schema: createAntdLayoutSchema({ logo: '/logo.png' }) }),
    );
    await expect(reader.read('project_test')).rejects.toThrow('缺少预览图片');
    await mkdir(join(projectPath, 'public'));
    await writeFile(join(projectPath, 'public/logo.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
    const withImage = await reader.read('project_test');
    expect(withImage.layout.schema.elements.layout!.props.logo).toMatch(/^data:image\/png;base64,/);
    await rm(join(projectPath, 'public/logo.png'));
    await symlink(join(path, 'private.png'), join(projectPath, 'public/logo.png'));
    await writeFile(join(path, 'private.png'), 'private bytes');
    await expect(reader.read('project_test')).rejects.toThrow('符号链接');
    await rm(target);
    await expect(reader.read('project_test')).rejects.toThrow('请先应用');
    await symlink(join(path, 'private.json'), target);
    await writeFile(join(path, 'private.json'), JSON.stringify(layout));
    await expect(reader.read('project_test')).rejects.toThrow('符号链接');
  } finally {
    await service.close();
    await rm(path, { recursive: true, force: true });
  }
});
