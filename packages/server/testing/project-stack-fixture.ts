import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const createProjectStackFixture = async () => {
  const path = await mkdtemp(join(tmpdir(), 'origamix-stack-'));
  await writeFile(
    join(path, 'origamix.project.json'),
    JSON.stringify({
      projectId: 'project_test',
      name: 'Test',
      framework: 'react',
      uiLibrary: 'antd',
      pageDirectory: 'pages',
      pages: [],
    }),
  );
  return { path, close: () => rm(path, { recursive: true, force: true }) };
};
