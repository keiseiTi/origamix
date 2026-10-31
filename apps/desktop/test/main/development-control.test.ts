import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import { createDesktopControl } from '../../scripts/desktop-control';

it('keeps the private supervisor channel usable after a failed command and closes its owned child', async () => {
  const entry = new URL('../../src/main/development-control.ts', import.meta.url).href;
  const source = `import { registerDevelopmentControl } from ${JSON.stringify(entry)};
    let paused = false;
    registerDevelopmentControl({
      pauseBackend: async () => { paused = true; },
      resumeBackend: async () => { if (!paused) throw new Error('not paused'); paused = false; },
      reloadWorkbench: async () => { if (paused) throw new Error('still paused'); },
      disconnect: () => process.exit(0)
    });`;
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '--eval', source],
    {
      cwd: new URL('../../', import.meta.url),
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  const control = createDesktopControl(child);
  try {
    await control.ready;
    await expect(control.request('resume-backend')).rejects.toThrow('not paused');
    await control.request('pause-backend');
    await expect(control.request('reload-workbench')).rejects.toThrow('still paused');
    await control.request('resume-backend');
    await control.request('reload-workbench');
    const exited = once(child, 'exit');
    child.stdin.end();
    expect((await exited)[0]).toBe(0);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
});
