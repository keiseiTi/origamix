import { publicPackage, publicPackageNames } from './public-packages.ts';
import { spawnSync } from 'node:child_process';
for (const name of publicPackageNames) {
  const { version } = await publicPackage(name);
  const result = spawnSync('npm', ['view', `@origamix/${name}@${version}`, 'version', '--json'], {
    encoding: 'utf8',
    timeout: 30000,
  });
  if (result.error)
    throw new Error(
      `Registry lookup unavailable for @origamix/${name}@${version}: ${(result.error as NodeJS.ErrnoException).code ?? 'unknown'}`,
    );
  let response;
  try {
    response = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Invalid registry response for @origamix/${name}@${version}`);
  }
  if (result.status !== 0 || response !== version)
    throw new Error(
      `Registry did not confirm @origamix/${name}@${version} (${response?.error?.code ?? 'version unavailable'}); publish/verify the release before delivery`,
    );
  console.info(`Registry version available: @origamix/${name}@${version}`);
}
