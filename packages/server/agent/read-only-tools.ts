import { Type, type Static, type TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import {
  antdAgentMaterialCatalog,
  antdMaterialManifest,
  getAntdMaterialManifests,
} from '@origamix/materials/antd/manifest';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import type { ProjectRepository } from '../repositories/project-repository';
import { conflict, invalid, notFound } from '../errors';
import { getSchema, type SchemaPageRef, type SchemaReadResult } from '../services/schema-service';
import type { AgentEngineTool } from './agent-engine';

const strictObject = <T extends Record<string, TSchema>>(properties: T) =>
  Type.Object(properties, { additionalProperties: false });

const ScopeSchema = {
  projectId: Type.String({ minLength: 1, maxLength: 160 }),
  pageId: Type.String({ pattern: '^page_[A-Za-z0-9_-]+$' }),
  revisionId: Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' }),
};
const PageScopeInputSchema = strictObject(ScopeSchema);
const SchemaFragmentInputSchema = strictObject({
  ...ScopeSchema,
  elementId: Type.String({ pattern: '^[A-Za-z][A-Za-z0-9_-]*$' }),
  depth: Type.Optional(Type.Integer({ minimum: 0, maximum: 4 })),
  maxElements: Type.Optional(Type.Integer({ minimum: 1, maximum: 40 })),
});
const SearchMaterialsInputSchema = strictObject({
  ...ScopeSchema,
  query: Type.String({ minLength: 1, maxLength: 80 }),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 8 })),
});
const MaterialManifestInputSchema = strictObject({
  ...ScopeSchema,
  type: Type.String({ pattern: '^[a-z][a-z0-9-]*$', maxLength: 80 }),
});

type PageScopeInput = Static<typeof PageScopeInputSchema>;
type SchemaFragmentInput = Static<typeof SchemaFragmentInputSchema>;
type SearchMaterialsInput = Static<typeof SearchMaterialsInputSchema>;
type MaterialManifestInput = Static<typeof MaterialManifestInputSchema>;

export interface ReadOnlyToolScope {
  runId: string;
  projectId: string;
  pageId: string;
  revisionId: string;
}

export interface ReadOnlyToolDependencies {
  projects: Pick<ProjectRepository, 'getProject' | 'getPage'>;
  readSchema?: (page: SchemaPageRef) => Promise<SchemaReadResult>;
}

type JsonObject = Record<string, unknown>;
const MAX_RESULT_BYTES = 24 * 1024;
const MAX_PROP_KEYS = 24;
const MAX_STRING_LENGTH = 400;

const assertInput = <T>(schema: TSchema, input: unknown): T => {
  if (!Value.Check(schema, input)) throw invalid('只读工具参数无效');
  return input as T;
};

