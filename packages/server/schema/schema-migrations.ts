import { ORIGAMIX_VERSION, validatePage, type OrigamixPageSchema } from '@origamix/shared';
import { invalid } from '../errors';

export interface SchemaMigration {
  from: string;
  to: string;
  transform: (schema: unknown) => unknown;
}

export const schemaVersionOf = (value: unknown): string => {
  if (!value || typeof value !== 'object') throw invalid('Schema 缺少来源版本');
  const version = (value as { extensions?: { origamix?: { schemaVersion?: unknown } } }).extensions
    ?.origamix?.schemaVersion;
  if (typeof version !== 'string') throw invalid('Schema 缺少来源版本');
  return version;
};

// The initial MVP persisted "1.0". Its shape is identical to release 1.0.0;
// this explicit step is the only accepted pre-release format, never a missing-version fallback.
const transformSchema_1_0_to_1_0_0 = (input: unknown): unknown => {
  const schema = input as OrigamixPageSchema;
  return {
    ...schema,
    extensions: {
      ...schema.extensions,
      origamix: { ...schema.extensions.origamix, schemaVersion: '1.0.0' },
    },
  };
};

export const schemaMigrations: readonly SchemaMigration[] = [
  { from: '1.0', to: '1.0.0', transform: transformSchema_1_0_to_1_0_0 },
];

/** Pure, all-or-nothing candidate conversion; persistence belongs to SchemaService. */
export const transformSchema = (
  source: unknown,
  migrations: readonly SchemaMigration[] = schemaMigrations,
  targetVersion: string = ORIGAMIX_VERSION,
): OrigamixPageSchema => {
  const from = schemaVersionOf(source);
  let current = from;
  let candidate: unknown = structuredClone(source);
  const visited = new Set<string>();
  while (current !== targetVersion) {
    if (visited.has(current)) throw invalid(`Schema 迁移链存在循环：${from} → ${targetVersion}`);
    visited.add(current);
    const steps = migrations.filter((step) => step.from === current);
    if (steps.length !== 1) throw invalid(`Schema 缺少唯一迁移路径：${current} → ${targetVersion}`);
    const step = steps[0]!;
    try {
      candidate = step.transform(candidate);
      if (schemaVersionOf(candidate) !== step.to) throw new Error('转换结果版本不匹配');
    } catch {
      throw invalid(`Schema 迁移失败：${step.from} → ${step.to}，原草稿已保留`);
    }
    current = step.to;
  }
  const validation = validatePage(candidate);
  if (!validation.valid)
    throw invalid(`Schema 迁移校验失败：${from} → ${targetVersion}，原草稿已保留`);
  return candidate as OrigamixPageSchema;
};
