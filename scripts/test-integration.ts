import { runPnpm } from './run-pnpm.ts';

const server = '@origamix/server';
const app = '@origamix/app';
const desktop = '@origamix/desktop';

const workflows: Readonly<Record<string, string[][]>> = {
  web: [['build:web'], ['--filter', app, 'test:web']],
  'web:mysql': [['build:web'], ['--filter', app, 'test:web:mysql']],
  desktop: [['build'], ['--filter', desktop, 'test:main']],
  dev: [
    ['--filter', desktop, 'test:dev'],
    ['--filter', server, 'test:dev'],
  ],
  template: [['build:libs'], ['--filter', server, 'build'], ['--filter', server, 'test:template']],
  'agent:mysql': [['build:libs'], ['--filter', server, 'test:agent:mysql']],
  'gate:internal': [
    ['build:libs'],
    ['--filter', server, 'build'],
    ['--filter', server, 'gate:agent'],
  ],
};

const [mode, ...args] = process.argv.slice(2);
if (!Object.hasOwn(workflows, mode)) throw new Error(`Unknown integration workflow: ${mode}`);
const steps = workflows[mode];
steps.forEach((step, index) => runPnpm(...step, ...(index === steps.length - 1 ? args : [])));
