---
title: 运行生成项目
description: 确认页面已经“保存版本”并成功“应用到项目”，然后在生成项目目录执行：
---

# 运行生成项目

确认页面已经“保存版本”并成功“应用到项目”，然后在生成项目目录执行：

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

| 路径                           | 用途                                 |
| ------------------------------ | ------------------------------------ |
| `origamix.project.json`        | 项目与页面清单                       |
| `src/pages/<slug>/index.tsx`   | 默认页面目录下的渲染入口             |
| `src/pages/<slug>/schema.json` | 已应用的页面数据                     |
| `vendor/*.tgz`                 | 生成项目自带的运行依赖归档           |
| `.origamix/`                   | 本地草稿、版本与恢复记录，不参与部署 |

页面目录由清单中的 `pageDirectory` 指定，默认 `pages`，实际位置在 `src/` 下。保留生成项目的依赖配置与 `vendor` 文件，不要只复制 `src/`。

工作台中的草稿与历史仍可能有价值，清理 `.origamix/` 前先确认无需继续编辑。更多结构说明见 [Template](/architecture/template)。
