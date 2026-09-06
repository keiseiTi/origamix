import { createRequire } from 'node:module';

const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
if (!apiKey) {
  console.error('Skipped: set DEEPSEEK_API_KEY to run the real DeepSeek capability probe.');
} else {
  const require = createRequire(import.meta.url);
  const { probeDeepSeekCapabilities } = require('../dist/runtime.cjs');
  const report = await probeDeepSeekCapabilities({ apiKey });
  console.log(JSON.stringify(report, null, 2));
  if (
    report.textStreaming.outcome !== 'completed' ||
    report.structuredToolCall.outcome !== 'completed' ||
    !report.structuredToolCall.toolCall
  ) {
    process.exitCode = 1;
  }
}
