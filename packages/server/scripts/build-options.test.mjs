import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { build } from 'tsup';
import { expect, it } from 'vitest';
import { options } from './build-options.mjs';

it('loads the bundled server with Node builtins outside the workspace', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'origamix-server-bundle-'));
  try {
    await build({
      ...options,
      entry: { server: options.entry.server },
      outDir: directory,
      config: false,
      silent: true,
    });
    // Stub only the Electron control port. Real Node module resolution must
    // load every bundled dependency, including the prefix-only node:sqlite.
    const output = execFileSync(
      process.execPath,
      [
        '-e',
        `
      process.parentPort = { on() {}, postMessage() {} };
      require('./server.cjs');
      process.stdout.write('server loaded');
    `,
      ],
      { cwd: directory, encoding: 'utf8' },
    );
    expect(output).toBe('server loaded');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 20000);
