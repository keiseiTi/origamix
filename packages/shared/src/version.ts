/** Application/package release; independent of persisted contracts. */
export const ORIGAMIX_VERSION = '1.0.0' as const;

/** Persisted contract versions. */
export const SCHEMA_VERSION = '1.0.0' as const;
export const MATERIAL_CONTRACT_VERSION = '1.0.0' as const;

// SemVer 2.0.0, including prerelease and build metadata; numeric identifiers have no leading zero.
export const SEMVER_PATTERN =
  '^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$(?![\\s\\S])';
export const isSemanticVersion = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 100 && new RegExp(SEMVER_PATTERN).test(value);

/** Check a persisted contract against the current format. */
export const contractCompatibilityIssue = (
  label: string,
  version: unknown,
  expected: string,
): string | null => {
  if (!isSemanticVersion(version)) return `${label} 版本不是有效的语义化版本`;
  if (version === expected) return null;
  return `${label} ${version} 不受当前应用支持（支持 ${expected}）。仅接受当前契约，不执行格式转换，文件保持原样。`;
};
