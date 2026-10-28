import { publicPackage, publicPackageNames, workspaceRoot } from './public-packages.ts';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const checked = spawnSync(
  process.execPath,
  [...process.execArgv, join(workspaceRoot, 'scripts/check-public-packages.ts')],
  {
    stdio: 'inherit',
  },
);
if (checked.status !== 0) throw new Error('Release artifact verification failed');
const order = publicPackageNames;
const fromIndex = process.argv.indexOf('--from');
const first = fromIndex < 0 ? 'shared' : process.argv[fromIndex + 1];
if (!order.includes(first))
  throw new Error('Use --from shared|runtime|materials after verifying earlier publications');
for (const name of order.slice(order.indexOf(first))) {
  const { archive } = await publicPackage(name);
  const result = spawnSync('npm', ['publish', archive, '--access', 'public'], { stdio: 'inherit' });
  if (result.status !== 0)
    throw new Error(
      `Publication stopped at ${name}; do not republish completed immutable versions`,
    );
}
