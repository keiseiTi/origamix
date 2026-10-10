---
title: 开发与验证
description: 所有下列命令都从 Origamix 仓库根目录运行。
---

# 开发与验证

所有下列命令都从 Origamix 仓库根目录运行。

## 桌面与浏览器开发

```sh
pnpm install --frozen-lockfile
pnpm dev
```

浏览器开发宿主：

```sh
# 在当前 shell 中配置 DEEPSEEK_API_KEY，不要写入 VITE_*。
ORIGAMIX_WEB_PROJECT_DIR=/absolute/path/to/project pnpm dev:web
```

把示例路径替换为已有项目的绝对路径。浏览器没有原生目录选择器，宿主环境变量提供目录授权。默认开发数据在 `.origamix-web/`，可用 `ORIGAMIX_WEB_STATE_DIR` 覆盖。Key 不通过前端环境变量传递。

## 仓库检查

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm build` 编译库、工作台、后端并组装桌面资源，不制作安装包。单包检查入口见各包 README；影响生成项目时还需 Server 的 `test:template`，需要依赖缓存或网络。

界面变更还应在浅色、深色及窄屏下实际操作验证，自动检查不能证明页面显示正确。

## 官网开发

```sh
pnpm site
pnpm site:build
```

官网内容位于 `site/docs/`，主题位于 `site/theme/`。

## 阅读与贡献

先阅读根 `AGENTS.md` 与要修改目录的包级指导，保持公开导入边界。业务规则放在 Server 服务，持久化放在 Repository 或文件服务；不要在 UI 或 Main 新增目标 Schema 写入路径。

[仓库 README](https://github.com/keiseiTi/origamix/blob/main/README.md) 是当前命令总览，包 README 提供详细接口与验证说明。
