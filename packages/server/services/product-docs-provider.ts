export interface ProductDocument {
  id: string;
  version: string;
  title: string;
  keywords: readonly string[];
  markdown: string;
}

export interface ProductDocSnippet {
  documentId: string;
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
    version: '1.0.0',
    title: '在搭建器中创建页面内容',
    keywords: ['搭建器', '页面', '表单', '表格', '物料'],
    markdown:
      '# 在搭建器中创建页面内容\n\n描述页面用途、字段和交互。Agent 会使用当前官方物料清单生成修改，并在服务端校验后提交。表单字段应放在表单容器中。',
  },
  {
    id: 'builder-agent-safety',
    version: '1.0.0',
    title: 'Agent 修改与恢复',
    keywords: ['Agent', '修改', '校验', '撤销', '版本'],
    markdown:
      '# Agent 修改与恢复\n\n每次修改基于当前页面 Revision。提交失败不会覆盖有效页面；成功修改会生成新 Revision，并可通过页面历史撤销。',
  },
] as const;

function terms(value: string): string[] {
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
}

function score(document: ProductDocument, queryTerms: readonly string[]): number {
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
}

function safeSnippet(markdown: string, maxChars: number): { snippet: string; truncated: boolean } {
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
}

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
        version: document.version,
        title: document.title,
        ...safeSnippet(document.markdown, maxSnippetChars),
        trust: 'untrusted_reference' as const,
      }));
  }
}
