import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareWebTemplate } from '../template-download.ts';

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'origamix-web-template-'));
const output = fileURLToPath(new URL('../../../dist/web-template', import.meta.url));
try {
  const { body, sha256, version } = await prepareWebTemplate(join(temporaryDirectory, 'template'));
  const file = `origamix-template-${version}.zip`;
  await mkdir(output, { recursive: true });
  await writeFile(join(output, file), body);
  await writeFile(
    join(output, 'manifest.json'),
    `${JSON.stringify({ version, file, sha256, size: body.length }, null, 2)}\n`,
  );
  console.info(`Web template: ${join(output, file)}`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
