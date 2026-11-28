import { spawn } from 'node:child_process';
import electronPath from 'electron';
import { desktopRoot, workspaceRoot } from './build-options.ts';
import { createDesktopControl } from './desktop-control.ts';
import * as config from '../src/main/config.ts';

export const launchDesktop = (env: NodeJS.ProcessEnv, rendererUrl: string) => {
  const debug = config.desktopDebug(env)
    ? [
        `--inspect=${config.desktopPort(env, 'ORIGAMIX_INSPECT_PORT')}`,
        `--remote-debugging-port=${config.desktopPort(env, 'ORIGAMIX_DEBUG_PORT')}`,
      ]
    : [];
  const launchEnv: NodeJS.ProcessEnv = {
    ...env,
    ELECTRON_RENDERER_URL: rendererUrl,
    ORIGAMIX_DEVELOPMENT_CONTROL: '1',
  };
  delete launchEnv.ELECTRON_RUN_AS_NODE;
  const child = spawn(electronPath as unknown as string, [...debug, desktopRoot], {
    cwd: workspaceRoot,
    stdio: ['pipe', 'pipe', 'inherit'],
    env: launchEnv,
  });
  child.stdout?.on('data', (data) => process.stdout.write(data));
  return { child, control: createDesktopControl(child) };
};
