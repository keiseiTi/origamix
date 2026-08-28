import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ApplicationDatabase } from './database'
import { assertMigrationSafety } from './migrations'
import { WorkspaceRepository } from '../repositories/workspace-repository'

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })))
})

describe('ApplicationDatabase', () => {
  it('applies the local persistence migration and initializes workspace state', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-db-'))
    directories.push(directory)
    const database = new ApplicationDatabase(join(directory, 'origamix.db'))
    const tables = database.connection
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>

    expect(tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        'projects',
        'pages',
        'workspace_state',
        'conversations',
        'messages',
        'agent_runs'
      ])
    )
    const workspace = new WorkspaceRepository(database)
    expect(workspace.get()).toMatchObject({ theme: 'light', sidebarCollapsed: false })
    expect(workspace.save({ theme: 'dark', sidebarCollapsed: true })).toMatchObject({
      theme: 'dark',
      sidebarCollapsed: true
    })
    database.close()
  })

  it('rejects migrations that introduce foreign keys', () => {
    expect(() =>
      assertMigrationSafety('CREATE TABLE child (parent_id TEXT REFERENCES parents(id))')
    ).toThrow('外键')
  })
})
