import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const createProjectStackFixture = async () => {
  const path = await mkdtemp(join(tmpdir(), 'origamix-stack-'));
  await writeFile(
    join(path, 'origamix.project.json'),
    JSON.stringify({
      shell: { title: '', logo: '', standalonePageIds: [] },
      runtime: 'origamix' as const,
      layout: { enabled: false, initialVariant: 'side' as const },
      routing: { mode: 'browser' as const, basePath: '/' },
      projectId: 'project_test',
      name: 'Test',
      framework: 'react',
      materialSet: { id: 'official-antd', version: '1.0.0' },
      pageDirectory: 'pages',
      pages: [],
    }),
  );
  return { path, close: () => rm(path, { recursive: true, force: true }) };
};
