import { build } from 'tsup';
import { options } from './build-options.mjs';
import { assembleResources } from './assemble-resources.mjs';
import { copyServerArtifact } from './copy-server-artifact.mjs';

await build({ ...options, clean: true });
await copyServerArtifact();
await assembleResources();
