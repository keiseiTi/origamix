/** Application/package release; independent of persisted contracts. */
export const ORIGAMIX_VERSION = '1.0.0' as const;

/** SemVer contracts: patch fixes, minor backward-compatible additions, major breaking changes. */
export const SCHEMA_VERSION = '1.0.0' as const;
export const MATERIAL_CONTRACT_VERSION = '1.0.0' as const;
export const SUPPORTED_SCHEMA_VERSIONS: readonly string[] = [SCHEMA_VERSION];
export const SUPPORTED_MATERIAL_VERSIONS: readonly string[] = [MATERIAL_CONTRACT_VERSION];

// SemVer 2.0.0, including prerelease and build metadata; numeric identifiers have no leading zero.
export const SEMVER_PATTERN =
  '^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$(?![\\s\\S])';
export const isSemanticVersion = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 100 && new RegExp(SEMVER_PATTERN).test(value);

const compareIdentifier = (left: string, right: string): number => {
  if (left === right) return 0;
  const numeric = (value: string): boolean => /^[0-9]+$/.test(value);
  if (numeric(left) && numeric(right))
    return left.length === right.length
      ? left < right
        ? -1
        : 1
      : left.length < right.length
        ? -1
        : 1;
  if (numeric(left) !== numeric(right)) return numeric(left) ? -1 : 1;
  return left < right ? -1 : 1;
};
const compareSemanticVersions = (left: string, right: string): number => {
  const split = (value: string): [string[], string[]] => {
    const [core, ...pre] = value.split('+')[0]!.split('-');
    return [core!.split('.'), pre.length ? pre.join('-').split('.') : []];
  };
  const [a, ap] = split(left),
    [b, bp] = split(right);
  for (let index = 0; index < 3; index += 1) {
    const result = compareIdentifier(a[index]!, b[index]!);
    if (result) return result;
  }
  if (!ap.length || !bp.length) return ap.length === bp.length ? 0 : ap.length ? -1 : 1;
  for (let index = 0; index < Math.max(ap.length, bp.length); index += 1) {
    if (index >= ap.length) return -1;
    if (index >= bp.length) return 1;
    const result = compareIdentifier(ap[index]!, bp[index]!);
    if (result) return result;
  }
  return 0;
};

/** Exact support declarations, not an inferred SemVer compatibility range. */
export const contractCompatibilityIssue = (
  label: string,
  version: unknown,
  supported: readonly string[],
): string | null => {
  if (!isSemanticVersion(version)) return `${label} 版本不是有效的语义化版本`;
  if (supported.includes(version)) return null;
  const newer =
    supported.length > 0 && supported.every((value) => compareSemanticVersions(version, value) > 0);
  const action = newer ? '请升级应用至支持该契约的版本' : '需要使用兼容应用或转换项目';
  return `${label} ${version} 不受当前应用支持（支持 ${supported.join('、')}）。${action}；当前未提供转换能力，文件不会自动升级或降级。`;
};
