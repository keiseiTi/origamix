import { readProjectShell } from '@origamix/runtime';
import manifest from '../origamix.project.json';
import { readLayoutVariant, readRoutingConfig } from './routing-config';

const routing = readRoutingConfig(manifest);
const shell = readProjectShell(manifest);

export const projectConfig = {
  routing,
  shell: {
    ...shell,
    logo: shell.logo.startsWith('/') ? routing.basePath + shell.logo.slice(1) : shell.logo,
  },
  name: manifest.name,
  pageDirectory: manifest.pageDirectory,
  layoutEnabled: manifest.layout.enabled,
  layoutVariant: readLayoutVariant(manifest),
};
