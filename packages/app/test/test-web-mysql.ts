import { verifyStandaloneProject } from '../../../scripts/verify-standalone-project.ts';
import type { OpenProjectResult, ProjectExportSnapshot } from '@origamix/shared';
import { startServer } from '@origamix/server/runtime';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { nanoid } from 'nanoid';
import { startProductionWeb } from '../production-web.ts';

const mysqlUrl = process.env.ORIGAMIX_TEST_MYSQL_URL;
if (!mysqlUrl) throw new Error('Set ORIGAMIX_TEST_MYSQL_URL to a disposable MySQL database');
const root = fileURLToPath(new URL('../', import.meta.url));
const stateDirectory = await mkdtemp(join(tmpdir(), 'origamix-mysql-web-'));
const origin = new URL('http://127.0.0.1:5193');
const password = 'origamix-web-mysql-test-password';
const options = {
  origin,
  password,
  host: '127.0.0.1',
  port: 5193,
  mysqlUrl,
  stateDirectory,
  rendererDirectory: join(root, 'dist/web'),
  templateDirectory: join(root, '../../dist/web-template'),
};
let host: Awaited<ReturnType<typeof startProductionWeb>> | undefined;
let cookie = '';
let projectId: string | undefined;

const login = async () => {
  const response = await fetch(new URL('/auth/login', origin), {
    redirect: 'manual',
    method: 'POST',
    headers: { Origin: origin.origin },
    body: new URLSearchParams({ password }),
  });
  assert.equal(response.status, 303);
  const session = response.headers.get('set-cookie');
  assert.ok(session);
  cookie = session.split(';')[0];
};

