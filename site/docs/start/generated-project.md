---
title: 运行生成项目
description: 确认页面以及启用的布局都已经“保存版本”并成功“应用到项目”，然后在生成项目目录执行：
---

# 运行生成项目

确认页面以及启用的布局都已经“保存版本”并成功“应用到项目”，然后在生成项目目录执行：

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

部署产物为 `dist/`。项目使用浏览器历史路由，静态服务器需要将未知子路由回退到 `index.html`。子路径部署还需协调资源基路径和路由 basename。

## 项目中的文件

| 路径                              | 用途                                 |
| --------------------------------- | ------------------------------------ |
| `origamix.project.json`           | 项目与页面清单                       |
| `src/pages/<slug>/index.tsx`      | 默认页面目录下的渲染入口             |
| `src/pages/<slug>/schema.json`    | 已应用的页面数据                     |
| `src/application.tsx`             | 应用外壳、公共布局与导航             |
| `src/origamix-layout/schema.json` | 已应用的布局数据（启用布局时）       |
| `.origamix/`                      | 本地草稿、版本与恢复记录，不参与部署 |

页面目录由清单中的 `pageDirectory` 指定，默认 `pages`，实际位置在 `src/` 下。保留生成项目的依赖与构建配置，不要只复制 `src/`。

工作台中的草稿与历史仍可能有价值，清理 `.origamix/` 前先确认无需继续编辑。更多结构说明见 [Template](/architecture/template)。

模板交付使用已发布的固定 npm 依赖版本，不再携带 vendor 归档。源码更新不自动更新已有用户项目。发布前本地归档验证不等同于 npm registry 已可安装。

## 运行带布局的应用

项目清单的 `layout.enabled` 控制全部页面。开启但缺少已应用布局文件时，独立应用会要求先在 Origamix 中保存并应用布局；工作台草稿预览成功不能替代这一步。页面与布局分别应用，只有目标 Schema 会被更新。

`home` 映射到 `/`，其他页面映射到 `/<slug>`；没有 Home 时默认跳转到第一个页面。部署后需重新构建才能发布清单、路由及已应用文件的变化。使用方式见[布局配置](/guide/layout)。
