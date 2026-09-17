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
