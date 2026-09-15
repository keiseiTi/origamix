import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApplicationDatabase } from '../database/database';
import { ProjectRepository } from '../projects/project-repository';
import { RuntimeDiagnosticCache } from './diagnostic-cache';
import { RuntimeDiagnosticService } from './diagnostic-service';

let directory: string;
let database: ApplicationDatabase;
let revisionId: string;
let service: RuntimeDiagnosticService;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'origamix-runtime-diagnostic-'));
  database = new ApplicationDatabase(join(directory, 'app.db'));
  const projects = new ProjectRepository(database);
  const now = new Date().toISOString();
  projects.reconcile(
    {
      id: 'project_one',
      path: directory,
      name: 'Test',
      status: 0,
      createdAt: now,
      lastOpenedAt: now,
    },
    [
      {
        id: 'page_one',
        projectId: 'project_one',
        slug: 'one',
        name: 'One',
        relativePath: 'src/pages/one',
        status: 0,
        createdAt: now,
        updatedAt: now,
      },
    ],
  );
  revisionId = 'revision_one';
  service = new RuntimeDiagnosticService(
    projects,
    new RuntimeDiagnosticCache(),
    async () => revisionId,
  );
});

afterEach(async () => {
  database.close();
  await rm(directory, { recursive: true, force: true });
});

const report = (outcome: 'success' | 'failed', message = '组件失败') => ({
  version: '1' as const,
  projectId: 'project_one',
  pageId: 'page_one',
  revisionId,
  outcome,
  diagnostics:
    outcome === 'failed'
      ? [
          {
            code: 'MATERIAL_RENDER_FAILED',
            severity: 'error' as const,
            stage: 'render' as const,
            pageId: 'page_one',
            revisionId,
            elementId: 'table-one',
            materialType: 'table',
            safeMessage: message,
          },
        ]
      : [],
  observedAt: new Date().toISOString(),
});

describe('RuntimeDiagnosticService', () => {
  it('keeps only current-session diagnostics for the current revision', async () => {
    expect(await service.report(report('success'))).toMatchObject({ disposition: 'accepted' });

    revisionId = 'revision_two';
    expect(await service.report(report('failed'))).toMatchObject({
      currentRevisionId: 'revision_two',
    });
    expect(await service.getState('project_one', 'page_one')).toMatchObject({
      currentRevisionId: 'revision_two',
      diagnostics: [{ code: 'MATERIAL_RENDER_FAILED', revisionId: 'revision_two' }],
    });
  });

  it('ignores a stale revision response without poisoning diagnostics', async () => {
    await service.report(report('success'));
    revisionId = 'revision_two';
    const stale = report('failed');
    stale.revisionId = 'revision_one';
    stale.diagnostics[0]!.revisionId = 'revision_one';

    expect(await service.report(stale)).toEqual({
      version: '1',
      disposition: 'stale',
      currentRevisionId: 'revision_two',
    });
    expect((await service.getState('project_one', 'page_one')).diagnostics).toEqual([]);
  });

  it('redacts secrets and local paths before persistence and rejects wrong ownership', async () => {
    await service.report(
      report('failed', 'Authorization: Bearer abc.def token=topsecret /Users/alice/project/a.ts'),
    );
    const stored = (await service.getState('project_one', 'page_one')).diagnostics[0]!.safeMessage;
    expect(stored).not.toContain('abc.def');
    expect(stored).not.toContain('topsecret');
    expect(stored).not.toContain('/Users/alice');
    expect(stored).toContain('[REDACTED]');

    await expect(service.getState('project_one', 'page_other')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('rejects diagnostic revision mismatches and invalid outcome payloads', async () => {
    const mismatched = report('failed');
    mismatched.diagnostics[0]!.revisionId = 'revision_other';
    await expect(service.report(mismatched)).rejects.toMatchObject({ statusCode: 422 });
    const successWithError = report('failed');
    successWithError.outcome = 'success';
    await expect(service.report(successWithError)).rejects.toMatchObject({ statusCode: 422 });
  });
});
