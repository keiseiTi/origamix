export interface AgentSecurityEvidence {
  logs: readonly string[];
  sqliteValues: readonly string[];
  projectFiles: readonly string[];
  urls: readonly string[];
  sseFrames: readonly string[];
  clientState: readonly string[];
  previewCapabilities: readonly string[];
  deniedAttacks: readonly string[];
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

function containsSecret(values: readonly string[]): boolean {
  return values.some((value) => secretPatterns.some((pattern) => pattern.test(value)));
}

/** Audits redacted boundary snapshots only; callers must never place real credentials in fixtures. */
export function auditAgentSecurity(evidence: AgentSecurityEvidence): AgentSecurityAuditResult {
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
        ? 'Preview 仅暴露只读能力'
        : `Preview 暴露写能力：${forbidden.join(', ')}`,
  });
  const missing = [...requiredAttacks].filter((item) => !evidence.deniedAttacks.includes(item));
  checks.push({
    id: 'attack_matrix_denied',
    passed: missing.length === 0,
    detail: missing.length === 0 ? '固定攻击矩阵全部被拒绝' : `缺少拒绝证据：${missing.join(', ')}`,
  });
  return { passed: checks.every((check) => check.passed), checks };
}
