import type {
  CreateAgentRunRequest,
  MessageContent,
  RunMode,
} from '@origamix/shared/protocol/agent';
import type { AgentRunService } from '../services/agent-run-service';
import type { ConversationService } from '../services/conversation-service';
import type { ProjectRepository } from '../repositories/project-repository';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { commitSchema, getSchema } from '../services/schema-service';
import type { AgentEventBroker } from './agent-event-broker';

const textContent = (text: string): MessageContent => ({
  version: '1',
  blocks: [{ type: 'text', text }],
});
export const requestText = (request: CreateAgentRunRequest): string =>
  request.content.blocks
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

export function deterministicRunMode(text: string): RunMode {
  if (/^(请)?(加|添加|增加)(一个|个)?天气[，。！？!?]?$/u.test(text))
    return 'clarification_required';
  if (/(创建|新建|搭建|生成|做一个).{0,12}(天气).{0,8}(页面|展示页)/u.test(text))
    return 'page_modify';
  if (/(天气|股票|新闻|写诗|翻译|闲聊|笑话)/u.test(text)) return 'out_of_scope';
  if (
    /(能否|是否|可以|可否).{0,24}(把|将)?.*(修改|调整|删除|移除|配置|设置|改成|添加|增加)/u.test(
      text,
    )
  )
    return 'page_modify';
  if (/(怎么|如何|为什么|是什么|支持哪些|能否|可以吗|搭建器)/u.test(text)) return 'page_question';
  return 'page_modify';
}

export function deterministicSchema(
  schema: OrigamixPageSchema,
  text: string,
  runId: string,
): OrigamixPageSchema {
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
}

/** Temporary executable closure until the real model/tool capability matrix is approved. */
export class DeterministicMvpDispatcher {
  constructor(
    private readonly dependencies: {
      conversations: ConversationService;
      runs: AgentRunService;
      events: AgentEventBroker;
      projects: ProjectRepository;
    },
  ) {}

  dispatch(input: { runId: string; request: CreateAgentRunRequest }): void {
    queueMicrotask(() => this.execute(input));
  }

  private async execute({
    runId,
    request,
  }: {
    runId: string;
    request: CreateAgentRunRequest;
  }): Promise<void> {
    const run = this.dependencies.runs.get(runId);
    if (run.status !== 'queued') return;
    this.dependencies.runs.transition(runId, 'classifying');
    this.publish(runId, request, 'run.stage', { status: 'classifying' });
    if (run.mode === 'out_of_scope') {
      this.complete(
        runId,
        request,
        '我只能协助当前低代码页面的搭建与使用问题。你可以告诉我想创建或修改的表单、表格和页面布局。',
      );
      return;
    }
    if (run.mode === 'clarification_required') {
      this.complete(
        runId,
        request,
        '请说明“天气”是页面中的展示内容，还是想查询真实天气；如果是页面，请补充希望展示的字段。',
      );
      return;
    }
    if (run.mode === 'page_question') {
      this.dependencies.runs.transition(runId, 'generating');
      this.publish(runId, request, 'run.stage', { status: 'generating' });
      this.complete(
        runId,
        request,
        '请描述目标字段、校验规则、表格列和交互行为；Agent 会基于可用物料生成并校验页面 Schema。当前真实模型与工具能力尚未启用。',
      );
      return;
    }
    try {
      this.dependencies.runs.transition(runId, 'generating');
      this.publish(runId, request, 'run.stage', { status: 'generating' });
      this.dependencies.runs.transition(runId, 'tool_calling');
      this.publish(runId, request, 'tool.started', {
        toolCallId: `tool_${runId}`,
        toolName: 'replace_page_schema',
      });
      const project = this.dependencies.projects.getProject(request.projectId);
      const page = this.dependencies.projects.getPage(request.projectId, request.pageId);
      if (!project || !page) throw new Error('页面不存在或不属于当前项目');
      const pageRef = { projectPath: project.path, pageId: page.id, slug: page.slug };
      const current = await getSchema(pageRef);
      if (current.revisionId !== request.baseRevisionId)
        throw new Error('页面已更新，请刷新后重试');
      this.dependencies.runs.transition(runId, 'validating');
      this.publish(runId, request, 'run.stage', { status: 'validating' });
      this.dependencies.runs.transition(runId, 'committing');
      this.publish(runId, request, 'run.stage', { status: 'committing' });
      const committed = await commitSchema(
        pageRef,
        {
          changeSetId: `change_${runId}`,
          pageId: page.id,
          baseRevisionId: request.baseRevisionId,
          source: { kind: 'agent', runId },
          operation: 'replaceSchema',
          schema: deterministicSchema(current.schema, requestText(request), runId),
          createdAt: run.createdAt,
        },
        {
          beforeWrite: () => {
            if (this.dependencies.runs.get(runId).status === 'cancelling') {
              throw new Error('运行已取消');
            }
          },
        },
      );
      this.publish(runId, request, 'tool.completed', {
        toolCallId: `tool_${runId}`,
        toolName: 'replace_page_schema',
      });
      this.publish(runId, request, 'schema.committed', {}, committed.revisionId);
      const reply = 'Fake Engine 已生成并提交候选页面，请在编辑器中检查结果。';
      this.dependencies.conversations.finishAssistant(runId, textContent(reply));
      this.publish(runId, request, 'assistant.delta', { delta: reply });
      const completed = this.dependencies.runs.transition(runId, 'completed', {
        resultRevisionId: committed.revisionId,
      });
      this.publish(
        runId,
        request,
        'run.completed',
        { status: completed.status },
        committed.revisionId,
      );
    } catch (error) {
      const current = this.dependencies.runs.get(runId);
      if (current.status === 'cancelling') {
        this.dependencies.runs.transition(runId, 'cancelled');
        this.publish(runId, request, 'run.cancelled', { status: 'cancelled' });
        return;
      }
      const reply = error instanceof Error ? error.message : 'Fake Engine 执行失败';
      this.dependencies.conversations.failAssistant(
        runId,
        textContent('本次请求未完成，请重试。'),
        'FAKE_ENGINE_FAILED',
      );
      this.dependencies.runs.transition(runId, 'failed', {
        errorCode: 'FAKE_ENGINE_FAILED',
        errorMessage: reply,
      });
      this.publish(runId, request, 'run.failed', { status: 'failed', safeMessage: reply });
    }
  }

  private complete(runId: string, request: CreateAgentRunRequest, text: string): void {
    this.dependencies.conversations.finishAssistant(runId, textContent(text));
    const completed = this.dependencies.runs.transition(runId, 'completed');
    this.publish(runId, request, 'assistant.delta', { delta: text });
    this.publish(runId, request, 'run.completed', { status: completed.status });
  }

  private publish(
    runId: string,
    request: CreateAgentRunRequest,
    type: string,
    payload: unknown,
    revisionId?: string,
  ): void {
    this.dependencies.events.publish({
      type,
      runId,
      pageId: request.pageId,
      requestId: request.clientRequestId,
      ...(revisionId ? { revisionId } : {}),
      payload,
    });
  }
}
