import { BUILTIN_PROJECT_STACK } from '@origamix/shared';
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
const keepProject = process.env.ORIGAMIX_KEEP_TEMPLATE_SMOKE === '1';
const backendOptions = {
  databasePath: join(directory, 'test.db'),
  templatePath: template,
  desktopToken: 'template-test-token',
  serviceInstanceId: 'template-test-instance',
};
let backend;
try {
  await prepareTemplateArtifact({
    sourceTemplate: fileURLToPath(new URL('../../template', import.meta.url)),
    targetTemplate: template,
    runtimePackage: fileURLToPath(new URL('../../runtime', import.meta.url)),
    materialsPackage: fileURLToPath(new URL('../../materials', import.meta.url)),
  });
  backend = await startServer(backendOptions);
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
  assert.deepEqual(
    await request('/projects/stack/get', { projectId: created.id }),
    BUILTIN_PROJECT_STACK,
  );
  assert.deepEqual(
    JSON.parse(await readFile(join(project, 'origamix.project.json'), 'utf8')).materialSet,
    BUILTIN_PROJECT_STACK.materialSet,
  );
  const page = await request('/pages/create', {
    projectId: created.id,
    name: 'Home',
    slug: 'home',
  });
  const targetPath = join(project, 'src/pages/home/schema.json');
  const shellPath = join(project, 'src/pages/home/index.tsx');
  const originalTarget = await readFile(targetPath, 'utf8');
  const originalShell = await readFile(shellPath, 'utf8');
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
      {
        operation: 'addElement',
        elementId: 'delivery_button',
        parentId: 'element_root',
        element: {
          type: 'button',
          props: { text: 'Migration delivery verified', type: 'primary' },
        },
      },
    ],
  });
  assert.equal(draft.workingVersion, working.workingVersion + 1);
  assert.equal(draft.revisionId, working.revisionId);
  assert.equal(await readFile(targetPath, 'utf8'), originalTarget);
  await backend.close();
  backend = await startServer(backendOptions);
  const resumed = await request('/pages/working-state/get', {
    projectId: created.id,
    pageId: page.id,
  });
  for (const key of [
    'schema',
    'revisionId',
    'workingVersion',
    'workingHash',
    'savedSchemaHash',
    'baselineHash',
  ])
    assert.deepEqual(resumed[key], draft[key]);
  assert.equal(await readFile(targetPath, 'utf8'), originalTarget);
  const updated = await request('/pages/revisions/save', {
    projectId: created.id,
    pageId: page.id,
    expectedWorkingVersion: resumed.workingVersion,
  });
  assert.notEqual(updated.revisionId, working.revisionId);
  assert.equal(await readFile(targetPath, 'utf8'), originalTarget);
  const scope = { projectId: created.id, pageId: page.id };
  const history = await request('/pages/revisions/list', scope);
  const restored = await request('/pages/revisions/restore', {
    ...scope,
    revisionId: working.revisionId,
    expectedWorkingVersion: updated.workingVersion,
  });
  assert.deepEqual(restored.schema, working.schema);
  assert.notEqual(restored.workingHash, restored.savedSchemaHash);
  assert.equal(await readFile(targetPath, 'utf8'), originalTarget);
  assert.deepEqual(
    (
      await request('/pages/revisions/schema/get', {
        ...scope,
        revisionId: updated.revisionId,
      })
    ).schema,
    resumed.schema,
  );
  const applicable = await request('/pages/revisions/restore', {
    ...scope,
    revisionId: updated.revisionId,
    expectedWorkingVersion: restored.workingVersion,
  });
  assert.equal(applicable.workingHash, applicable.savedSchemaHash);
  assert.equal(
    (await request('/pages/revisions/list', scope)).revisions.length,
    history.revisions.length,
  );
  await request('/pages/apply', {
    projectId: created.id,
    pageId: page.id,
    expectedRevisionId: updated.revisionId,
    expectedWorkingVersion: applicable.workingVersion,
    clientRequestId: 'template-test-apply',
  });
  const target = JSON.parse(await readFile(join(project, 'src/pages/home/schema.json'), 'utf8'));
  assert.equal(target.elements.element_root.props.height, 321);
  assert.equal(target.elements.delivery_button.props.text, 'Migration delivery verified');
  assert.equal(await readFile(shellPath, 'utf8'), originalShell);
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
  const installed = JSON.parse(
    await readFile(join(project, 'node_modules/@origamix/materials/package.json'), 'utf8'),
  );
  assert.equal(installed.dependencies?.['@tangramino/base-editor'], undefined);
  assert.equal(installed.peerDependenciesMeta?.['@tangramino/base-editor']?.optional, true);
  assert.equal(installed.peerDependencies?.['@heroui/react'], undefined);
  assert.equal(installed.dependencies?.['@origamix/ui'], undefined);
  assert.equal(installed.peerDependenciesMeta?.['@origamix/ui']?.optional, true);
  const lockfile = await readFile(join(project, 'pnpm-lock.yaml'), 'utf8');
  for (const forbidden of [
    '@tangramino/base-editor',
    '@logicflow/',
    '@origamix/editor',
    '@origamix/ui',
    'monaco-editor',
  ]) {
    assert.ok(
      !lockfile.includes(forbidden.endsWith('/') ? forbidden : forbidden + '@'),
      `Generated project installed editor dependency: ${forbidden}`,
    );
  }
  console.info(
    'Template smoke passed: project creation, draft recovery after restart, explicit save, history restore and Apply, stable page shell, independent installation, typecheck and build.',
  );
} finally {
  await backend?.close();
  if (keepProject) console.info(`Template smoke project retained: ${project}`);
  else await rm(directory, { recursive: true, force: true });
}
