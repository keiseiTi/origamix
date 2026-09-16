import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { build } from 'tsup';
import { expect, it } from 'vitest';
import { options } from '../scripts/build-options.mjs';

it('loads isolated bundles and keeps host and evaluation exports separate', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'origamix-server-bundle-'));
  try {
    await build({
      ...options,
      entry: {
        server: options.entry.server,
        runtime: options.entry.runtime,
        tooling: options.entry.tooling,
      },
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
      const assert = require('node:assert/strict');
      assert.deepEqual(Object.keys(require('./runtime.cjs')), ['startServer']);
      assert.equal(typeof require('./tooling.cjs').probeDeepSeekCapabilities, 'function');
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
