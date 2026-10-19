import { Type, type Static, type TSchema } from '@sinclair/typebox';
import { Check } from '@sinclair/typebox/value';
import {
  FLOW_NODE_MANIFEST_VERSION,
  getFlowNodeManifest,
  type OrigamixPageSchema,
  type MaterialManifestCatalog,
} from '@origamix/shared';
import { invalid, notFound } from '../../errors';
import type { AgentEngineTool } from '../engine';

const object = <T extends Record<string, TSchema>>(properties: T) =>
  Type.Object(properties, { additionalProperties: false });
export const exactReadPagination = {
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
  maxChars: Type.Optional(Type.Integer({ minimum: 256, maximum: 12_000 })),
};
const ManifestInput = object({
  type: Type.String({ minLength: 1, maxLength: 80 }),
  ...exactReadPagination,
});
const FlowInput = object({
  flowId: Type.Optional(Type.String({ minLength: 1 })),
  elementId: Type.Optional(Type.String({ pattern: '^[A-Za-z][A-Za-z0-9_-]*$' })),
  event: Type.Optional(Type.String({ minLength: 1 })),
  ...exactReadPagination,
});
const ContextInput = object(exactReadPagination);

interface LogicSnapshot {
  schema: OrigamixPageSchema;
  workingVersion: number;
  revisionId: string;
  materials: MaterialManifestCatalog;
}

/** Exact JSON pages never shorten code, nested values, or binding lists. */
export const exactReadResult = (
  data: unknown,
  workingVersion: number,
  input: { offset?: number; maxChars?: number },
) => {
  const json = JSON.stringify(data);
  const offset = input.offset ?? 0;
  if (offset > json.length) throw invalid('读取偏移超出内容范围');
  const maxChars = input.maxChars ?? 8_000;
  const maxBytes = 24 * 1024;
  const full = { workingVersion, complete: true, data };
  if (
    !offset &&
    json.length <= maxChars &&
    Buffer.byteLength(JSON.stringify(full), 'utf8') <= maxBytes
  )
    return full;
  let end = Math.min(json.length, offset + maxChars);
  const page = () => ({
    workingVersion,
    complete: false,
    format: 'json_text_chunk',
    offset,
    totalChars: json.length,
    nextOffset: end < json.length ? end : null,
    json: json.slice(offset, end),
  });
  while (Buffer.byteLength(JSON.stringify(page()), 'utf8') > maxBytes)
    end = offset + Math.max(1, Math.floor((end - offset) / 2));
  return page();
};

const parse = <T>(schema: TSchema, raw: unknown): T => {
  if (!Check(schema, raw)) throw invalid('逻辑只读工具参数无效');
  return raw as T;
};

export const createLogicReadTools = (
  load: (signal: AbortSignal) => Promise<LogicSnapshot>,
): AgentEngineTool[] => [
  {
    name: 'get_flow_node_manifest',
    description:
      '读取 Shared 中准确节点 type 的完整参数、返回值和连接约束。defaultProps 是可未完成的编辑草稿，不是可执行示例。结果 complete=false 时，按 nextOffset 读取至 null，按 offset 拼接 json 后解析，禁止依据不完整参数生成流程。',
    parameters: ManifestInput,
    execute: async (raw, signal) => {
      const input = parse<Static<typeof ManifestInput>>(ManifestInput, raw);
      const { workingVersion } = await load(signal);
      const manifest = getFlowNodeManifest(input.type);
      if (!manifest) throw notFound('逻辑节点类型不存在');
      return exactReadResult(
        { formatVersion: FLOW_NODE_MANIFEST_VERSION, manifest },
        workingVersion,
        input,
      );
    },
  },
  {
    name: 'get_event_flow',
    description:
      '按 flowId 或 elementId+event（二选一）精确读取 Run 起始 Working 中的完整流程及所有引用它的事件绑定。无绑定时 flow 为 null。修改已有流程前必须完整读取；结果 complete=false 时连续读取 nextOffset 至 null，按 offset 拼接 json 后解析。共享流程只改一个事件时应复制为新 flowId 并局部重新绑定。',
    parameters: FlowInput,
    execute: async (raw, signal) => {
      const input = parse<Static<typeof FlowInput>>(FlowInput, raw);
      if (
        input.flowId
          ? input.elementId !== undefined || input.event !== undefined
          : !input.elementId || !input.event
      )
        throw invalid('必须且只能指定 flowId 或 elementId + event');
      const { schema, workingVersion, materials } = await load(signal);
      let flowId = input.flowId;
      if (input.elementId) {
        if (!Object.hasOwn(schema.elements, input.elementId))
          throw notFound('元素不存在或不属于当前页面');
        const material = materials.materials.find(
          (item) => item.type === schema.elements[input.elementId!]!.type,
        );
        if (!material?.context.methods.some((entry) => entry.name === input.event))
          throw invalid('事件未由目标物料声明');
        flowId = schema.bindElements.find(
          (binding) => binding.id === input.elementId && binding.event === input.event,
        )?.flowId;
      }
      if (flowId && !Object.hasOwn(schema.flows, flowId))
        throw notFound('流程不存在或不属于当前页面');
      return exactReadResult(
        {
          flowId: flowId ?? null,
          flow: flowId ? schema.flows[flowId] : null,
          bindings: flowId
            ? schema.bindElements.filter((binding) => binding.flowId === flowId)
            : [],
        },
        workingVersion,
        input,
      );
    },
  },
  {
    name: 'get_page_logic_context',
    description:
      '精确读取当前 Run 页面的全部事件绑定、流程摘要及全局变量声明。修改绑定或变量前核实已有内容。结果 complete=false 时按 nextOffset 读取至 null，按 offset 拼接 json 后解析；截断摘要不能当作完整页面事实。',
    parameters: ContextInput,
    execute: async (raw, signal) => {
      const input = parse<Static<typeof ContextInput>>(ContextInput, raw);
      const { schema, workingVersion } = await load(signal);
      return exactReadResult(
        {
          bindings: schema.bindElements,
          globalVariables: schema.context.globalVariables,
          flows: Object.entries(schema.flows).map(([flowId, flow]) => ({
            flowId,
            startId: flow.startId,
            nodeCount: Object.keys(flow.nodes).length,
          })),
        },
        workingVersion,
        input,
      );
    },
  },
];
