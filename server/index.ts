import { parentPort } from 'electron'
import { ApplicationDatabase } from './database/database'
import { ProjectRepository } from './repositories/project-repository'
import { WorkspaceRepository } from './repositories/workspace-repository'
import { ProjectService } from './services/project-service'
import { createHttpServer } from './transport/http/server'

let stop: (() => Promise<void>) | undefined
parentPort.on('message', async (message: unknown) => {
  if (!message || typeof message !== 'object') return
  const event = message as {
    kind?: string
    databasePath?: string
    desktopToken?: string
    serviceInstanceId?: string
    grantId?: string
    path?: string
  }
  if (event.kind === 'grant' && event.grantId && event.path) {
    ;(globalThis as { projectService?: ProjectService }).projectService?.registerGrant(
      event.grantId,
      event.path
    )
    return
  }
  if (event.kind === 'shutdown') {
    await stop?.()
    process.exit(0)
  }
  if (
    event.kind !== 'initialize' ||
    !event.databasePath ||
    !event.desktopToken ||
    !event.serviceInstanceId
  )
    return
  try {
    const database = new ApplicationDatabase(event.databasePath)
    const projects = new ProjectRepository(database)
    const workspace = new WorkspaceRepository(database)
    const projectService = new ProjectService(projects, workspace)
    ;(globalThis as { projectService?: ProjectService }).projectService = projectService
    const server = createHttpServer({
      desktopToken: event.desktopToken,
      serviceInstanceId: event.serviceInstanceId,
      projects,
      workspace,
      projectService
    })
    await server.listen({ host: '127.0.0.1', port: 0 })
    const address = server.server.address()
    if (!address || typeof address === 'string') throw new Error('无法取得 HTTP 服务端口')
    stop = async () => {
      await server.close()
      database.close()
    }
    process.parentPort.postMessage({
      kind: 'ready',
      port: address.port,
      serviceInstanceId: event.serviceInstanceId
    })
  } catch (error) {
    process.parentPort.postMessage({
      kind: 'error',
      message: error instanceof Error ? error.message : '后台启动失败'
    })
  }
})
