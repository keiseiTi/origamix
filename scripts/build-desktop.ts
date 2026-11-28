import { runPnpm } from './run-pnpm.ts';

if (!process.argv.includes('--prepared')) runPnpm('build:libs');
runPnpm('--filter', '@origamix/server', 'build');
runPnpm('--filter', '@origamix/app', 'build:desktop');
runPnpm('--filter', '@origamix/desktop', 'build');
