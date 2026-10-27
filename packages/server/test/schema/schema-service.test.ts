import { ORIGAMIX_VERSION } from '@origamix/shared';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getFlowNodeManifest,
  type OrigamixPageSchema,
  type PageFlow,
  type PageFlowNode,
} from '@origamix/shared';
import {
  applyWorkingSchemaOperations,
  getSchema,
  getWorkingSchemaState,
  initializePageSchema,
  listRevisionHistory,
  restoreRevisionToWorking,
  saveWorkingRevision,
  updateWorkingSchema,
} from '../../src/schema/schema-service';

const directories: string[] = [];

const schema: OrigamixPageSchema = {
  elements: { element_root: { type: 'container', props: { padding: 8 } } },
  layout: { root: 'element_root', structure: { element_root: [] } },
  flows: {},
  bindElements: [],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: ORIGAMIX_VERSION } },
};

const logicFlow = (): PageFlow => ({
  startId: 'start',
  nodes: {
    start: { id: 'start', type: 'start', props: {}, prev: [], next: ['action'] },
    action: {
      id: 'action',
      type: 'customJS',
      props: { value: { type: 'function', value: { params: [], body: 'return 1;' } } },
      prev: ['start'],
      next: [],
    },
  },
});

const logicSchema = (): OrigamixPageSchema => ({
  ...structuredClone(schema),
  elements: {
    ...schema.elements,
    button_one: { type: 'button', props: { text: '一' } },
    button_two: { type: 'button', props: { text: '二' } },
    form_main: { type: 'form', props: {} },
    input_runtime: { type: 'input', props: {} },
  },
  layout: {
    root: 'element_root',
    structure: {
      element_root: ['button_one', 'button_two', 'form_main'],
      form_main: ['input_runtime'],
    },
  },
  flows: { flow_one: logicFlow(), flow_two: logicFlow() },
  bindElements: [
    { id: 'button_one', event: 'onClick', flowId: 'flow_one' },
    { id: 'button_two', event: 'onClick', flowId: 'flow_two' },
  ],
});

