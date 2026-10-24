import { mkdtemp, readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { ORIGAMIX_VERSION } from '@origamix/shared';
import { ApplicationDatabase } from '../../database/database';
import { ProjectRepository } from '../../projects/project-repository';
import { ProjectService } from '../../projects/project-service';
import { ProjectUpgradeService } from '../../projects/project-upgrade-service';
import {
  getWorkingSchemaState,
  saveWorkingRevision,
  updateWorkingSchema,
} from '../../schema/schema-service';

it('upgrades only saved pages through Apply and resumes an interrupted dependency switch with the same request', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'origamix-project-upgrade-'));
  const database = new ApplicationDatabase(join(directory, 'application.db'));
  try {
    const projects = new ProjectRepository(database);
    const service = new ProjectService(
      projects,
      fileURLToPath(new URL('../../../template', import.meta.url)),
    );
    service.registerGrant('grant', directory);
    const project = await service.createProject({
      name: 'Upgrade',
      code: 'upgrade',
      directoryGrantId: 'grant',
    });
    const page = await service.createPage(project.id, { name: 'Home', slug: 'home' });
    const ref = {
      projectPath: project.path,
      pageId: page.id,
      slug: page.slug,
      relativePath: page.relativePath,
    };
    const manifestPath = join(project.path, 'origamix.project.json');
    const manifestSource = await readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestSource);
    const targetPath = join(project.path, page.relativePath, 'schema.json');
    const initial = await getWorkingSchemaState(ref);
    const working = await updateWorkingSchema(ref, {
      baseWorkingVersion: initial.workingVersion,
      schema: {
        ...initial.schema,
        elements: {
          ...initial.schema.elements,
          element_root: { ...initial.schema.elements.element_root, props: { padding: 24 } },
        },
      },
    });
    const template = join(directory, 'prepared-template');
    await mkdir(join(template, 'vendor'), { recursive: true });
    await writeFile(
      join(template, 'origamix.project.json'),
      JSON.stringify({ ...manifest, version: ORIGAMIX_VERSION, materialSet: 'official-antd' }),
    );
    // Archive bytes are opaque to this persistence test; the template smoke installs real archives.
    await writeFile(join(template, 'vendor/runtime.tgz'), 'runtime artifact');
    await writeFile(join(template, 'vendor/materials.tgz'), 'materials artifact');
    const input = { expectedVersion: ORIGAMIX_VERSION, clientRequestId: 'upgrade_once' };
    const interrupted = new ProjectUpgradeService(projects, template, (stage) => {
      if (stage === 'package') throw new Error('interrupted');
    });
    await expect(interrupted.upgrade(project.id, input)).rejects.toThrow('保存');
    const saved = await saveWorkingRevision(ref, working.workingVersion);
    await expect(interrupted.upgrade(project.id, input)).rejects.toThrow('interrupted');
    expect(await readFile(manifestPath, 'utf8')).toBe(manifestSource);
    expect(JSON.parse(await readFile(targetPath, 'utf8'))).toEqual(saved.schema);
    expect(await readdir(join(project.path, '.origamix/revisions', page.id))).toHaveLength(2);
    await expect(
      updateWorkingSchema(ref, { baseWorkingVersion: saved.workingVersion, schema: saved.schema }),
    ).rejects.toThrow('升级尚未完成');
    const resumed = new ProjectUpgradeService(projects, template);
    await expect(resumed.cancel(project.id, input.clientRequestId)).rejects.toThrow('已修改');
    await expect(
      resumed.upgrade(project.id, { ...input, clientRequestId: 'different' }),
    ).rejects.toThrow('原升级请求');
    const packagePath = join(project.path, 'package.json');
    const packageSource = await readFile(packagePath, 'utf8');
    await writeFile(packagePath, `${packageSource} `);
    await expect(resumed.upgrade(project.id, input)).rejects.toThrow('外部修改');
    expect(await readFile(packagePath, 'utf8')).toBe(`${packageSource} `);
    await writeFile(packagePath, packageSource);
    expect(await resumed.upgrade(project.id, input)).toMatchObject({
      version: ORIGAMIX_VERSION,
      status: 'completed',
      installRequired: true,
    });
    expect(await resumed.upgrade(project.id, input)).toMatchObject({ status: 'completed' });
    expect(JSON.parse(await readFile(manifestPath, 'utf8'))).toMatchObject({
      version: ORIGAMIX_VERSION,
      materialSet: 'official-antd',
    });
    expect(JSON.parse(await readFile(packagePath, 'utf8')).dependencies['@origamix/runtime']).toBe(
      `file:vendor/origamix-runtime-${ORIGAMIX_VERSION}.tgz`,
    );
    expect(
      await readFile(
        join(project.path, 'vendor', `origamix-runtime-${ORIGAMIX_VERSION}.tgz`),
        'utf8',
      ),
    ).toBe('runtime artifact');
    expect((await getWorkingSchemaState(ref)).workingVersion).toBe(saved.workingVersion);

    // When targets/configuration are unchanged, cancellation releases the edit freeze.
    const paused = new ProjectUpgradeService(projects, template, (stage) => {
      if (stage === 'pages') throw new Error('pause before configuration');
    });
    await expect(
      paused.upgrade(project.id, { ...input, clientRequestId: 'cancel_safe' }),
    ).rejects.toThrow('pause');
    await expect(paused.cancel(project.id, 'cancel_safe')).resolves.toEqual({ cancelled: true });
    await expect(
      updateWorkingSchema(ref, { baseWorkingVersion: saved.workingVersion, schema: saved.schema }),
    ).resolves.toMatchObject({ workingVersion: saved.workingVersion });
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
