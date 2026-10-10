import assert from 'node:assert/strict';
import { startServer } from '@origamix/server/runtime';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepareTemplateArtifact } from '../scripts/prepare-template-artifact.mjs';

const directory = await mkdtemp(join(tmpdir(), 'origamix-template-smoke-'));
const project = join(directory, 'project');
const template = join(directory, 'template');
let backend;
try {
  await prepareTemplateArtifact({
    sourceTemplate: fileURLToPath(new URL('../../template', import.meta.url)),
    targetTemplate: template,
    runtimePackage: fileURLToPath(new URL('../../runtime', import.meta.url)),
    materialsPackage: fileURLToPath(new URL('../../materials', import.meta.url)),
  });
  backend = await startServer({
    databasePath: join(directory, 'test.db'),
    templatePath: template,
    desktopToken: 'template-test-token',
    serviceInstanceId: 'template-test-instance',
  });
  assert.deepEqual(Object.keys(backend).sort(), ['close', 'port', 'registerGrant']);
  backend.registerGrant('template-test-grant', directory);
  const request = async (path, body = {}) => {
    const response = await fetch(`http://127.0.0.1:${backend.port}/api/v1${path}`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer template-test-token',
        'x-origamix-service': 'template-test-instance',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    assert.ok(response.ok && result.success, JSON.stringify(result));
    return result.data;
  };
  const created = await request('/projects/create', {
    name: 'Template smoke',
    code: 'project',
    pageDirectory: 'pages',
    directoryGrantId: 'template-test-grant',
  });
  const page = await request('/pages/create', {
    projectId: created.id,
    name: 'Home',
    slug: 'home',
  });
  const working = await request('/pages/working-state/get', {
    projectId: created.id,
    pageId: page.id,
  });
  const draft = await request('/pages/working-operations/apply', {
    projectId: created.id,
    pageId: page.id,
    baseWorkingVersion: working.workingVersion,
    operations: [
      { operation: 'updateElementProps', elementId: 'element_root', set: { height: 321 } },
    ],
  });
  const updated = await request('/pages/revisions/save', {
    projectId: created.id,
    pageId: page.id,
    expectedWorkingVersion: draft.workingVersion,
  });
  await request('/pages/apply', {
    projectId: created.id,
    pageId: page.id,
    expectedRevisionId: updated.revisionId,
    expectedWorkingVersion: updated.workingVersion,
    clientRequestId: 'template-test-apply',
  });
  const target = JSON.parse(await readFile(join(project, 'src/pages/home/schema.json'), 'utf8'));
  assert.equal(target.elements.element_root.props.height, 321);
  const readme = await readFile(join(project, 'README.md'), 'utf8');
  assert.ok(readme.startsWith('# Template smoke'));
  assert.ok(readme.includes('## 职责与入口'));
  await backend.close();
  backend = undefined;
  for (const args of [['install', '--ignore-scripts'], ['typecheck'], ['build']]) {
    const child = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, {
      cwd: project,
      stdio: 'inherit',
      timeout: 120000,
    });
    if (child.error || child.status !== 0) throw child.error ?? new Error(`pnpm ${args[0]} failed`);
  }
  console.info(
    'Template smoke passed: project creation, save, Apply, independent installation, typecheck and build.',
  );
} finally {
  await backend?.close();
  await rm(directory, { recursive: true, force: true });
}
