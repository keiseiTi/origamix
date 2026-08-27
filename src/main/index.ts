import { app, shell, BrowserWindow, ipcMain, screen, dialog } from 'electron'
import { join } from 'path'
import { mkdir, writeFile, access } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

function createWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: width,
    height: height,
    show: false,
    x: 0,
    y: 0,
    minWidth: 1280,
    minHeight: 768,
    resizable: true,
    title: 'origamix',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

interface CreateProjectInput {
  name: string
  parentDirectory: string
}

const createdProjectRoots = new Set<string>()

async function createProjectTemplate(input: CreateProjectInput): Promise<{ projectPath: string }> {
  const name = input.name.trim()
  if (!name || name.length > 80 || /[\\/:*?"<>|]/.test(name)) {
    throw new Error('项目名称无效')
  }
  if (!input.parentDirectory) throw new Error('请选择生成地址')

  const projectPath = join(input.parentDirectory, name)
  try {
    await access(projectPath)
    throw new Error('目标目录已经存在')
  } catch (error) {
    if (error instanceof Error && error.message === '目标目录已经存在') throw error
  }

  await mkdir(join(projectPath, 'src', 'pages'), { recursive: true })
  await mkdir(join(projectPath, '.origamix', 'revisions'), { recursive: true })
  await writeFile(
    join(projectPath, 'origamix.project.json'),
    JSON.stringify(
      {
        projectId: `project_${crypto.randomUUID()}`,
        name,
        projectFormatVersion: '1',
        schemaVersion: '1',
        templateVersion: '1',
        materialSets: [{ id: 'official', version: '1' }]
      },
      null,
      2
    )
  )
  await writeFile(join(projectPath, 'src', 'pages', 'registry.json'), '[]\n')
  await writeFile(
    join(projectPath, 'package.json'),
    `${JSON.stringify({ name: name.toLowerCase().replace(/\s+/g, '-'), private: true, version: '0.0.0', scripts: { dev: 'vite', build: 'vite build' } }, null, 2)}\n`
  )
  createdProjectRoots.add(projectPath)
  return { projectPath }
}

async function createPageTemplate(input: {
  projectPath: string
  name: string
  fileName: string
}): Promise<void> {
  const name = input.name.trim()
  const fileName = input.fileName.trim()
  if (!createdProjectRoots.has(input.projectPath)) throw new Error('项目目录未获授权')
  if (!name || name.length > 80) throw new Error('页面名称无效')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fileName))
    throw new Error('文件名称仅支持小写字母、数字和连字符')

  const pagePath = join(input.projectPath, 'src', 'pages', fileName)
  try {
    await access(pagePath)
    throw new Error('页面文件已经存在')
  } catch (error) {
    if (error instanceof Error && error.message === '页面文件已经存在') throw error
  }

  const pageId = `page_${crypto.randomUUID()}`
  await mkdir(pagePath, { recursive: false })
  await writeFile(
    join(pagePath, 'page.meta.json'),
    `${JSON.stringify({ pageId, name, slug: fileName }, null, 2)}\n`
  )
  await writeFile(
    join(pagePath, 'schema.json'),
    `${JSON.stringify({ elements: { element_root: { type: 'container', props: {} } }, layout: { root: 'element_root', structure: { element_root: [] } }, flows: {}, bindElements: [], context: { globalVariables: [] }, extensions: { origamix: { schemaVersion: '1.0' } } }, null, 2)}\n`
  )
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.origamix')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('project:choose-directory', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('project:create', (_event, input: CreateProjectInput) =>
    createProjectTemplate(input)
  )
  ipcMain.handle('page:create', (_event, input) => createPageTemplate(input))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
