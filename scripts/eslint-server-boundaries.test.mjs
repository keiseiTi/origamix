import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint, Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { serverBoundaries } from './eslint-server-boundaries.mjs';

const serverRoot = fileURLToPath(new URL('../packages/server/', import.meta.url));
const lint = (file, code) =>
  new Linter().verify(
    code,
    [
      {
        files: ['**/*.ts'],
        languageOptions: { parser: tseslint.parser },
        plugins: { architecture: { rules: { boundaries: serverBoundaries } } },
        rules: { 'architecture/boundaries': 'error' },
      },
    ],
    { filename: `${serverRoot}${file}` },
  );

for (const [file, code] of [
  ['http/new-route.ts', "import { writeFile } from 'node:fs/promises';"],
  ['http/new-route.ts', "const fs = require('fs');"],
  ['http/new-route.ts', "const fs = import('node:fs');"],
  ['http/new-route.ts', "import fs = require('node:fs');"],
  ['http/new-route.ts', "export * from '../schema/target-schema-store';"],
  ['http/new-route.ts', "import { writer } from '../schema/../infrastructure/atomic-file.ts';"],
  ['http/new-route.ts', "import { ProjectSourceService } from '../projects/project-source';"],
  [
    'agent/tools/new-tool.ts',
    "import { WorkingSchemaStore } from '../../schema/working-schema-store';",
  ],
  ['agent/tools/new-tool.ts', "const db = import('node:sqlite');"],
  ['agent/tools/new-tool.ts', "import { createRequire } from 'node:module';"],
  ['schema/new-service.ts', "import { SchemaCommit } from './schema-commit';"],
  ['schema/new-service.ts', "import { helper } from '../http/helper';"],
  ['schema/new-service.ts', "export { FakeAgentEngine } from '../testing/fake-agent-engine';"],
  ['runtime.ts', "export * from './agent/engine';"],
  ['runtime.ts', "export { startServer } from './other';"],
  ['runtime.ts', 'export const legacy = 1;'],
  ['runtime.ts', 'export default {};'],
  ['agent/new-service.ts', "import { evaluate } from '../evaluation/evaluation-harness';"],
  ['agent/new-service.ts', "import materials from '@origamix/materials/antd';"],
  ['agent/new-service.ts', "import type { Component } from 'react';"],
  ['agent/new-service.ts', "import { host } from '@origamix/desktop/main';"],
  ['agent/new-service.ts', "import { host } from '../../app/dev-server';"],
  ['agent/new-service.ts', "import { host } from '@origamix/server/runtime';"],
  ['agent/new-service.ts', 'const module = import(name);'],
  ['database/new.ts', "import { ProjectService } from '../projects/project-service';"],
  ['infrastructure/new.ts', "import { getSchema } from '../schema/schema-service';"],
]) {
  test(`rejects ${file}: ${code}`, () => {
    const messages = lint(file, code);
    assert.ok(
      messages.some((message) => message.ruleId === 'architecture/boundaries'),
      JSON.stringify(messages),
    );
    assert.ok(!messages.some((message) => message.fatal), JSON.stringify(messages));
  });
}

for (const [file, code] of [
  ['http/types.ts', "import type { ProjectRepository } from '../projects/project-repository';"],
  ['http/types.ts', "import { type ProjectRepository } from '../projects/project-repository';"],
  ['http/schema-routes.ts', "import { commitSchema } from '../schema/schema-service';"],
  [
    'agent/tools/replace-page-schema.ts',
    "import { commitSchema } from '../../schema/schema-service';",
  ],
  [
    'agent/tools/read-only-tools.ts',
    "import { manifest } from '@origamix/materials/antd/manifest';",
  ],
  ['schema/schema-service.ts', "import { SchemaCommit } from './schema-commit';"],
  ['schema/schema-service.ts', "import { WorkingSchemaStore } from './working-schema-store';"],
  ['schema/project-apply-service.ts', "import { TargetSchemaStore } from './target-schema-store';"],
  [
    'schema/working-schema-store.ts',
    "import { writeJsonAtomically } from '../infrastructure/atomic-file';",
  ],
  [
    'projects/project-source.ts',
    "import { writeFileAtomically } from '../infrastructure/atomic-file';",
  ],
  ['runtime.ts', 'export const startServer = async () => {};'],
  ['tooling.ts', "export * from './evaluation/evaluation-harness';"],
  ['http/agent-flow.test.ts', "import { writeFile } from 'node:fs/promises';"],
  ['testing/fixture.ts', "import { FakeAgentEngine } from './fake-agent-engine';"],
]) {
  test(`allows ${file}: ${code}`, () => assert.deepEqual(lint(file, code), []));
}

test('the repository configuration enables the Server boundary rule', async () => {
  const eslint = new ESLint({ cwd: fileURLToPath(new URL('../', import.meta.url)) });
  const config = await eslint.calculateConfigForFile(`${serverRoot}http/schema-routes.ts`);
  assert.equal(config.rules['architecture/server-boundaries'][0], 2);
});
