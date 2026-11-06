import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Check } from '@sinclair/typebox/value';
import { ProjectTaskStateSchema, type ProjectTaskState } from '@origamix/shared';
import { metadataPath } from '../schema/metadata-path';
import { writeFileAtomically } from '../infrastructure/atomic-file';
import { conflict } from '../errors';

export class ProjectTaskStore {
  async read(path: string, runId: string): Promise<ProjectTaskState | undefined> {
    const file = await metadataPath(path, 'project-tasks', `${runId}.json`);
    try {
      const value: unknown = JSON.parse(await readFile(file, 'utf8'));
      if (!Check(ProjectTaskStateSchema, value) || value.runId !== runId)
        throw conflict('项目任务记录无效');
      return value;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
      throw error;
    }
  }
  async write(path: string, state: ProjectTaskState): Promise<void> {
    if (!Check(ProjectTaskStateSchema, state)) throw conflict('项目任务状态无效');
    const file = await metadataPath(path, 'project-tasks', `${state.runId}.json`);
    await mkdir(dirname(file), { recursive: true });
    await writeFileAtomically(file, JSON.stringify(state));
  }
}
