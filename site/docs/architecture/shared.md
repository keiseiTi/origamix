---
title: Shared：公共契约
description: Shared：公共契约的职责、使用与开发说明
---

# Shared：公共契约

## 职责

平台无关的类型、运行时 Schema 和纯校验，为各层约定相同的请求与页面数据结构。

## 关键入口

`src/protocol/api.ts` 定义 HTTP 契约；`schema.ts` 定义页面与操作；`agent.ts` 定义 Run 与事件；`src/desktop-api.ts` 定义桌面桥；`src/page-window.ts` 定义预览消息。

## 协作边界

不依赖其他工作区包，也不读取文件、网络或凭据。消费者从声明的 `@origamix/shared/...` 子路径导入；接收边界执行实际校验。

## 开发与验证

从仓库根目录执行：

```sh
pnpm --filter @origamix/shared lint
pnpm --filter @origamix/shared typecheck
pnpm --filter @origamix/shared test
pnpm --filter @origamix/shared build
```

修改后仍需运行根目录检查，并根据变更边界补充集成验证。

源码目录：`packages/shared`。详细接口、维护规则与集成命令见[包 README](https://github.com/keiseiTi/origamix/tree/main/packages/shared)。

返回[整体架构](/architecture/index)。
