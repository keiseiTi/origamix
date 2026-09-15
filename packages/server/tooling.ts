/** Internal evaluation, capability probing and release-gate entry point. */
export * from './evaluation/evaluation-harness';
export * from './evaluation/mvp-gate';
export * from './evaluation/security-audit';
export { probeDeepSeekCapabilities } from './evaluation/model-capability-probe';
export type {
  DeepSeekCapabilityReport,
  ModelProbeFailureCode,
  ModelProbeObservation,
  ProbeStream,
} from './evaluation/model-capability-probe';
