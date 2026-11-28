import { buildEntriesSequentially } from '../../../scripts/lib/build-entries.ts';
import { options } from './build-options.ts';
import { assembleResources } from './assemble-resources.ts';
import { copyServerArtifact } from './copy-server-artifact.ts';

await buildEntriesSequentially({ ...options, clean: true });
await copyServerArtifact();
await assembleResources();
