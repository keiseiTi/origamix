import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { nanoid } from 'nanoid';
import { writeFileAtomically } from '../infrastructure/atomic-file';
import { ProjectSourceService } from './project-source';

export class ProjectScaffoldService {
  private readonly source: ProjectSourceService;

  constructor(templatePath: string) {
    this.source = new ProjectSourceService(templatePath);
  }

  async initializeDirectoryAsNewProject(
    path: string,
    input: { name: string; code: string; pageDirectory: string },
  ): Promise<void> {
    const staging = await mkdtemp(join(dirname(path), '.origamix-scaffold-'));
    const prepared = join(staging, 'project');
    try {
      await this.source.prepareNewProject(prepared, input);
      await writeFileAtomically(
        join(prepared, 'origamix.project.json'),
        `${JSON.stringify(
          {
            projectId: `project_${nanoid()}`,
            name: input.name,
            code: input.code,
            framework: 'react',
            uiLibrary: 'antd',
            pageDirectory: input.pageDirectory,
            pages: [],
          },
          null,
          2,
        )}\n`,
      );
      for (const entry of await readdir(prepared))
        await cp(join(prepared, entry), join(path, entry), {
          recursive: true,
          errorOnExist: true,
          force: false,
        });
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  }
}
