import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ApplicationDatabase } from '../../database/database'
import { ProjectRepository } from '../../repositories/project-repository'
import { WorkspaceRepository } from '../../repositories/workspace-repository'
import { ProjectService } from '../../services/project-service'
import { createHttpServer } from './server'

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })))
})

describe('local HTTP API', () => {
  it('requires the desktop session and serves workspace through the versioned API', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-http-'))
    directories.push(directory)
    const database = new ApplicationDatabase(join(directory, 'origamix.db'))
    const projects = new ProjectRepository(database)
    const workspace = new WorkspaceRepository(database)
    const server = createHttpServer({
      desktopToken: 'desktop-token',
      serviceInstanceId: 'service-instance',
      projects,
      workspace,
      projectService: new ProjectService(projects, workspace)
    })

    const denied = await server.inject({ method: 'GET', url: '/api/v1/workspace' })
    expect(denied.statusCode).toBe(401)

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/workspace',
      headers: { authorization: 'Bearer desktop-token', 'x-origamix-service': 'service-instance' }
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ ok: true, data: { theme: 'light' } })
    await server.close()
    database.close()
  })
})