const post = async <T>(path: string, data: object, expected = 200): Promise<T> => {
  const response = await fetch(new URL(`/api/v1${path}`, origin), {
    method: 'POST',
    headers: { Cookie: cookie, Origin: origin.origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const envelope = await response.json();
  assert.equal(response.status, expected, JSON.stringify(envelope));
  assert.equal(envelope.success, response.ok);
  return envelope.data as T;
};

type Project = { id: string; path: string; pages?: { id: string }[] };
type Working = {
  revisionId: string;
  workingVersion: number;
  workingHash: string;
  savedSchemaHash: string;
  schema: { elements: { element_root: { props: { height?: number } } } };
};

try {
  host = await startProductionWeb(options);
  await login();
  const project = await post<Project>(
    '/projects/create',
    {
      name: `Web MySQL integration ${nanoid(6)}`,
      code: `web-test-${nanoid(12).toLowerCase().replaceAll('_', 'a').replaceAll('-', 'b')}`,
      pageDirectory: 'pages',
    },
    201,
  );
  projectId = project.id;
  assert.equal(project.path, undefined);
  const { manifestHash } = await post<{ manifestHash: string }>('/projects/page-roles/get', {
    projectId,
  });
  const page = await post<{ id: string }>(
    '/pages/create',
    {
      projectId,
      name: '编辑检查',
      slug: 'editing',
      expectedManifestHash: manifestHash,
    },
    201,
  );
  const scope = { projectId, pageId: page.id };
  const initial = await post<Working>('/pages/working-state/get', scope);
  const update = (height: number, baseWorkingVersion: number) => ({
    ...scope,
    baseWorkingVersion,
    operations: [{ operation: 'updateElementProps', elementId: 'element_root', set: { height } }],
  });
  const edited = await post<Working>(
    '/pages/working-operations/apply',
    update(321, initial.workingVersion),
  );
  assert.equal(edited.workingVersion, initial.workingVersion + 1);
  assert.equal(edited.revisionId, initial.revisionId);
  await post('/pages/working-operations/apply', update(999, initial.workingVersion), 409);
  await post(
    '/pages/working-operations/apply',
    {
      ...scope,
      baseWorkingVersion: edited.workingVersion,
      operations: [
        {
          operation: 'addElement',
          parentId: 'element_root',
          elementId: 'bad_material',
          element: { type: 'not_a_material', props: {} },
        },
      ],
    },
    422,
  );
  assert.deepEqual(await post<Working>('/pages/working-state/get', scope), {
    ...edited,
    schemaHash: edited.workingHash,
  });

  const saved = await post<Working>('/pages/revisions/save', {
    ...scope,
    expectedWorkingVersion: edited.workingVersion,
  });
  assert.notEqual(saved.revisionId, initial.revisionId);
  assert.equal(saved.workingHash, saved.savedSchemaHash);
  assert.deepEqual(
    await post<Working>('/pages/revisions/save', {
      ...scope,
      expectedWorkingVersion: saved.workingVersion,
    }),
    saved,
  );

  const pending = await post<ProjectExportSnapshot>('/projects/export/snapshot', { projectId });
  const exportedManifest = pending.files.find(({ path }) => path === 'origamix.project.json');
  assert.ok(exportedManifest);
  assert.equal(JSON.parse(exportedManifest.text).projectId, projectId);
  const desktopOpen = await fetch(new URL('/api/v1/projects/open', origin), {
    method: 'POST',
    headers: { Cookie: cookie, Origin: origin.origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ directoryGrantId: 'desktop-only' }),
  });
  assert.equal(desktopOpen.status, 404);
  assert.ok(pending.files.some(({ path }) => path === 'src/pages/editing/schema.json'));
  const draft = await post<Working>(
    '/pages/working-operations/apply',
    update(425, saved.workingVersion),
  );
  await host.close();
  host = undefined;
  assert.deepEqual(await readdir(stateDirectory), []);

  host = await startProductionWeb(options);
  await post('/projects/list', {}, 401);
  await login();
  const projects = await post<Project[]>('/projects/list', {});
  assert.ok(
    projects.some((item) => item.id === projectId && item.pages?.some(({ id }) => id === page.id)),
  );
  assert.deepEqual(await post<Working>('/pages/working-state/get', scope), {
    ...draft,
    schemaHash: draft.workingHash,
  });
  await post('/projects/export/snapshot', { projectId }, 409);
  const report = await post<{ disposition: string }>('/pages/runtime-reports/report', {
    ...scope,
    version: '1',
    revisionId: draft.revisionId,
    workingVersion: draft.workingVersion,
    workingHash: draft.workingHash,
    previewId: 'preview_mysql_check',
    reportSequence: 1,
    outcome: 'success',
    observedAt: new Date().toISOString(),
    diagnostics: [],
  });
  assert.equal(report.disposition, 'accepted');
  const revision = await post<Working>('/pages/revisions/schema/get', {
    ...scope,
    revisionId: saved.revisionId,
  });
  assert.equal(revision.schema.elements.element_root.props.height, 321);
  const history = await post<{ revisions: { revisionId: string; isApplied: boolean }[] }>(
    '/pages/revisions/list',
    scope,
  );
  assert.equal(history.revisions.length, 2);
  assert.ok(history.revisions.every((entry) => !entry.isApplied));
  const restored = await post<Working>('/pages/revisions/restore', {
    ...scope,
    revisionId: initial.revisionId,
    expectedWorkingVersion: draft.workingVersion,
  });
  assert.equal(restored.revisionId, saved.revisionId);
  assert.equal(restored.workingHash, initial.workingHash);

  await post('/pages/revisions/save', {
    ...scope,
    expectedWorkingVersion: restored.workingVersion,
  });
  const newer = await post<ProjectExportSnapshot>('/projects/export/snapshot', { projectId });
  assert.notDeepEqual(newer.files, pending.files);
  const archive = join(stateDirectory, 'export.zip');
  const browser = await promisify(execFile)(
    'pnpm',
    [
      '--filter',
      '@origamix/desktop',
      'test:main',
      '--web',
      origin.origin,
      password,
      projectId,
      archive,
    ],
    { cwd: join(root, '../..'), timeout: 75000 },
  );
  process.stdout.write(browser.stdout);
  const extracted = join(stateDirectory, 'extracted');
  await mkdir(extracted);
  await promisify(execFile)('unzip', ['-q', archive, '-d', extracted]);
  const beforeExportEdit = await post<Working>('/pages/working-state/get', scope);
  const beforeExportHistory = await post('/pages/revisions/list', scope);
  const desktop = await startServer({
    databasePath: join(stateDirectory, 'desktop.db'),
    templatePath: extracted,
    desktopToken: 'desktop-fixture',
    serviceInstanceId: 'desktop-fixture-instance',
    port: 0,
  });
  try {
    desktop.registerGrant('grant-extracted', extracted);
    const local = async <T>(path: string, body: object): Promise<T> => {
      const response = await fetch(`http://127.0.0.1:${desktop.port}/api/v1${path}`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer desktop-fixture',
          'X-Origamix-Service': 'desktop-fixture-instance',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      assert.ok(response.ok && payload.success, JSON.stringify(payload));
      return payload.data;
    };
    const opened = await local<OpenProjectResult>('/projects/open', {
      directoryGrantId: 'grant-extracted',
    });
    assert.equal(opened.status, 'opened');
    if (opened.status !== 'opened') throw new Error('Desktop did not register the ZIP project');
    assert.equal(opened.project.id, projectId);
    assert.deepEqual(await readdir(extracted).then((files) => files.includes('.origamix')), false);
    const imported = await local<Working>('/pages/working-state/get', scope);
    assert.equal(imported.workingHash, beforeExportEdit.workingHash);
    const file = join(extracted, 'src/pages/editing/schema.json');
    const original = await readFile(file, 'utf8');
    const edited = await local<Working>(
      '/pages/working-operations/apply',
      update(632, imported.workingVersion),
    );
    const checkpoint = await local<Working>('/pages/revisions/save', {
      ...scope,
      expectedWorkingVersion: edited.workingVersion,
    });
    assert.equal(await readFile(file, 'utf8'), original);
    await local('/pages/apply', {
      ...scope,
      expectedRevisionId: checkpoint.revisionId,
      expectedWorkingVersion: checkpoint.workingVersion,
      clientRequestId: 'apply-extracted-zip',
    });
    assert.equal(JSON.parse(await readFile(file, 'utf8')).elements.element_root.props.height, 632);
    assert.deepEqual(await post<Working>('/pages/working-state/get', scope), beforeExportEdit);
    assert.deepEqual(await post('/pages/revisions/list', scope), beforeExportHistory);
  } finally {
    await desktop.close();
  }
  await verifyStandaloneProject(extracted, join(stateDirectory, 'archives'));
  console.info(
    'MySQL Web test passed: project/page creation, versioned editing, restart recovery, Chromium preview, ZIP export, desktop Apply and standalone build.',
  );
} finally {
  try {
    if (host && projectId) {
      await login();
      await post('/projects/delete', { projectId });
    }
  } finally {
    await host?.close();
    await rm(stateDirectory, { recursive: true, force: true });
  }
}
