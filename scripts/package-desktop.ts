import { runPnpm } from './run-pnpm.ts';

const [target = 'mac', ...args] = process.argv.slice(2);
if (target !== 'mac' && target !== 'dir') throw new Error(`Unknown Desktop target: ${target}`);
runPnpm('release:registry');
runPnpm(target === 'mac' ? 'check' : 'build');
runPnpm('--filter', '@origamix/desktop', `package:${target}`, ...args);
