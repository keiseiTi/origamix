import { FakeAgentEngine } from './fake-agent-engine';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import type { AgentEngine } from '../agent/engine';

export const deterministicSchema = (
  schema: OrigamixPageSchema,
  text: string,
  runId: string,
): OrigamixPageSchema => {
  const suffix = runId.replace(/^run_/, '').slice(-8);
  const root = schema.layout.root;
  const elements = { ...schema.elements };
  const structure = Object.fromEntries(
    Object.entries(schema.layout.structure).map(([id, children]) => [id, [...children]]),
  );
  const children = [...(structure[root] ?? [])];
  const requestsTableColumn = /(表格).*(增加|添加|加).*(列)|(增加|添加|加).*(表格).*(列)/u.test(
    text,
  );
  const existingTable = Object.entries(elements).find(([, element]) => element.type === 'table');
  if (requestsTableColumn && existingTable) {
    const [elementId, element] = existingTable;
    const currentColumns = Array.isArray(element.props['columns']) ? element.props['columns'] : [];
    elements[elementId] = {
      ...element,
      props: {
        ...element.props,
        columns: currentColumns.some(
          (column) =>
            column &&
            typeof column === 'object' &&
            (column as { dataIndex?: unknown }).dataIndex === 'status',
        )
          ? currentColumns
          : [...currentColumns, { title: '状态', dataIndex: 'status' }],
      },
    };
  }
  if (/(按钮).*(改成|设置|修改).*(主要|主按钮|primary)/iu.test(text)) {
    const existingButton = Object.entries(elements).find(
      ([, element]) => element.type === 'button',
    );
    if (existingButton) {
      const [elementId, element] = existingButton;
      elements[elementId] = { ...element, props: { ...element.props, type: 'primary' } };
    }
  }
  const titleId = `text_${suffix}`;
  elements[titleId] = { type: 'text', props: { text, type: 'h3' } };
  structure[titleId] = [];
  children.push(titleId);
  if (/(表单|输入框|字段)/u.test(text)) {
    const formId = `form_${suffix}`;
    const inputId = `input_${suffix}`;
    const passwordId = `password_${suffix}`;
    const buttonId = `button_${suffix}`;
    elements[formId] = { type: 'form', props: { layout: 'vertical' } };
    elements[inputId] = {
      type: 'input',
      props: { placeholder: /登录/u.test(text) ? '请输入账号' : '请输入内容', allowClear: true },
    };
    if (/登录/u.test(text)) {
      elements[passwordId] = {
        type: 'input',
        props: { type: 'password', placeholder: '请输入密码', allowClear: true },
      };
      structure[passwordId] = [];
    }
    elements[buttonId] = {
      type: 'button',
      props: { text: '提交', type: 'primary', size: 'middle' },
    };
    structure[formId] = [inputId, ...(/登录/u.test(text) ? [passwordId] : []), buttonId];
    structure[inputId] = [];
    structure[buttonId] = [];
    children.push(formId);
  }
  if (/(表格|列表)/u.test(text) && !(requestsTableColumn && existingTable)) {
    const tableId = `table_${suffix}`;
    elements[tableId] = {
      type: 'table',
      props: {
        rowKey: 'id',
        size: 'middle',
        columns: [
          { title: '名称', dataIndex: 'name' },
          { title: '状态', dataIndex: 'status' },
        ],
        enabledPagination: false,
      },
    };
    structure[tableId] = [];
    children.push(tableId);
  }
  structure[root] = children;
  return { ...schema, elements, layout: { ...schema.layout, structure } };
};

/** Deterministic test/MVP engine. It uses the same RunExecutor and Tool Registry as real models. */
export const createDeterministicFakeAgentEngine = (): AgentEngine => {
  return new FakeAgentEngine(async (request) => {
    const contextMatch = request.systemPrompt.match(
      /<ORIGAMIX_CONTEXT>([\s\S]*)<\/ORIGAMIX_CONTEXT>/u,
    );
    const context = contextMatch
      ? (JSON.parse(contextMatch[1]!) as { schemaFragment?: string })
      : undefined;
    const schema = context?.schemaFragment
      ? (JSON.parse(context.schemaFragment) as OrigamixPageSchema)
      : undefined;
    const applyOperations = request.tools?.find((tool) => tool.name === 'apply_page_operations');
    if (applyOperations && schema) {
      const runId = `run_${Date.now()}`;
      const operations = [
        {
          operation: 'updateElementProps',
          elementId: schema.layout.root,
          set: { agentPrompt: request.prompt, agentRunId: runId },
        },
      ];
      await request.onEvent?.({
        type: 'tool_start',
        toolCallId: `tool_${runId}`,
        toolName: applyOperations.name,
        input: { operations },
      });
      const result = await applyOperations.execute(
        { operations },
        request.signal ?? new AbortController().signal,
      );
      await request.onEvent?.({
        type: 'tool_end',
        toolCallId: `tool_${runId}`,
        toolName: applyOperations.name,
        result,
        isError: false,
      });
      const text = 'Fake Engine 已生成并提交候选页面，请在编辑器中检查结果。';
      await request.onEvent?.({ type: 'text_delta', delta: text });
      return { text, usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } };
    }
    const text =
      '请描述目标字段、校验规则、表格列和交互行为；Agent 会基于可用物料生成并校验页面 Schema。当前使用确定性测试模型。';
    await request.onEvent?.({ type: 'text_delta', delta: text });
    return { text, usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } };
  });
};
