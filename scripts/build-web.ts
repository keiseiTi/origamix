import { runPnpm } from './run-pnpm.ts';

runPnpm('build:libs');
runPnpm('--filter', '@origamix/server', 'build');
runPnpm('--filter', '@origamix/app', 'build:web');
runPnpm('--filter', '@origamix/server', 'build:template');
