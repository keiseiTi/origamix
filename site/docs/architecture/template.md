---
title: Template：生成项目骨架
description: Template：生成项目骨架的职责、使用与开发说明
---

# Template：生成项目骨架

## 职责

提供可独立安装、开发和部署的 React 项目骨架；创建项目时由 Server 准备和复制。

## 关键入口

`src/main.tsx` 启动 React；`src/router.ts` 按项目清单注册路由；页面入口使用 Runtime 和 Materials 渲染目标 Schema。

## 协作边界

生成项目不依赖 App、Server 或 Electron。Server 打包步骤把工作区依赖替换为随项目提供的 vendor 归档；不要直接复制原始 Template 当作已生成项目。

## 开发与验证

从仓库根目录执行：

```sh
pnpm --filter @origamix/template lint
pnpm --filter @origamix/template typecheck
pnpm --filter @origamix/template build
```

Template 没有独立 test 脚本；生成项目集成由 `pnpm --filter @origamix/server test:template` 验证。

源码目录：`packages/template`。详细接口、维护规则与集成命令见[包 README](https://github.com/keiseiTi/origamix/tree/main/packages/template)。

返回[整体架构](/architecture/index)。
