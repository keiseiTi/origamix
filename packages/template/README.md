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

`src/main.tsx` 启动 React，`src/router.ts` 根据 `origamix.project.json` 注册页面。页面入口使用 `@origamix/runtime/react` 和物料注册表渲染自身的 `schema.json`。项目不依赖 Origamix App、Server 或 Electron；普通保存不会重新生成页面源码，Apply 只更新目标 Schema。

模板必须保留自己的依赖、TypeScript、Vite 和 ESLint 配置，才能脱离工作区运行。源码工作区中的 `workspace:*` 由模板打包步骤替换为随项目提供的 `vendor/*.tgz`，打包后的项目不需要 monorepo。

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
src/index.css               全局样式
src/pages/<slug>/index.tsx   页面渲染入口
src/pages/<slug>/schema.json Origamix 初始化或 Apply 写入的页面数据
vendor/runtime.tgz          随项目提供的 Runtime 包
vendor/materials.tgz        随项目提供的 Materials 包
.origamix/                  本机编辑状态与恢复证据
```

路由从清单 `pages` 注册：`home` 映射到 `/`，其他 slug 映射到 `/<slug>`；目录名由 `pageDirectory` 决定。不要只移动页面目录而不更新清单，否则入口解析会失败。

页面入口、样式和业务代码可在项目内继续开发。普通编辑、保存版本和历史恢复不重写这些源码；Apply 只更新目标 `schema.json`。直接修改该文件会被 Origamix 识别为外部变化，下一次 Apply 前需要处理冲突。增加或删除页面属于项目管理操作，不能由“Apply 只更新 Schema”推断这些操作不创建或删除页面源码。

## 本地运行与部署排查

- 工作台预览已变化，独立项目仍显示旧内容：确认已“保存版本”并“应用到项目”，然后检查目标页面的 Schema。
- 页面入口不存在：核对清单 `pageDirectory`、slug 与对应 `index.tsx`，不要以重建整个项目覆盖本地源码。
- 独立安装报告 `workspace:*`：确认使用的是 Origamix 生成的项目；仓库内原始模板依赖尚未经过打包替换。
- 找不到 `vendor/*.tgz`：保留生成项目自带归档，它们是安装依赖，不是缓存；不要只复制 `src/`。
- 部署后刷新子路由返回 404：为静态服务器配置 SPA 回退到 `index.html`。例如 Nginx 根路径部署可使用 `try_files $uri $uri/ /index.html;`。

当前路由使用浏览器历史模式，子路径部署需要同时考虑 Vite 资源基路径和路由 basename，不能只修改资源地址。`.origamix/` 不参与部署，但包含尚未应用的草稿和历史，清理前确认是否仍需在 Origamix 中继续编辑。
