import { access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ProjectManifestStore } from './project-manifest-store';
import { withExclusiveProjectActivity } from './project-activity';
import { conflict } from '../errors';
import { nanoid } from 'nanoid';

/** Existing projects only opt into page management; never copy an application scaffold. */
export class ProjectScaffoldService {
  initializeExistingProject = (
    path: string,
    input: { name: string; code: string; pageDirectory: string },
  ): Promise<void> =>
    withExclusiveProjectActivity(path, async () => {
      await mkdir(path, { recursive: true });
      try {
        await access(join(path, 'origamix.project.json'));
        throw conflict('项目已经初始化，请重新打开');
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      }
      await new ProjectManifestStore().initializeManifest(path, {
        ...input,
        projectId: `project_${nanoid()}`,
        runtime: 'external',
      });
    });
}
