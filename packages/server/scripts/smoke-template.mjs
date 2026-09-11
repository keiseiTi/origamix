import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepareTemplateArtifact } from './prepare-template-artifact.mjs';

const directory = await mkdtemp(join(tmpdir(), 'origamix-template-smoke-'));
const project = join(directory, 'project');
try {
  await prepareTemplateArtifact({
    sourceTemplate: fileURLToPath(new URL('../../template', import.meta.url)),
    targetTemplate: project,
    runtimePackage: fileURLToPath(new URL('../../runtime', import.meta.url)),
    materialsPackage: fileURLToPath(new URL('../../materials', import.meta.url)),
  });
  for (const args of [['install', '--ignore-scripts'], ['typecheck'], ['build']]) {
    const child = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, {
      cwd: project,
      stdio: 'inherit',
      timeout: 120000,
    });
    if (child.error || child.status !== 0) throw child.error ?? new Error(`pnpm ${args[0]} failed`);
  }
  console.info('Template smoke passed: independent installation, strict typecheck and build.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
