---
title: Runtime：页面渲染
description: Runtime：页面渲染的职责、使用与开发说明
---

# Runtime：页面渲染

## 职责

将调用者提供的 Schema 与物料注册表交给 Tangramino 渲染，供 App 预览与生成项目共用。

## 关键入口

`react.tsx` 提供 `@origamix/runtime/react`，包括 `OrigamixPage`、未知物料检测和渲染结果诊断。

## 协作边界

不绑定物料库，不承担路由、编辑、网络或持久化。调用方提供 Schema、materials 与展示反馈，Runtime 负责引擎装配与错误捕获。

## 开发与验证

从仓库根目录执行：

```sh
pnpm --filter @origamix/runtime lint
pnpm --filter @origamix/runtime typecheck
pnpm --filter @origamix/runtime test
pnpm --filter @origamix/runtime build
```

修改后仍需运行根目录检查，并根据变更边界补充集成验证。

源码目录：`packages/runtime`。详细接口、维护规则与集成命令见[包 README](https://github.com/keiseiTi/origamix/tree/main/packages/runtime)。

返回[整体架构](/architecture/index)。
