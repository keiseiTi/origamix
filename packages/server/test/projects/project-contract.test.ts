import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { ApplicationDatabase } from '../../src/database/database';
import { ProjectRepository } from '../../src/projects/project-repository';
import { ProjectService } from '../../src/projects/project-service';
import { getWorkingSchemaState, updateWorkingSchema } from '../../src/schema/schema-service';
import { hashSchema } from '../../src/schema/schema-hash';

// Unsupported contracts and interrupted writes must preserve existing drafts and targets.
it('rejects unsupported project data and interrupted writes without replacing retained drafts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'origamix-project-compatibility-'));
  const database = new ApplicationDatabase(join(directory, 'application.db'));
  try {
    const projects = new ProjectRepository(database);
    const service = new ProjectService(
      projects,
      fileURLToPath(new URL('../../../template', import.meta.url)),
    );
    service.registerGrant('grant', directory);
    const project = await service.createProject({
      name: 'Compatibility',
      code: 'compatibility',
      directoryGrantId: 'grant',
    });
    const page = await service.createPage(project.id, { name: 'Home', slug: 'home' });
    const ref = {
      projectPath: project.path,
      pageId: page.id,
      slug: page.slug,
      relativePath: page.relativePath,
    };
    const initial = await getWorkingSchemaState(ref);
    const draft = await updateWorkingSchema(ref, {
      baseWorkingVersion: initial.workingVersion,
      schema: {
        ...initial.schema,
        elements: {
          ...initial.schema.elements,
          element_root: { ...initial.schema.elements.element_root, props: { padding: 24 } },
        },
      },
    });
    const manifestPath = join(project.path, 'origamix.project.json');
    const current = JSON.parse(await readFile(manifestPath, 'utf8'));
    const legacy = JSON.stringify({
      ...current,
      version: '1.0.0',
      uiLibrary: 'antd',
      materialSet: 'official-antd',
    });
    await writeFile(manifestPath, legacy);
    const targetPath = join(project.path, page.relativePath, 'schema.json');
    const workingPath = join(project.path, '.origamix/pages', page.id, 'working.json');
    const workingBytes = await readFile(workingPath, 'utf8');
    const targetBytes = await readFile(targetPath, 'utf8');
    const packageBytes = await readFile(join(project.path, 'package.json'), 'utf8');
    await expect(getWorkingSchemaState(ref)).rejects.toThrow('字段无效');
    expect(await readFile(manifestPath, 'utf8')).toBe(legacy);
    await writeFile(manifestPath, JSON.stringify(current));
    expect(await readFile(workingPath, 'utf8')).toBe(workingBytes);
    expect(await readFile(targetPath, 'utf8')).toBe(targetBytes);
    expect(await readFile(join(project.path, 'package.json'), 'utf8')).toBe(packageBytes);
    expect((await getWorkingSchemaState(ref)).workingVersion).toBe(draft.workingVersion);
    expect(await readdir(join(project.path, '.origamix/revisions', page.id))).toHaveLength(1);

    await writeFile(
      manifestPath,
      JSON.stringify({ ...current, materialSet: { ...current.materialSet, version: '2.0.0' } }),
    );
    await expect(
      updateWorkingSchema(ref, { baseWorkingVersion: draft.workingVersion, schema: draft.schema }),
    ).rejects.toThrow('不受当前应用支持');
    await writeFile(manifestPath, JSON.stringify(current));
    const incompatible = JSON.stringify({
      ...JSON.parse(workingBytes),
      schema: { ...draft.schema, extensions: { origamix: { schemaVersion: '2.0.0' } } },
    });
    const incompatibleWorking = JSON.parse(incompatible);
    incompatibleWorking.workingHash = hashSchema(incompatibleWorking.schema);
    const incompatibleBytes = JSON.stringify(incompatibleWorking);
    await writeFile(workingPath, incompatibleBytes);
    await expect(getWorkingSchemaState(ref)).rejects.toThrow('不受当前应用支持');
    expect(await readFile(workingPath, 'utf8')).toBe(incompatibleBytes);
    await writeFile(workingPath, workingBytes);

    await rm(manifestPath);
    service.registerGrant('reopen', project.path);
    await expect(
      service.openProject({ directoryGrantId: 'reopen', initializeIfNeeded: true }),
    ).rejects.toThrow('配置文件缺失');
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
