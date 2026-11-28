import { runPnpm } from './run-pnpm.ts';

const prepare = () => {
  runPnpm('--filter', '@origamix/shared', '--filter', '@origamix/runtime', 'build');
  runPnpm('--filter', '@origamix/materials', 'manifest:check');
  runPnpm('--filter', '@origamix/materials', 'build:prepared');
};

const lint = () => {
  runPnpm('release:version', '--check');
  runPnpm('exec', 'eslint', 'scripts');
  runPnpm('-r', 'lint');
};

const typecheck = () => {
  runPnpm('exec', 'tsc', '--noEmit', '-p', 'tsconfig.scripts.json');
  runPnpm('--filter', '@origamix/materials', 'typecheck:prepared');
  runPnpm('--filter', '!@origamix/materials', '-r', 'typecheck');
};

const test = () => {
  runPnpm('--filter', '@origamix/materials', 'test:prepared');
  runPnpm('--filter', '!@origamix/materials', '-r', 'test');
};

const check = (staged: boolean) => {
  prepare();
  if (!staged) lint();
  typecheck();
  test();
  if (!staged) runPnpm('build:prepared');
};

const [mode = 'all'] = process.argv.slice(2);
switch (mode) {
  case 'all':
  case 'staged':
    check(mode === 'staged');
    break;
  case 'lint':
    lint();
    break;
  case 'prepare':
    prepare();
    break;
  case 'typecheck':
  case 'test':
    runPnpm('build:libs');
    if (mode === 'typecheck') typecheck();
    else test();
    break;
  default:
    throw new Error(`Unknown check mode: ${mode}`);
}
