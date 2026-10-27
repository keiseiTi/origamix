export interface ProductDocument {
  id: string;
  sectionId: string;
  version: string;
  title: string;
  keywords: readonly string[];
  markdown: string;
}

export interface ProductDocSnippet {
  documentId: string;
  sectionId: string;
  version: string;
  title: string;
  snippet: string;
  truncated: boolean;
  trust: 'untrusted_reference';
}

export interface ProductDocsSearchInput {
  query: string;
  version?: string;
  limit?: number;
  maxSnippetChars?: number;
}

export const DEFAULT_PRODUCT_DOCS: readonly ProductDocument[] = [
  {
    id: 'builder-page-basics',
    sectionId: 'describe-page',
    version: '1.0.0',
    title: '在搭建器中创建页面内容',
    keywords: ['搭建器', '页面', '表单', '表格', '物料'],
    markdown:
      '# 在搭建器中创建页面内容\n\n描述页面用途、字段和交互。Agent 会使用当前官方物料清单生成修改，并在服务端校验后提交。创建表单时请说明字段名称、字段类型、必填项和提交按钮；表单字段应放在表单容器中。创建表格时请说明列名、数据类型以及需要的排序、筛选或操作列。未说明的关键业务含义会先向你确认。',
  },
  {
    id: 'builder-agent-safety',
    sectionId: 'revision-and-recovery',
    version: '1.0.0',
    title: 'Agent 修改与恢复',
    keywords: ['Agent', '修改', '校验', '撤销', '版本'],
    markdown:
      '# Agent 修改与恢复\n\n每次修改基于当前页面 Working Version，并通过 Operation List 原子更新 Working Schema。提交失败不会覆盖有效草稿；成功修改只保留草稿，不会自动保存 Revision 或应用到真实项目。用户可点击“保存版本”创建历史检查点，也可从版本历史恢复到 Working 草稿。网络中断后可使用同一请求重试，系统不会重复执行已确认的请求。',
  },
  {
    id: 'builder-agent-scope',
    sectionId: 'supported-requests',
    version: '1.0.0',
    title: 'Agent 能处理的请求',
    keywords: [
      '范围',
      '支持',
      '限制',
      '天气',
      '页面',
      '搭建',
      '逻辑流',
      '流程编排',
      '事件',
      '请求',
      '接口',
    ],
    markdown:
      '# Agent 能处理的请求\n\nAgent 支持当前页面的组件搭建、属性修改、事件逻辑流编排，以及页面和搭建器使用问题解答。一次请求可以同时修改组件、全局变量与事件流程；具体能力以当前项目的物料 Manifest 和流程节点 Manifest 为准。\n\n逻辑流支持 HTTP 请求、条件分支、元素属性设置、方法调用、显隐、全局变量和弹窗操作，也支持表达式与函数配置。HTTP 请求由页面 Runtime 执行，不使用工作台或桌面凭据；接口地址等关键事实缺失时需要澄清，不能臆造接口或凭据。页面 HTTP 请求不等于产品已提供外部数据源管理或后端服务搭建能力。\n\n修改只更新当前页面 Working 草稿，不自动保存 Revision 或 Apply 到真实项目；提交成功不代表事件已经在预览中验证。用户需要预览并检查实际交互，再明确保存版本与应用到项目。\n\nAgent 不跨页面或跨项目修改，不直接写项目文件，不提供发布、多人协作或外部数据源管理。闲聊、天气、新闻等与页面搭建无关的请求不在处理范围内。',
  },
] as const;

const terms = (value: string): string[] => {
  const normalized = value.toLocaleLowerCase().trim();
  if (!normalized) return [];
  const chunks = normalized.match(/[\p{Script=Han}]{2,}|[a-z0-9_-]{2,}/gu) ?? [];
  const result = new Set<string>(chunks);
  for (const chunk of chunks) {
    if (/^[\p{Script=Han}]+$/u.test(chunk)) {
      for (let index = 0; index < chunk.length - 1; index += 1)
        result.add(chunk.slice(index, index + 2));
    }
  }
  return [...result];
};

const score = (document: ProductDocument, queryTerms: readonly string[]): number => {
  const title = document.title.toLocaleLowerCase();
  const keywords = document.keywords.join(' ').toLocaleLowerCase();
  const body = document.markdown.toLocaleLowerCase();
  return queryTerms.reduce(
    (total, term) =>
      total +
      (title.includes(term) ? 8 : 0) +
      (keywords.includes(term) ? 4 : 0) +
      (body.includes(term) ? 1 : 0),
    0,
  );
};

const safeSnippet = (
  markdown: string,
  maxChars: number,
): { snippet: string; truncated: boolean } => {
  // Strip invisible control characters and neutralize our context delimiter. The text remains explicitly untrusted.
  const cleaned = markdown
    .split('')
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join('')
    .replaceAll('<<<END_UNTRUSTED_PRODUCT_DOC>>>', '[escaped document delimiter]');
  if (cleaned.length <= maxChars) return { snippet: cleaned, truncated: false };
  return { snippet: `${cleaned.slice(0, Math.max(0, maxChars - 1))}…`, truncated: true };
};

export class ProductDocsProvider {
  constructor(private readonly documents: readonly ProductDocument[] = DEFAULT_PRODUCT_DOCS) {}

  search(input: ProductDocsSearchInput): ProductDocSnippet[] {
    const queryTerms = terms(input.query);
    if (queryTerms.length === 0) return [];
    const maxSnippetChars = Math.max(64, Math.min(input.maxSnippetChars ?? 1_200, 8_000));
    const limit = Math.max(1, Math.min(input.limit ?? 3, 10));
    return this.documents
      .filter((document) => !input.version || document.version === input.version)
      .map((document) => ({ document, score: score(document, queryTerms) }))
      .filter(({ score: rank }) => rank > 0)
      .sort(
        (left, right) =>
          right.score - left.score || left.document.id.localeCompare(right.document.id),
      )
      .slice(0, limit)
      .map(({ document }) => ({
        documentId: document.id,
        sectionId: document.sectionId,
        version: document.version,
        title: document.title,
        ...safeSnippet(document.markdown, maxSnippetChars),
        trust: 'untrusted_reference' as const,
      }));
  }
}
