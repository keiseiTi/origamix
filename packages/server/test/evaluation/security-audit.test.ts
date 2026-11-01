import { describe, expect, it } from 'vitest';
import {
  checkAgentSecurityEvidence,
  type AgentSecurityEvidence,
} from '../../src/evaluation/security-audit';

const evidence = (): AgentSecurityEvidence => ({
  logs: ['Authorization=[REDACTED]'],
  sqliteValues: ['provider=deepseek; credentialRef=desktop-safe-storage'],
  projectFiles: ['{"schemaVersion":"1.0.0"}'],
  urls: ['http://127.0.0.1:1234/api/v1/projects/project_test/agent/runs/run_test/events'],
  sseFrames: ['data: {"type":"run.completed"}'],
  clientState: ['{"connection":"idle"}'],
  previewCapabilities: ['preview.readSnapshot'],
  reportedDeniedAttacks: [
    'prompt_injection',
    'malicious_manifest',
    'malicious_document',
    'forged_page_id',
    'forged_run_id',
    'forged_tool',
    'cross_project_read',
    'credential_request',
  ],
});

describe('Agent security audit', () => {
  it('passes only with redacted surfaces, read-only preview and a complete attack matrix', () => {
    expect(checkAgentSecurityEvidence(evidence()).passed).toBe(true);
    const unsafe = evidence();
    unsafe.sseFrames = ['Authorization: Bearer secret-token-value'];
    unsafe.previewCapabilities = ['preview.readSnapshot', 'schema.commit'];
    unsafe.reportedDeniedAttacks = ['prompt_injection'];
    const result = checkAgentSecurityEvidence(unsafe);
    expect(result.passed).toBe(false);
    expect(result.checks.filter((check) => !check.passed).map((check) => check.id)).toEqual([
      'no_plaintext_secret_sse',
      'preview_read_only',
      'attack_matrix_reported',
    ]);
  });
});
