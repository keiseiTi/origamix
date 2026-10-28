import { build } from 'tsup';
import { options } from './build-options.ts';
import { assembleResources } from './assemble-resources.ts';
import { copyServerArtifact } from './copy-server-artifact.ts';

await build({ ...options, clean: true });
await copyServerArtifact();
await assembleResources();
