import {
  SCHEMA_VERSION,
  SUPPORTED_SCHEMA_VERSIONS,
  contractCompatibilityIssue,
  isSemanticVersion,
  validatePage,
  type OrigamixPageSchema,
} from '@origamix/shared';
import { invalid } from '../errors';

export const schemaVersionOf = (value: unknown): string => {
  const version = (value as { extensions?: { origamix?: { schemaVersion?: unknown } } } | null)
    ?.extensions?.origamix?.schemaVersion;
  if (!isSemanticVersion(version)) throw invalid('Schema 缺少有效的语义化版本');
  return version;
};
export const requireCompatibleSchema = (source: unknown): OrigamixPageSchema => {
  const issue = contractCompatibilityIssue(
    'Schema',
    schemaVersionOf(source),
    SUPPORTED_SCHEMA_VERSIONS,
  );
  if (issue) throw invalid(issue);
  const validation = validatePage(source);
  if (!validation.valid) throw invalid(`Schema ${SCHEMA_VERSION} 内容校验失败，原数据已保留`);
  return source as OrigamixPageSchema;
};
