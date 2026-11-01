export interface AgentSecurityEvidence {
  logs: readonly string[];
  sqliteValues: readonly string[];
  projectFiles: readonly string[];
  urls: readonly string[];
  sseFrames: readonly string[];
  clientState: readonly string[];
  previewCapabilities: readonly string[];
  reportedDeniedAttacks: readonly string[];
}

export interface AgentSecurityAuditResult {
  passed: boolean;
  checks: Array<{ id: string; passed: boolean; detail: string }>;
}

const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/,
  /\bBearer\s+(?!\[REDACTED\])[A-Za-z0-9._~+/-]{8,}/i,
  /\b(?:api[_-]?key|token|secret)\s*[:=]\s*(?!\[REDACTED\])[^\s,;]{8,}/i,
] as const;
const forbiddenPreviewCapabilities = new Set([
  'backend.getConnection',
  'schema.commit',
  'agent.createRun',
  'filesystem.write',
  'shell.execute',
]);
const requiredAttacks = new Set([
  'prompt_injection',
  'malicious_manifest',
  'malicious_document',
  'forged_page_id',
  'forged_run_id',
  'forged_tool',
  'cross_project_read',
  'credential_request',
]);

const containsSecret = (values: readonly string[]): boolean => {
  return values.some((value) => secretPatterns.some((pattern) => pattern.test(value)));
};

/** Checks supplied redacted snapshots and caller-reported denials; does not execute attacks or measure live security. */
export const checkAgentSecurityEvidence = (
  evidence: AgentSecurityEvidence,
): AgentSecurityAuditResult => {
  const channels = [
    ['logs', evidence.logs],
    ['sqlite', evidence.sqliteValues],
    ['project', evidence.projectFiles],
    ['url', evidence.urls],
    ['sse', evidence.sseFrames],
    ['client', evidence.clientState],
  ] as const;
  const checks = channels.map(([id, values]) => ({
    id: `no_plaintext_secret_${id}`,
    passed: !containsSecret(values),
    detail: `检查 ${id} 中的 Bearer、API Key、token 与 secret`,
  }));
  const forbidden = evidence.previewCapabilities.filter((item) =>
    forbiddenPreviewCapabilities.has(item),
  );
  checks.push({
    id: 'preview_read_only',
    passed: forbidden.length === 0,
    detail:
      forbidden.length === 0
        ? '所提供的 Preview 能力列表未包含已知写能力'
        : `Preview 暴露写能力：${forbidden.join(', ')}`,
  });
  const missing = [...requiredAttacks].filter(
    (item) => !evidence.reportedDeniedAttacks.includes(item),
  );
  checks.push({
    id: 'attack_matrix_reported',
    passed: missing.length === 0,
    detail:
      missing.length === 0
        ? '调用方已报告完整攻击矩阵的拒绝结果，未在此执行攻击'
        : `缺少拒绝证据：${missing.join(', ')}`,
  });
  return { passed: checks.every((check) => check.passed), checks };
};