const createPageFixture = async (): Promise<{
  projectPath: string;
  pageId: string;
  slug: string;
}> => {
  const projectPath = await mkdtemp(join(tmpdir(), 'origamix-schema-'));
  directories.push(projectPath);
  const pageId = 'page_test';
  const slug = 'test-page';
  const pagePath = join(projectPath, 'src', 'pages', slug);
  await mkdir(pagePath, { recursive: true });
  await writeFile(join(pagePath, 'schema.json'), JSON.stringify(schema));
  await writeFile(
    join(projectPath, 'origamix.project.json'),
    JSON.stringify({
      projectId: 'project_test',
      name: 'Test',
      framework: 'react',
      uiLibrary: 'antd',
      version: '1.0.0',
      materialSet: 'official-antd',
      pageDirectory: 'pages',
      pages: [{ pageId, name: '测试页面', slug }],
    }),
  );
  return { projectPath, pageId, slug };
};

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('Schema Service', () => {
  it('rejects metadata symlinks without changing the retained draft or external files', async () => {
    const page = await createPageFixture();
    await initializePageSchema(page, schema);
    const before = await getWorkingSchemaState(page);
    for (const relative of [
      '.origamix',
      '.origamix/pages',
      '.origamix/revisions',
      '.origamix/transactions',
    ]) {
      const outside = await mkdtemp(join(tmpdir(), 'origamix-outside-'));
      directories.push(outside);
      const moved = join(outside, 'metadata');
      const original = join(page.projectPath, relative);
      await rename(original, moved);
      await symlink(moved, original, 'dir');
      try {
        await expect(
          updateWorkingSchema(page, {
            baseWorkingVersion: before.workingVersion,
            schema: {
              ...schema,
              elements: { element_root: { type: 'container', props: { padding: 99 } } },
            },
          }),
        ).rejects.toThrow('符号链接');
        await expect(listRevisionHistory(page)).rejects.toThrow('符号链接');
      } finally {
        await rm(original);
        await rename(moved, original);
      }
      expect(await getWorkingSchemaState(page)).toEqual(before);
    }
  });

  it('retains incomplete visual flows and completes local Agent bindings without changing unrelated events', async () => {
    const page = await createPageFixture();
    const initialSchema = logicSchema();
    // An unrelated visual draft may have disconnected nodes and empty targets.
    initialSchema.flows.flow_two.nodes.draft = {
      id: 'draft',
      type: 'setElementProps',
      prev: [],
      next: [],
      props: structuredClone(getFlowNodeManifest('setElementProps')!.defaultProps),
    };
    await initializePageSchema(page, initialSchema);
    const initial = await getWorkingSchemaState(page);
    const target = await readFile(
      join(page.projectPath, 'src/pages', page.slug, 'schema.json'),
      'utf8',
    );
    const flow = logicFlow();
    flow.nodes.action = {
      ...flow.nodes.action!,
      type: 'setElementProps',
      // Runtime writes require a separate writable declaration, even when absent from design propsSchema.
      props: {
        setters: [
          {
            elementId: 'input_runtime',
            propName: 'value',
            value: { type: 'string', value: '输入' },
          },
        ],
      },
    };
    const draft = await applyWorkingSchemaOperations(
      page,
      {
        baseWorkingVersion: initial.workingVersion,
        operations: [
          { operation: 'addFlow', flowId: 'flow_new', flow },
          {
            operation: 'setElementEventBinding',
            elementId: 'button_one',
            event: 'onClick',
            flowId: 'flow_new',
          },
          {
            operation: 'setElementEventBinding',
            elementId: 'button_one',
            event: 'init',
            flowId: 'flow_new',
          },
          { operation: 'removeElementEventBinding', elementId: 'button_one', event: 'init' },
          { operation: 'removeElementEventBinding', elementId: 'button_one', event: 'init' },
        ],
      },
      {
        agentCommit: {
          runId: 'run_logic',
          projectId: 'project_test',
          operationDigest: 'logic_digest',
        },
      },
    );
    expect(draft.schema.bindElements).toEqual([
      { id: 'button_one', event: 'onClick', flowId: 'flow_new' },
      initialSchema.bindElements[1],
    ]);
    expect(draft.schema.flows.flow_two).toEqual(initialSchema.flows.flow_two);
    expect(draft.schema.flows.flow_one).toEqual(initialSchema.flows.flow_one);
    expect(draft.workingVersion).toBe(initial.workingVersion + 1);
    expect(draft.revisionId).toBe(initial.revisionId);
    expect((await listRevisionHistory(page)).revisions).toHaveLength(1);
    expect(
      await readFile(join(page.projectPath, 'src/pages', page.slug, 'schema.json'), 'utf8'),
    ).toBe(target);

    await expect(
      applyWorkingSchemaOperations(page, {
        baseWorkingVersion: initial.workingVersion,
        operations: [
          { operation: 'removeElementEventBinding', elementId: 'button_two', event: 'onClick' },
        ],
      }),
    ).rejects.toThrow('页面草稿已更新');
    expect((await getWorkingSchemaState(page)).workingHash).toBe(draft.workingHash);
  });

  // These cases protect the sole Working write boundary, including the editor candidate fallback.
  it.each<{
    name: string;
    mutate: (flow: PageFlow, candidate: OrigamixPageSchema) => void;
  }>([
    {
      name: 'missing start',
      mutate: (flow) => {
        flow.startId = 'missing';
      },
    },
    {
      name: 'node identity mismatch',
      mutate: (flow) => {
        flow.nodes.action!.id = 'other';
      },
    },
    {
      name: 'dangling edge',
      mutate: (flow) => {
        flow.nodes.action!.next = ['missing'];
      },
    },
    {
      name: 'inconsistent reverse edge',
      mutate: (flow) => {
        flow.nodes.action!.prev = [];
      },
    },
    {
      name: 'cycle',
      mutate: (flow) => {
        flow.nodes.action!.next = ['action'];
        flow.nodes.action!.prev.push('action');
      },
    },
    {
      name: 'duplicate condition branch',
      mutate: (flow) => {
        flow.nodes.start!.next = ['condition'];
        flow.nodes.action!.prev = ['condition', 'condition'];
        flow.nodes.condition = {
          id: 'condition',
          type: 'condition',
          prev: ['start'],
          next: ['action', 'action'],
          props: {
            judgment: { type: 'expression', value: 'true' },
            condition: [
              { value: true, nextNode: 'action' },
              { value: true, nextNode: 'action' },
            ],
          },
        };
      },
    },
    {
      name: 'unknown material event',
      mutate: (_flow, candidate) => {
        candidate.bindElements[0]!.event = 'unknown';
      },
    },
    {
      name: 'duplicate event binding',
      mutate: (_flow, candidate) => {
        candidate.bindElements.push({ ...candidate.bindElements[0]! });
      },
    },
    {
      name: 'missing node target',
      mutate: (flow) => {
        flow.nodes.action!.type = 'visibleElement';
        flow.nodes.action!.props = {
          elementIds: ['missing'],
          value: { type: 'boolean', value: true },
        };
      },
    },
    {
      name: 'configured property outside writable whitelist',
      mutate: (flow) => {
        flow.nodes.action!.type = 'setElementProps';
        flow.nodes.action!.props = {
          setters: [
            {
              elementId: 'button_one',
              propName: 'disabled',
              value: { type: 'boolean', value: true },
            },
          ],
        };
      },
    },
    {
      name: 'configured property outside readable whitelist',
      mutate: (flow) => {
        flow.nodes.action!.type = 'customJS';
        flow.nodes.action!.props = {
          value: {
            type: 'function',
            value: {
              params: [{ name: 'value', value: 'state.button_one.disabled' }],
              body: 'return value;',
            },
          },
        };
      },
    },
    {
      name: 'event used as method',
      mutate: (flow) => {
        flow.nodes.action!.type = 'emitElementAction';
        flow.nodes.action!.props = {
          setters: [
            {
              elementId: 'button_one',
              methodName: 'onClick',
              value: { type: 'null', value: null },
            },
          ],
        };
      },
    },
    {
      name: 'non-portal target',
      mutate: (flow) => {
        flow.nodes.action!.type = 'openModalDrawer';
        flow.nodes.action!.props = { elementId: 'button_one' };
      },
    },
    {
      name: 'undeclared variable',
      mutate: (flow) => {
        flow.nodes.action!.type = 'setGlobalVariable';
        flow.nodes.action!.props = {
          setters: [{ name: 'missing', value: { type: 'null', value: null } }],
        };
      },
    },
    {
      name: 'cross-flow result reference',
      mutate: (flow) => {
        flow.nodes.action!.props = {
          value: {
            type: 'function',
            value: { params: [{ name: 'data', value: 'result.other' }], body: 'return data;' },
          },
        };
      },
    },
  ])('rejects $name atomically through operations and candidate writes', async ({ mutate }) => {
    const page = await createPageFixture();
    await initializePageSchema(page, logicSchema());
    const current = await getWorkingSchemaState(page);
    const candidate = structuredClone(current.schema);
    mutate(candidate.flows.flow_one!, candidate);
    await expect(
      updateWorkingSchema(page, { baseWorkingVersion: current.workingVersion, schema: candidate }),
    ).rejects.toThrow();
    await expect(
      applyWorkingSchemaOperations(page, {
        baseWorkingVersion: current.workingVersion,
        operations: [
          {
            operation: 'updateElementProps',
            elementId: 'button_one',
            set: { text: 'must not persist' },
          },
          { operation: 'updateFlow', flowId: 'flow_one', flow: candidate.flows.flow_one! },
          { operation: 'setElementBindings', bindings: candidate.bindElements },
        ],
      }),
    ).rejects.toThrow();
    expect(await getWorkingSchemaState(page)).toEqual(current);
    expect((await listRevisionHistory(page)).revisions).toHaveLength(1);
  });

  it('requires Agent flow completeness while allowing a visual draft of the same nodes', async () => {
    const page = await createPageFixture();
    await initializePageSchema(page, logicSchema());
    const current = await getWorkingSchemaState(page);
    const flow = logicFlow();
    const action = flow.nodes.action!;
    const invalidActions: PageFlowNode[] = [
      { ...action, prev: [], props: action.props },
      {
        ...action,
        type: 'setElementProps',
        props: structuredClone(getFlowNodeManifest('setElementProps')!.defaultProps),
      },
      { ...action, props: { value: { type: 'function', value: { params: [], body: '' } } } },
    ];
    for (const invalidAction of invalidActions) {
      const candidate = logicFlow();
      candidate.nodes.action = invalidAction;
      if (!invalidAction.prev.length) candidate.nodes.start!.next = [];
      const visual = await updateWorkingSchema(page, {
        baseWorkingVersion: (await getWorkingSchemaState(page)).workingVersion,
        schema: { ...current.schema, flows: { ...current.schema.flows, flow_one: candidate } },
      });
      // Explicitly submitting the same unfinished flow cannot bypass Agent completion checks.
      await expect(
        applyWorkingSchemaOperations(
          page,
          {
            baseWorkingVersion: visual.workingVersion,
            operations: [{ operation: 'updateFlow', flowId: 'flow_one', flow: candidate }],
          },
          {
            agentCommit: {
              runId: 'run_same_flow',
              projectId: 'project_test',
              operationDigest: 'same_flow_digest',
            },
          },
        ),
      ).rejects.toThrow();
      // Rebinding an existing draft also requires completeness, even if its nodes are unchanged.
      await expect(
        applyWorkingSchemaOperations(
          page,
          {
            baseWorkingVersion: visual.workingVersion,
            operations: [
              {
                operation: 'setElementEventBinding',
                elementId: 'button_two',
                event: 'init',
                flowId: 'flow_one',
              },
            ],
          },
          {
            agentCommit: {
              runId: 'run_incomplete',
              projectId: 'project_test',
              operationDigest: 'incomplete_digest',
            },
          },
        ),
      ).rejects.toThrow();
      expect((await getWorkingSchemaState(page)).workingHash).toBe(visual.workingHash);
    }
  });

  it('accepts bound context parameters and rejects a result that exists only on another branch', async () => {
    const page = await createPageFixture();
    await initializePageSchema(page, logicSchema());
    const current = await getWorkingSchemaState(page);
    const flow = logicFlow();
    flow.nodes.action!.next = ['condition'];
    flow.nodes.condition = {
      id: 'condition',
      type: 'condition',
      prev: ['action'],
      next: ['branch', 'done'],
      props: {
        judgment: { type: 'contextValue', value: 'result.action' },
        condition: [
          { value: true, nextNode: 'branch' },
          { value: false, nextNode: 'done' },
        ],
      },
    };
    flow.nodes.branch = {
      ...structuredClone(flow.nodes.action!),
      id: 'branch',
      prev: ['condition'],
      next: ['done'],
    };
    flow.nodes.done = {
      id: 'done',
      type: 'customJS',
      prev: ['condition', 'branch'],
      next: [],
      props: {
        value: {
          type: 'function',
          value: {
            params: [
              { name: 'result', value: 'result.action' },
              { name: 'state', value: 'state.form_main.value' },
              { name: 'method', value: 'method.form_main.validateFields' },
            ],
            body: 'throw new Error("Server must never execute project functions");',
          },
        },
      },
    };
    const accepted = await applyWorkingSchemaOperations(
      page,
      {
        baseWorkingVersion: current.workingVersion,
        operations: [{ operation: 'updateFlow', flowId: 'flow_one', flow }],
      },
      {
        agentCommit: {
          runId: 'run_context',
          projectId: 'project_test',
          operationDigest: 'context_digest',
        },
      },
    );
    const invalid = structuredClone(flow);
    invalid.nodes.done!.props = {
      value: {
        type: 'function',
        value: { params: [{ name: 'result', value: 'result.branch' }], body: 'return result;' },
      },
    };
    await expect(
      applyWorkingSchemaOperations(
        page,
        {
          baseWorkingVersion: accepted.workingVersion,
          operations: [{ operation: 'updateFlow', flowId: 'flow_one', flow: invalid }],
        },
        {
          agentCommit: {
            runId: 'run_branch',
            projectId: 'project_test',
            operationDigest: 'branch_digest',
          },
        },
      ),
    ).rejects.toThrow('Result node must execute before this node on every path');
    expect((await getWorkingSchemaState(page)).workingHash).toBe(accepted.workingHash);
  });

  it('updates the Working draft without creating a Revision', async () => {
    const page = await createPageFixture();
    const initialRevisionId = await initializePageSchema(page, schema);
    const initial = await getWorkingSchemaState(page);
    const updated = await updateWorkingSchema(page, {
      baseWorkingVersion: initial.workingVersion,
      schema: {
        ...schema,
        elements: {
          ...schema.elements,
          element_root: { type: 'container', props: { padding: 24 } },
        },
      },
    });

    // Version selection must reject writes without changing retained Working or target.
    const manifestPath = join(page.projectPath, 'origamix.project.json');
    const manifestSource = await readFile(manifestPath, 'utf8');
    const targetPath = join(page.projectPath, 'src/pages', page.slug, 'schema.json');
    const targetSource = await readFile(targetPath, 'utf8');
    await writeFile(
      manifestPath,
      JSON.stringify({
        ...JSON.parse(manifestSource),
        version: '9.0.0',
      }),
    );
    await expect(
      updateWorkingSchema(page, {
        baseWorkingVersion: updated.workingVersion,
        schema,
      }),
    ).rejects.toThrow('9.0.0');
    expect((await getWorkingSchemaState(page)).workingVersion).toBe(updated.workingVersion);
    expect(await readFile(targetPath, 'utf8')).toBe(targetSource);
    expect(await readFile(manifestPath, 'utf8')).toContain('9.0.0');
    await writeFile(manifestPath, manifestSource);

    expect(updated.workingVersion).toBe(initial.workingVersion + 1);
    expect(updated.revisionId).toBe(initialRevisionId);
    expect(updated.workingHash).not.toBe(updated.savedSchemaHash);
    expect((await getSchema(page)).schema.elements.element_root.props.padding).toBe(24);
    expect(
      await readdir(join(page.projectPath, '.origamix', 'revisions', page.pageId)),
    ).toHaveLength(1);
  });

  it('saves the current Working draft as one idempotent Revision checkpoint', async () => {
    const page = await createPageFixture();
    await initializePageSchema(page, schema);
    const initial = await getWorkingSchemaState(page);
    const draft = await applyWorkingSchemaOperations(page, {
      baseWorkingVersion: initial.workingVersion,
      operations: [
        {
          operation: 'updateElementProps',
          elementId: 'element_root',
          set: { padding: 32 },
        },
      ],
    });
    const saved = await saveWorkingRevision(page, draft.workingVersion);

    expect(saved.revisionId).not.toBe(initial.revisionId);
    expect(saved.workingHash).toBe(saved.savedSchemaHash);
    expect(saved.workingVersion).toBe(draft.workingVersion + 1);
    const repeated = await saveWorkingRevision(page, saved.workingVersion);
    expect(repeated).toEqual(saved);
    expect(
      await readdir(join(page.projectPath, '.origamix', 'revisions', page.pageId)),
    ).toHaveLength(2);
  });

  it('lists immutable Revisions newest first with current and applied markers', async () => {
    const page = await createPageFixture();
    const initialRevisionId = await initializePageSchema(page, schema);
    const initial = await getWorkingSchemaState(page);
    const draft = await applyWorkingSchemaOperations(page, {
      baseWorkingVersion: initial.workingVersion,
      operations: [
        {
          operation: 'updateElementProps',
          elementId: 'element_root',
          set: { padding: 40 },
        },
      ],
    });
    const saved = await saveWorkingRevision(page, draft.workingVersion);

    const history = await listRevisionHistory(page);

    expect(history.revisions).toHaveLength(2);
    expect(history.revisions[0]).toMatchObject({
      revisionId: saved.revisionId,
      isCurrent: true,
      isApplied: false,
      source: { kind: 'user' },
    });
    expect(history.revisions[1]).toMatchObject({
      revisionId: initialRevisionId,
      isCurrent: false,
      isApplied: true,
    });
  });

  it.each([
    ['prepared', false],
    ['revision', true],
    ['schema', true],
  ] as const)(
    'recovers a save-version interruption after %s without losing the Working draft',
    async (failedStage, savedAfterRecovery) => {
      const page = await createPageFixture();
      const initialRevisionId = await initializePageSchema(page, schema);
      const initial = await getWorkingSchemaState(page);
      const draft = await applyWorkingSchemaOperations(page, {
        baseWorkingVersion: initial.workingVersion,
        operations: [
          {
            operation: 'updateElementProps',
            elementId: 'element_root',
            set: { padding: 36 },
          },
        ],
      });
      await expect(
        saveWorkingRevision(page, draft.workingVersion, {
          afterStage(stage) {
            if (stage === failedStage) throw new Error(`interrupt:${stage}`);
          },
        }),
      ).rejects.toThrow(`interrupt:${failedStage}`);

      const recovered = await getWorkingSchemaState(page);
      expect(recovered.schema.elements.element_root.props.padding).toBe(36);
      expect(recovered.workingHash === recovered.savedSchemaHash).toBe(savedAfterRecovery);
      expect(recovered.revisionId === initialRevisionId).toBe(!savedAfterRecovery);
      expect(recovered.workingVersion).toBe(
        savedAfterRecovery ? draft.workingVersion + 1 : draft.workingVersion,
      );
    },
  );

  it('restores a historical Revision into Working without saving a new Revision', async () => {
    const page = await createPageFixture();
    const initialRevisionId = await initializePageSchema(page, schema);
    const initial = await getWorkingSchemaState(page);
    const draft = await updateWorkingSchema(page, {
      baseWorkingVersion: initial.workingVersion,
      schema: {
        ...schema,
        elements: {
          ...schema.elements,
          element_root: { type: 'container', props: { padding: 40 } },
        },
      },
    });
    const saved = await saveWorkingRevision(page, draft.workingVersion);
    const restored = await restoreRevisionToWorking(page, initialRevisionId, saved.workingVersion);

    expect(restored.schema.elements.element_root.props.padding).toBe(8);
    expect(restored.revisionId).toBe(saved.revisionId);
    expect(restored.workingHash).not.toBe(restored.savedSchemaHash);
    expect(
      await readdir(join(page.projectPath, '.origamix', 'revisions', page.pageId)),
    ).toHaveLength(2);
  });

  it('rejects a stale Working version without changing the draft', async () => {
    const page = await createPageFixture();
    await initializePageSchema(page, schema);
    const initial = await getWorkingSchemaState(page);
    const first = await applyWorkingSchemaOperations(page, {
      baseWorkingVersion: initial.workingVersion,
      operations: [
        {
          operation: 'updateElementProps',
          elementId: 'element_root',
          set: { padding: 12 },
        },
      ],
    });
    await expect(
      applyWorkingSchemaOperations(page, {
        baseWorkingVersion: initial.workingVersion,
        operations: [
          {
            operation: 'updateElementProps',
            elementId: 'element_root',
            set: { padding: 13 },
          },
        ],
      }),
    ).rejects.toThrow('页面草稿已更新');
    expect((await getWorkingSchemaState(page)).workingHash).toBe(first.workingHash);
  });

  it('rejects invalid Working file metadata without rewriting it', async () => {
    const page = await createPageFixture();
    const revisionId = await initializePageSchema(page, schema);
    const workingPath = join(page.projectPath, '.origamix', 'pages', page.pageId, 'working.json');
    const current = JSON.parse(await readFile(workingPath, 'utf8'));
    const invalidWorking = JSON.stringify({ ...current, version: 0 });
    await writeFile(workingPath, invalidWorking);
    await expect(getWorkingSchemaState(page)).rejects.toThrow('页面工作副本版本无效');
    expect(await readFile(workingPath, 'utf8')).toBe(invalidWorking);
    expect(JSON.parse(invalidWorking).lastSavedRevisionId).toBe(revisionId);
  });

  it('rejects Manifest-invalid Schema before creating a revision', async () => {
    const page = await createPageFixture();
    const invalidSchema: OrigamixPageSchema = {
      ...schema,
      elements: { element_root: { type: 'unknown-material', props: {} } },
    };

    await expect(initializePageSchema(page, invalidSchema)).rejects.toThrow(
      'UNKNOWN_MATERIAL at /elements/element_root/type',
    );
    await expect(
      readdir(join(page.projectPath, '.origamix', 'revisions', page.pageId)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('applies Working operations and keeps revisions explicit', async () => {
    const page = await createPageFixture();
    const initialRevisionId = await initializePageSchema(page, schema);
    const working = await getWorkingSchemaState(page);
    const draft = await applyWorkingSchemaOperations(page, {
      baseWorkingVersion: working.workingVersion,
      operations: [
        {
          operation: 'updateElementProps',
          elementId: 'element_root',
          set: { padding: 16, alias: '页面布局' },
        },
      ],
    });
    expect(draft.revisionId).toBe(initialRevisionId);
    expect(draft.schema.elements.element_root.props).toMatchObject({
      padding: 16,
      alias: '页面布局',
    });
    for (const set of [{ alias: 42 }, { unknownProperty: 'rejected' }]) {
      await expect(
        applyWorkingSchemaOperations(page, {
          baseWorkingVersion: draft.workingVersion,
          operations: [{ operation: 'updateElementProps', elementId: 'element_root', set }],
        }),
      ).rejects.toThrow('INVALID_MATERIAL_PROPS');
      expect((await getSchema(page)).schema).toEqual(draft.schema);
      expect((await getWorkingSchemaState(page)).workingVersion).toBe(draft.workingVersion);
    }
    const saved = await saveWorkingRevision(page, draft.workingVersion);
    expect(saved.revisionId).not.toBe(initialRevisionId);
    expect((await getSchema(page)).schema.elements.element_root.props.alias).toBe('页面布局');
  });
});

it('opens the current page repeatedly without migration or additional checkpoints', async () => {
  const page = await createPageFixture();
  const revisionId = await initializePageSchema(page, schema);
  const workingPath = join(page.projectPath, '.origamix/pages', page.pageId, 'working.json');
  const targetPath = join(page.projectPath, 'src/pages', page.slug, 'schema.json');
  const originalWorking = await readFile(workingPath, 'utf8');
  const originalTarget = await readFile(targetPath, 'utf8');
  const [first, second] = await Promise.all([
    getWorkingSchemaState(page),
    getWorkingSchemaState(page),
  ]);
  expect(first).toEqual(second);
  expect(first.revisionId).toBe(revisionId);
  expect(first.workingHash).toBe(first.savedSchemaHash);
  expect(first.migration).toBeUndefined();
  expect(await readFile(workingPath, 'utf8')).toBe(originalWorking);
  expect(await readFile(targetPath, 'utf8')).toBe(originalTarget);
  expect(await readdir(join(page.projectPath, '.origamix/revisions', page.pageId))).toHaveLength(1);
});

it('rejects unsupported or missing Schema versions without rewriting Working', async () => {
  const page = await createPageFixture();
  await initializePageSchema(page, schema);
  const { hashSchema } = await import('../../src/schema/schema-hash');
  const path = join(page.projectPath, '.origamix/pages', page.pageId, 'working.json');
  const working = JSON.parse(await readFile(path, 'utf8'));
  for (const candidate of [
    { ...schema, extensions: { origamix: { schemaVersion: '99.0.0' } } },
    {
      ...schema,
      extensions: { origamix: {} },
    },
  ]) {
    const original = JSON.stringify({
      ...working,
      schema: candidate,
      workingHash: hashSchema(candidate as OrigamixPageSchema),
    });
    await writeFile(path, original);
    await expect(getSchema(page)).rejects.toThrow();
    expect(await readFile(path, 'utf8')).toBe(original);
  }
});
