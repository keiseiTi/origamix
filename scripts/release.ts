import { runPnpm } from './run-pnpm.ts';

const [mode, ...args] = process.argv.slice(2);
if (mode !== 'pack' && mode !== 'check' && mode !== 'publish')
  throw new Error(`Unknown release mode: ${mode}`);
if (mode !== 'pack') runPnpm('release:version', '--check');
runPnpm('build:libs');
runPnpm(
  '--filter',
  '@origamix/shared',
  '--filter',
  '@origamix/runtime',
  '--filter',
  '@origamix/materials',
  'run',
  'pack:npm',
  ...(mode === 'pack' ? args : []),
);
if (mode === 'check')
  runPnpm('exec', 'node', '--import', 'tsx', 'scripts/check-public-packages.ts', ...args);
if (mode === 'publish')
  runPnpm('exec', 'node', '--import', 'tsx', 'scripts/publish-public.ts', ...args);
