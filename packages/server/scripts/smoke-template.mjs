import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { copyTemplate } from '../dist/template.cjs';

const directory = await mkdtemp(join(tmpdir(), 'origamix-template-smoke-'));
const project = join(directory, 'project');
try {
  await copyTemplate(fileURLToPath(new URL('../../template', import.meta.url)), project);
  for (const args of [['install', '--ignore-scripts'], ['typecheck'], ['build']]) {
    const child = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, {
      cwd: project, stdio: 'inherit', timeout: 120000
    });
    if (child.error || child.status !== 0) throw child.error ?? new Error(`pnpm ${args[0]} failed`);
  }
  console.info('Template smoke passed: independent installation, strict typecheck and build.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
