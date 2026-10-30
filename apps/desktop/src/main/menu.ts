import { app, Menu, type MenuItemConstructorOptions } from 'electron';

export const installApplicationMenu = (): void => {
  const isMac = process.platform === 'darwin';
  app.setAboutPanelOptions({
    applicationName: 'OrigaMix',
    applicationVersion: app.getVersion(),
  });

  const about: MenuItemConstructorOptions = {
    label: '关于 OrigaMix',
    click: () => app.showAboutPanel(),
  };
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: 'OrigaMix',
            submenu: [
              about,
              { type: 'separator' },
              { label: '服务', role: 'services' },
              { type: 'separator' },
              { label: '隐藏 OrigaMix', role: 'hide' },
              { label: '隐藏其他应用', role: 'hideOthers' },
              { label: '显示全部', role: 'unhide' },
              { type: 'separator' },
              { label: '退出 OrigaMix', role: 'quit' },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: '文件',
      submenu: [
        { label: '关闭窗口', role: 'close' },
        ...(!isMac ? [{ label: '退出 OrigaMix', role: 'quit' } as const] : []),
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { label: '强制重新加载', role: 'forceReload' },
        { label: '开发者工具', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '实际大小', role: 'resetZoom' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { type: 'separator' },
        { label: '切换全屏', role: 'togglefullscreen' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize' },
        { label: '缩放窗口', role: 'zoom' },
        ...(isMac
          ? ([
              { type: 'separator' },
              { label: '前置全部窗口', role: 'front' },
            ] satisfies MenuItemConstructorOptions[])
          : []),
      ],
    },
    { label: '帮助', role: 'help', submenu: [about] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};
