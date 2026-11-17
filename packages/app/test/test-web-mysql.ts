import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
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
  rendererDirectory: join(root, 'dist'),
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
      name: 'Web MySQL integration',
      code: `web-test-${nanoid(12).toLowerCase().replaceAll('_', 'a').replaceAll('-', 'b')}`,
      pageDirectory: 'pages',
    },
    201,
  );
  projectId = project.id;
  assert.equal(project.path, '');
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

  const browser = await promisify(execFile)(
    'pnpm',
    ['--filter', '@origamix/desktop', 'test:main', '--web', origin.origin, password, projectId],
    { cwd: join(root, '../..'), timeout: 45000 },
  );
  process.stdout.write(browser.stdout);
  console.info(
    'MySQL Web test passed: project/page creation, versioned editing, restart recovery and Chromium preview.',
  );
} finally {
  try {
    if (host && projectId) {
      await login();
      await post('/projects/delete', { projectId, scope: 'desktop_record' });
    }
  } finally {
    await host?.close();
    await rm(stateDirectory, { recursive: true, force: true });
  }
}
