# Origamix React 项目模板

生成项目通过以下命令安装、开发和构建：

```sh
pnpm install
pnpm dev
pnpm build
pnpm preview
```

生产部署发布 `dist/`。项目使用浏览器历史路由，静态服务器需要将未知子路由回退到 `index.html`。

`.origamix/` 保存本机编辑工作副本、修订和操作回执，不参与项目运行或部署，默认不提交到版本库。运行页面从 `origamix.project.json` 的 `pageDirectory`（默认 `pages`）读取 `src/<pageDirectory>/*/schema.json`。

## 职责与入口

`src/main.tsx` 启动 React，`src/router.ts` 根据 `origamix.project.json` 注册页面，`src/application.tsx` 负责项目公共布局、主题和导航。页面入口使用 `@origamix/runtime` 和 `@origamix/materials/antd/runtime` 渲染自身的 `schema.json`。项目不依赖 Origamix App、Server 或 Electron；普通保存不会重新生成页面源码，Apply 只更新目标 Schema。

项目清单记录 `framework: react` 与 `materialSet: { id: "official-antd", version: "1.0.0" }`，不记录项目 version 或 uiLibrary。页面 Schema 与物料契约采用独立 SemVer；包版本跟随应用发布。打开页面仅检查兼容性，不转换数据或更新依赖。

模板必须保留自己的依赖、TypeScript、Vite 和 ESLint 配置，才能脱离工作区运行。源码工作区中的 `workspace:*` 由模板准备步骤替换为固定 npm 版本，打包后的项目不需要 monorepo。

## 验证

```sh
pnpm lint
pnpm typecheck
pnpm build
```

此骨架没有单独的测试脚本。在 Origamix 仓库维护模板时，由 Server 的 `test:template` 在临时目录创建项目、应用 Schema、安装依赖并构建；该检查需要 registry 访问或已填充的缓存。模板复制和分发由 Server 负责。

## 生成项目结构

默认页面目录为 `pages`，初始化时可配置为其他位于 `src/` 下的相对目录。

```text
origamix.project.json        项目清单、pageDirectory 和页面注册
src/main.tsx                React 入口
src/router.ts               清单驱动的 Browser／Hash 路由
src/routing-config.ts       运行与构建共用的路由配置读取
src/project-pages.ts        路由与菜单共用的页面路径
src/application.tsx         项目应用外壳、公共布局与导航
src/application-error.tsx   应用加载/渲染错误反馈
src/index.css               全局样式
src/pages/<slug>/index.tsx   页面渲染入口
src/pages/<slug>/schema.json Origamix 初始化或 Apply 写入的页面数据
.origamix/                  本机编辑状态与恢复证据
```

路由从清单 `pages` 注册：`home` 映射到 `/`，其他 slug 映射到 `/<slug>`；目录名由 `pageDirectory` 决定。不要只移动页面目录而不更新清单，否则入口解析会失败。

页面入口、样式和业务代码可在项目内继续开发。普通编辑、保存版本和历史恢复不重写这些源码；Apply 只更新目标 `schema.json`。直接修改该文件会被 Origamix 识别为外部变化，下一次 Apply 前需要处理冲突。增加或删除页面属于项目管理操作，不能由“Apply 只更新 Schema”推断这些操作不创建或删除页面源码。

## 项目布局与路由

新项目在 `origamix.project.json` 的 `shell` 中声明标题、Logo、菜单、首页、404 和独立页面。`layout.enabled` 开关布局，`layout.initialVariant` 选择 side/top/mix。模板通过 [application-shell.tsx](src/application-shell.tsx) 使用 Ant Design 的 Layout 和 Menu 渲染外壳。生成后可在项目内直接定制。已有项目如果升级到移除 `ConfiguredShell` 导出的 Runtime，需要将应用入口改为使用项目自己的外壳。

菜单按数组顺序展示，以 id/parentId 表达层级；pageId 可省略，表示分组。标题留空跟随页面名称，hidden 隐藏整棵子树。缺少 navigation 表示尚未配置，运行项目不展示示例菜单；空数组表示主动清空。

首页 pageId 映射到 `/`；未配置时使用 home slug 或第一个页面。未知路由保留原地址并渲染 notFoundPageId 对应页面，未指定时显示默认 404。standalonePageIds 中的页面不使用公共布局，包括被指定为 404 的页面。关闭布局不关闭路由规则。

Logo 支持 HTTP(S) 地址或项目根路径（如 `/logo.png`）；项目根路径的图片放到 public 目录，并自行确认部署路径可访问。设置界面不会读取项目任意资源。

## 本地运行与部署排查

- 工作台预览已变化，独立项目仍显示旧内容：确认已“保存版本”并“应用到项目”，然后检查目标页面的 Schema。
- 页面入口不存在：核对清单 `pageDirectory`、slug 与对应 `index.tsx`，不要以重建整个项目覆盖本地源码。
- 独立安装报告 `workspace:*`：确认使用的是 Origamix 生成的项目；仓库内原始模板依赖尚未经过打包替换。
- npm 提示找不到指定版本：确认该版本已发布到所用 registry，并检查 registry 和网络配置；不要改成工作区路径。
- 部署后刷新子路由返回 404：为静态服务器配置 SPA 回退到 `index.html`。例如 Nginx 根路径部署可使用 `try_files $uri $uri/ /index.html;`。

项目清单必须配置 `routing: { "mode": "browser", "basePath": "/" }`。`mode` 支持 `browser`、`hash`，`basePath` 是以 `/` 开头并结尾的应用访问前缀，例如 `/admin/`；缺少路由或布局配置时直接拒绝，不提供旧格式兜底。Vite 资源基路径与运行路由读取同一份配置。Browser 下角色页形如 `/admin/role-manage`，服务器须回退到 `/admin/index.html`；Hash 下形如 `/admin/#/role-manage`，只需托管 `/admin/` 应用目录。修改配置后重启开发服务器或重新构建部署。路由模式与前缀不依赖是否开启布局。

`.origamix/` 不参与部署，但包含尚未应用的草稿和历史，清理前确认是否仍需在 Origamix 中继续编辑。

模板交付使用已发布的固定 npm 依赖版本，不再携带 vendor 归档。发布前本地归档验证不等同于 npm registry 已可安装。

### 验证项目

平台只提供页面草稿预览和项目设置中的布局效果，不提供完整项目预览。页面保存版本并应用后，在本项目中运行 `pnpm dev` 验证真实路由、菜单、404 与业务行为。项目设置保存后直接更新清单，开发服务需刷新，生产部署需重新构建。

### 页面事件与导航

页面自身的变量、接口请求和事件逻辑继续由页面 Schema 管理。navigatePage 只接受当前项目的明确 pageId，模板处理 Browser/Hash 和部署前缀。页面预览不执行项目路由，页面间跳转需在生成项目中运行。

项目清单不声明共享应用状态或登录访问规则，模板不提供登录态检查、登录后返回或自动退出。页面的登录角色只是标记，不附加运行行为。
