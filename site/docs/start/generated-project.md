---
title: 运行生成项目
description: 先对要运行的页面执行「保存版本」和「应用到项目」。如有布局改动，在「布局配置」中点击「保存配置」。
---

# 运行生成项目

先对要运行的页面执行「保存版本」和「应用到项目」。如有布局改动，在「布局配置」中点击「保存配置」。在生成项目目录执行以下命令。

```sh
pnpm install
pnpm dev
```

这是生成项目的目录，不是 Origamix 源码仓库目录。打开终端输出的本地地址即可访问页面。

## 构建与部署

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm preview
```

部署产物为 `dist/`。默认使用 Browser 路由，静态服务器须将未知子路由回退到应用的 `index.html`。使用 Hash 路由时，托管应用目录即可。通过 `routing.basePath` 设置子路径，资源基路径和路由读取同一配置。

## 项目中的文件

| 路径                           | 用途                                 |
| ------------------------------ | ------------------------------------ |
| `origamix.project.json`        | 项目与页面清单                       |
| `src/pages/<slug>/index.tsx`   | 默认页面目录下的渲染入口             |
| `src/pages/<slug>/schema.json` | 已应用的页面数据                     |
| `src/application.tsx`          | 应用外壳、公共布局与导航             |
| `.origamix/`                   | 本地草稿、版本与恢复记录，不参与部署 |

页面目录由清单中的 `pageDirectory` 指定，默认 `pages`，实际位置在 `src/` 下。保留生成项目的依赖与构建配置，不要只复制 `src/`。

工作台中的草稿与历史仍可能有价值，清理 `.origamix/` 前先确认无需继续编辑。更多结构说明见 [Template](/architecture/template)。

模板交付使用已发布的固定 npm 依赖版本，不再携带 vendor 归档。源码更新不自动更新已有用户项目。发布前本地归档验证不等同于 npm registry 已可安装。

## 运行带布局的应用

Template 从 `origamix.project.json` 读取 `shell`、`layout` 和 `routing`。全局布局开启时，`shell.standalonePageIds` 中的页面仍独立渲染。页面内容读取已应用的目标 Schema。

配置的首页映射到 `/`。未指定首页时优先使用 `home` 页面，否则从根路径跳转到第一个页面。未知地址保留原路径并显示指定的 404 页面或模板默认 404。修改配置后重启开发服务，生产部署重新构建。详见[布局配置](/guide/layout)。