const compactValue = (value: unknown, depth = 0): unknown => {
  if (typeof value === 'string')
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…[truncated]`
      : value;
  if (value === null || typeof value !== 'object') return value;
  if (depth >= 4) return '[nested value omitted]';
  if (Array.isArray(value)) {
    const values = value.slice(0, 30).map((entry) => compactValue(entry, depth + 1));
    if (value.length > values.length)
      values.push(`[${value.length - values.length} items omitted]`);
    return values;
  }
  const entries = Object.entries(value as JsonObject);
  const result = Object.fromEntries(
    entries.slice(0, MAX_PROP_KEYS).map(([key, entry]) => [key, compactValue(entry, depth + 1)]),
  );
  if (entries.length > MAX_PROP_KEYS) result.$omittedKeys = entries.length - MAX_PROP_KEYS;
  return result;
};

const boundedResult = (value: JsonObject): JsonObject => {
  const compact = compactValue(value) as JsonObject;
  const serialized = JSON.stringify(compact);
  if (Buffer.byteLength(serialized, 'utf8') <= MAX_RESULT_BYTES) return compact;
  return {
    truncated: true,
    reason: 'result_size_limit',
    byteLimit: MAX_RESULT_BYTES,
    preview: serialized.slice(0, MAX_RESULT_BYTES / 2),
  };
};

const elementSummary = (schema: OrigamixPageSchema, elementId: string): JsonObject => {
  const element = schema.elements[elementId]!;
  return {
    id: elementId,
    type: element.type,
    props: compactValue(element.props),
    childIds: schema.layout.structure[elementId] ?? [],
  };
};

/** Creates read-only tools whose project/page/revision authority is fixed for one Agent Run. */
export const createReadOnlyAgentTools = (
  scope: ReadOnlyToolScope,
  dependencies: ReadOnlyToolDependencies,
): AgentEngineTool[] => {
  const cache = new Map<string, Promise<unknown>>();
  let schemaPromise: Promise<SchemaReadResult> | undefined;

  const assertNotAborted = (signal: AbortSignal): void => {
    if (signal.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
  };

  const load = async (input: PageScopeInput, signal: AbortSignal): Promise<SchemaReadResult> => {
    assertNotAborted(signal);
    if (
      input.projectId !== scope.projectId ||
      input.pageId !== scope.pageId ||
      input.revisionId !== scope.revisionId
    ) {
      throw notFound('页面或 Revision 不属于当前 Agent Run');
    }
    const project = dependencies.projects.getProject(scope.projectId);
    if (!project || project.status !== 'available') throw notFound('项目不存在或不可用');
    const page = dependencies.projects.getPage(scope.projectId, scope.pageId);
    if (!page || page.status !== 'active') throw notFound('页面不存在或不属于该项目');
    schemaPromise ??= (dependencies.readSchema ?? getSchema)({
      projectPath: project.path,
      pageId: page.id,
      slug: page.slug,
    });
    const current = await schemaPromise;
    if (current.revisionId !== scope.revisionId) throw conflict('页面 Revision 已变化');
    return current;
  };

  const cached = async <T>(key: string, factory: () => Promise<T>): Promise<T> => {
    const existing = cache.get(key);
    if (existing) return existing as Promise<T>;
    const pending = factory();
    cache.set(key, pending);
    try {
      return await pending;
    } catch (error) {
      if (cache.get(key) === pending) cache.delete(key);
      throw error;
    }
  };

  return [
    {
      name: 'get_page_context',
      description: '读取当前页面的精简上下文、Revision 和物料使用统计。',
      parameters: PageScopeInputSchema,
      execute: async (raw, signal) => {
        assertNotAborted(signal);
        const input = assertInput<PageScopeInput>(PageScopeInputSchema, raw);
        return cached('page-context', async () => {
          const { schema, revisionId } = await load(input, signal);
          const page = dependencies.projects.getPage(scope.projectId, scope.pageId)!;
          const materialTypes = Object.values(schema.elements).map(({ type }) => type);
          return boundedResult({
            projectId: scope.projectId,
            page: { id: page.id, name: page.name, slug: page.slug },
            revisionId,
            schemaVersion: schema.extensions.origamix.schemaVersion,
            rootElementId: schema.layout.root,
            elementCount: Object.keys(schema.elements).length,
            materialTypes: [...new Set(materialTypes)].sort(),
            materialSet: antdMaterialManifest.materialSet,
          });
        });
      },
    },
    {
      name: 'get_schema_outline',
      description: '读取当前页面元素树的精简轮廓，不返回完整 props。',
      parameters: PageScopeInputSchema,
      execute: async (raw, signal) => {
        assertNotAborted(signal);
        const input = assertInput<PageScopeInput>(PageScopeInputSchema, raw);
        return cached('schema-outline', async () => {
          const { schema, revisionId } = await load(input, signal);
          const maxElements = 120;
          const seen = new Set<string>();
          const nodes: JsonObject[] = [];
          const visit = (id: string, depth: number): void => {
            if (seen.has(id) || nodes.length >= maxElements) return;
            const element = schema.elements[id];
            if (!element) return;
            seen.add(id);
            nodes.push({
              id,
              type: element.type,
              depth,
              propKeys: Object.keys(element.props).slice(0, MAX_PROP_KEYS),
            });
            for (const child of schema.layout.structure[id] ?? []) visit(child, depth + 1);
          };
          visit(schema.layout.root, 0);
          return boundedResult({
            revisionId,
            rootElementId: schema.layout.root,
            nodes,
            truncated: seen.size < Object.keys(schema.elements).length,
            totalElements: Object.keys(schema.elements).length,
          });
        });
      },
    },
    {
      name: 'get_schema_fragment',
      description: '按元素 ID 读取当前页面的一段 Schema；只能读取属于当前页面的元素。',
      parameters: SchemaFragmentInputSchema,
      execute: async (raw, signal) => {
        assertNotAborted(signal);
        const input = assertInput<SchemaFragmentInput>(SchemaFragmentInputSchema, raw);
        const depth = input.depth ?? 1;
        const maxElements = input.maxElements ?? 20;
        return cached(`fragment:${input.elementId}:${depth}:${maxElements}`, async () => {
          const { schema, revisionId } = await load(input, signal);
          if (!schema.elements[input.elementId]) throw notFound('元素不存在或不属于当前页面');
          const elements: JsonObject[] = [];
          const seen = new Set<string>();
          let truncated = false;
          const visit = (id: string, currentDepth: number): void => {
            if (seen.has(id)) return;
            if (elements.length >= maxElements || currentDepth > depth) {
              truncated = true;
              return;
            }
            seen.add(id);
            elements.push(elementSummary(schema, id));
            for (const child of schema.layout.structure[id] ?? []) visit(child, currentDepth + 1);
          };
          visit(input.elementId, 0);
          return boundedResult({
            revisionId,
            requestedElementId: input.elementId,
            elements,
            truncated,
          });
        });
      },
    },
    {
      name: 'search_materials',
      description: '在 official-antd 物料摘要中搜索类型、名称、说明或关键词。',
      parameters: SearchMaterialsInputSchema,
      execute: async (raw, signal) => {
        assertNotAborted(signal);
        const input = assertInput<SearchMaterialsInput>(SearchMaterialsInputSchema, raw);
        await load(input, signal);
        const query = input.query.trim().toLocaleLowerCase();
        if (!query) throw invalid('物料搜索词不能为空');
        const limit = input.limit ?? 5;
        return cached(`material-search:${query}:${limit}`, async () => {
          const matches = antdAgentMaterialCatalog
            .filter((material) =>
              [material.type, material.title, material.description, ...material.keywords]
                .join('\n')
                .toLocaleLowerCase()
                .includes(query),
            )
            .slice(0, limit);
          return boundedResult({ materialSet: antdMaterialManifest.materialSet, query, matches });
        });
      },
    },
    {
      name: 'get_material_manifest',
      description: '按准确 type 读取 official-antd 的单个纯数据 Material Manifest。',
      parameters: MaterialManifestInputSchema,
      execute: async (raw, signal) => {
        assertNotAborted(signal);
        const input = assertInput<MaterialManifestInput>(MaterialManifestInputSchema, raw);
        await load(input, signal);
        return cached(`material-manifest:${input.type}`, async () => {
          const manifest = getAntdMaterialManifests([input.type])[0];
          if (!manifest) throw notFound('物料类型不存在于当前 Material Set');
          return boundedResult({ materialSet: antdMaterialManifest.materialSet, manifest });
        });
      },
    },
  ];
};
