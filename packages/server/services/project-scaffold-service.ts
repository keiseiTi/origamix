import { mkdir, rename, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { nanoid } from 'nanoid';

async function atomicWrite(path: string, contents: string): Promise<void> {
  const temporary = `${path}.${nanoid()}.tmp`;
  await writeFile(temporary, contents, { mode: 0o600 });
  await rename(temporary, path);
}

export class ProjectScaffoldService {
  async initializeExistingDirectory(path: string): Promise<void> {
    const directoryName = basename(path);
    await atomicWrite(
      join(path, 'origamix.project.json'),
      `${JSON.stringify(
        {
          projectId: `project_${nanoid()}`,
          name: directoryName,
          code: directoryName,
          projectFormatVersion: '1',
        },
        null,
        2,
      )}\n`,
    );
    await mkdir(join(path, 'src', 'pages'), { recursive: true });
    await atomicWrite(join(path, 'src', 'pages', 'registry.json'), '[]\n');
  }
}
