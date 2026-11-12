import { createHttpServer } from '../../src/http/server';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it, vi } from 'vitest';
import type { ProjectSettingsAgentEvent } from '@origamix/shared';
import { ApplicationDatabase } from '../../src/database/database';
import { ProjectRepository } from '../../src/projects/project-repository';
import { ProjectService } from '../../src/projects/project-service';
import { ProjectSettingsAgentService } from '../../src/agent/project-settings-agent-service';
import { FakeAgentEngine } from '../fixtures/fake-agent-engine';
import { getWorkingSchemaState } from '../../src/schema/schema-service';

// Page Agent commit tests cannot prove that configuration proposals have no project/page write tools.
it('validates scoped configuration proposals without writing manifest or Working, rejects stale files and drains cancellation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'origamix-settings-agent-'));
  const database = new ApplicationDatabase(join(directory, 'state.db'));
  let assistant: ProjectSettingsAgentService | undefined;
  let http: ReturnType<typeof createHttpServer> | undefined;
  try {
    const projects = new ProjectRepository(database);
    const service = new ProjectService(
      projects,
      fileURLToPath(new URL('../../../template', import.meta.url)),
    );
    service.registerGrant('grant', directory);
    const project = await service.createProject({
      directoryGrantId: 'grant',
      name: 'Settings',
      code: 'settings',
      layoutEnabled: true,
    });
    const page = await service.createPage(project.id, { name: 'Home', slug: 'home' });
    const settings = await service.getSettings(project.id);
    const manifestPath = join(project.path, 'origamix.project.json');
    const manifest = await readFile(manifestPath, 'utf8');
    const pageRef = { projectPath: project.path, pageId: page.id, slug: page.slug };
    const working = await getWorkingSchemaState(pageRef);
    const calls = vi.fn();
    const engine = new FakeAgentEngine(async (request) => {
      calls();
      expect(request.tools?.map((tool) => tool.name)).toEqual([
        'get_project_settings',
        'complete_project_settings',
      ]);
      const complete = request.tools![1]!;
      const draft = {
        shell: { ...settings.shell, title: '管理中心', homePageId: page.id },
        layout: settings.layout,
        routing: settings.routing,
      };
      await expect(
        complete.execute(
          {
            summary: 'bad',
            draft: { ...draft, shell: { ...draft.shell, homePageId: 'page_foreign' } },
          },
          request.signal!,
        ),
      ).rejects.toThrow('页面不存在');
      await expect(
        complete.execute(
          {
            summary: 'bad',
            draft: { ...draft, shell: { ...draft.shell, logo: 'javascript:alert(1)' } },
          },
          request.signal!,
        ),
      ).rejects.toThrow('Logo');
      await complete.execute({ summary: '标题已修改，尚未保存', draft }, request.signal!);
      await expect(complete.execute({ summary: 'again' }, request.signal!)).rejects.toThrow(
        '已提交',
      );
      return { text: '', usage: { inputTokens: 0, outputTokens: 1, totalTokens: 1 } };
    });
    assistant = new ProjectSettingsAgentService({
      projects: service,
      engine,
      getModelRef: async () => 'fake/deterministic',
    });
    const input = {
      projectId: project.id,
      expectedManifestHash: settings.manifestHash,
      draftVersion: 4,
      draft: { shell: settings.shell, layout: settings.layout, routing: settings.routing },
      prompt: '修改标题',
      history: [],
    };
    const events: ProjectSettingsAgentEvent[] = [];
    http = createHttpServer({
      projects,
      projectService: service,
      settingsAgent: assistant,
      desktopToken: 'settings-test-token',
      serviceInstanceId: 'settings-test-service',
    });
    const unauthorized = await http.inject({
      method: 'POST',
      url: '/api/v1/projects/settings/assist',
      payload: input,
    });
    expect(unauthorized.statusCode).toBe(401);
    expect(calls).not.toHaveBeenCalled();
    const response = await http.inject({
      method: 'POST',
      url: '/api/v1/projects/settings/assist',
      payload: input,
      headers: {
        authorization: 'Bearer settings-test-token',
        'x-origamix-service': 'settings-test-service',
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/x-ndjson');
    events.push(
      ...response.body
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as ProjectSettingsAgentEvent),
    );
    expect(events.at(-1)).toMatchObject({
      type: 'completed',
      projectId: project.id,
      draftVersion: 4,
      draft: { shell: { title: '管理中心' } },
    });
    expect(await readFile(manifestPath, 'utf8')).toBe(manifest);
    expect(await getWorkingSchemaState(pageRef)).toEqual(working);
    await assistant.run(
      { ...input, projectId: 'project_foreign' },
      new AbortController().signal,
      (event) => events.push(event),
    );
    expect(events.at(-1)).toMatchObject({ type: 'failed' });
    await service.updateSettings({
      ...input.draft,
      projectId: project.id,
      expectedManifestHash: settings.manifestHash,
      shell: { ...settings.shell, title: '外部修改' },
    });
    await assistant.run(input, new AbortController().signal, (event) => events.push(event));
    expect(events.at(-1)).toMatchObject({
      type: 'failed',
      message: expect.stringContaining('已变化'),
    });
    expect(calls).toHaveBeenCalledTimes(1);
    const latest = await service.getSettings(project.id);
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    assistant = new ProjectSettingsAgentService({
      projects: service,
      getModelRef: async () => 'fake/deterministic',
      engine: new FakeAgentEngine(async (request) => {
        started();
        await new Promise<void>((resolve) =>
          request.signal!.addEventListener('abort', () => resolve(), { once: true }),
        );
        return { text: '', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } };
      }),
    });
    const pending = assistant.run(
      { ...input, expectedManifestHash: latest.manifestHash },
      new AbortController().signal,
      (event) => events.push(event),
    );
    await ready;
    await assistant.shutdown();
    await pending;
    expect(events.at(-1)).toMatchObject({
      type: 'failed',
      message: expect.stringContaining('已停止'),
    });
    expect((await service.getSettings(project.id)).shell.title).toBe('外部修改');
  } finally {
    await assistant?.shutdown();
    await http?.close();
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
