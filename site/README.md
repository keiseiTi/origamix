# Origamix 官网与文档

基于 Rspress，介绍项目、源码启动、使用流程与七个包的职责。目前不提供安装包、视频或图片。

从仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm site
pnpm site:build
pnpm --filter @origamix/site preview
```

## 内容与主题

- `docs/index.md`：首页概览，正文由主题的 `Content` 插槽渲染。
- `docs/_nav.json`：顶部导航及子菜单。
- `docs/intro/`：定位、工作方式与当前限制。
- `docs/start/`：环境、源码启动、首次使用与生成项目运行。
- `docs/guide/`：编辑、预览、版本、应用与排错。
- `docs/architecture/`：整体架构、七个包与开发验证。
- 各组 `_meta.json`：侧边导航顺序和中文标签。
- `theme/index.tsx`、`theme/index.css`：首页正文插槽和深浅色主题。
- `rspress.config.ts`：站点语言、品牌与仓库链接。

更新产品能力和命令前对照仓库及包 README，保持草稿、保存版本和应用三个动作的区别。不要将开发代理描述成生产远程部署。

修改后检查链接、导航、搜索、代码块以及浅色、深色与手机布局；构建能验证文档解析和静态产物，不替代交互检查。
