import { compileDesktop } from './compile.ts';
import { options } from './build-options.ts';
import { assembleResources } from './assemble-resources.ts';
import { copyServerArtifact } from './copy-server-artifact.ts';

await compileDesktop({ ...options, clean: true });
await copyServerArtifact();
await assembleResources();
