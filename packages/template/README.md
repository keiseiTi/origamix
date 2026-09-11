# Origamix React 项目模板

生成项目通过以下命令安装、开发和构建：

```sh
pnpm install
pnpm dev
pnpm build
pnpm preview
```

生产部署发布 `dist/`。项目使用浏览器历史路由，静态服务器需要将未知子路由回退到 `index.html`。

`.origamix/` 保存本机编辑工作副本、修订和操作回执，不参与项目运行或部署，默认不提交到版本库。运行页面读取 `src/pages/*/schema.json`。
