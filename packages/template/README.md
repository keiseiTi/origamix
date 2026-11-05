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
src/router.ts               清单驱动的浏览器路由
src/application.tsx         项目应用外壳、公共布局与导航
src/application-error.tsx   应用加载/渲染错误反馈
src/origamix-layout/schema.json 显式应用后的项目布局投影
src/index.css               全局样式
src/pages/<slug>/index.tsx   页面渲染入口
src/pages/<slug>/schema.json Origamix 初始化或 Apply 写入的页面数据
.origamix/                  本机编辑状态与恢复证据
```

路由从清单 `pages` 注册：`home` 映射到 `/`，其他 slug 映射到 `/<slug>`；目录名由 `pageDirectory` 决定。不要只移动页面目录而不更新清单，否则入口解析会失败。

页面入口、样式和业务代码可在项目内继续开发。普通编辑、保存版本和历史恢复不重写这些源码；Apply 只更新目标 `schema.json`。直接修改该文件会被 Origamix 识别为外部变化，下一次 Apply 前需要处理冲突。增加或删除页面属于项目管理操作，不能由“Apply 只更新 Schema”推断这些操作不创建或删除页面源码。

## 项目布局

每个项目只有一份固定名称的“布局配置”。`origamix.project.json` 的 `layout.enabled` 是唯一开关，作用于所有页面，不支持页面覆盖。默认关闭；开启后应用外壳读取固定的 `src/origamix-layout/schema.json`，没有该文件或项目归属不符时显示提示，要求先保存并应用布局。

布局投影由 Origamix 的显式 layout Apply 写入；编辑、保存版本和历史恢复只更新 `.origamix/layout/`。布局节点与页面节点不拼接，页面继续由自己的稳定入口渲染，在唯一 `PageOutlet` 中显示。普通 Apply 不重写应用外壳、页面入口、项目路由或依赖。

可在布局中使用系统节点 `PageNavigation`（`direction: horizontal | vertical`）。它从项目 `pages` 读取名称与稳定 pageId，外壳解析路由，跳转时更新选中项。`home` 对应 `/`，其余页面对应 `/<slug>`；没有 home 时 `/` 跳转到第一个页面。未知路由显示返回首页入口。导航不携带工作台凭证或后端能力，Ctrl/Command 点击仍使用普通浏览器链接。

应用默认亮色。宿主或项目代码切换根元素的 `dark` class 后，外壳与 Ant Design RuntimeProvider 同步切换主题；Runtime 系统导航类已纳入 Tailwind 扫描。此阶段仅面向新建项目，不包含旧项目外壳迁移或草稿应用预览。

## 本地运行与部署排查

- 工作台预览已变化，独立项目仍显示旧内容：确认已“保存版本”并“应用到项目”，然后检查目标页面的 Schema。
- 页面入口不存在：核对清单 `pageDirectory`、slug 与对应 `index.tsx`，不要以重建整个项目覆盖本地源码。
- 独立安装报告 `workspace:*`：确认使用的是 Origamix 生成的项目；仓库内原始模板依赖尚未经过打包替换。
- npm 提示找不到指定版本：确认该版本已发布到所用 registry，并检查 registry 和网络配置；不要改成工作区路径。
- 部署后刷新子路由返回 404：为静态服务器配置 SPA 回退到 `index.html`。例如 Nginx 根路径部署可使用 `try_files $uri $uri/ /index.html;`。

当前路由使用浏览器历史模式，子路径部署需要同时考虑 Vite 资源基路径和路由 basename，不能只修改资源地址。`.origamix/` 不参与部署，但包含尚未应用的草稿和历史，清理前确认是否仍需在 Origamix 中继续编辑。

项目菜单“兼容性检查”检查物料及页面版本，不自动升级。没有具体转换器时仅说明原因；已知旧版 1.0.0 清单可显式转换配置格式，不修改页面或依赖。旧版未完成升级须使用原应用恢复，不能删除升级记录绕过保护。

模板交付使用已发布的固定 npm 依赖版本，不再携带 vendor 归档。源码更新不自动更新已有用户项目；升级完成后由用户重新安装依赖。发布前本地归档验证不等同于 npm registry 已可安装。
